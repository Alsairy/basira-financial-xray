import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const base=(process.env.BASE_URL||'http://127.0.0.1:4317').replace(/\/$/,'');
const stamp=Date.now().toString(36), results=[];
const context={base,run_id:stamp,started_at:new Date().toISOString(),fixture:'balanced.xlsx',synthetic:true};
const password='Qa-Only-Long-Password!2026';
class Blocked extends Error{}
class Client {
  constructor(name){this.name=name;this.cookies=new Map();this.csrf='';}
  async req(method,path,body,opts={}){
    const headers={Origin:base,...opts.headers};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(this.cookies.size)headers.Cookie=[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
    if(opts.csrf!==false&&method!=='GET'&&this.csrf)headers['X-CSRF-Token']=opts.csrf||this.csrf;
    const r=await fetch(base+'/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(20000)});
    for(const c of r.headers.getSetCookie()){const [kv]=c.split(';');const p=kv.indexOf('=');this.cookies.set(kv.slice(0,p),kv.slice(p+1));}
    const raw=Buffer.from(await r.arrayBuffer());let data;try{data=JSON.parse(raw.toString());}catch{data=raw.toString();}
    if(data?.csrfToken)this.csrf=data.csrfToken;
    return {status:r.status,data,raw,headers:r.headers};
  }
}
const clients={cfo:new Client('CFO'),reviewer:new Client('Reviewer'),analyst:new Client('Analyst'),operator:new Client('Operator'),board:new Client('Board'),outsider:new Client('Outsider')};
let entity,dataset,document,job,analysis,report,action,users={},frozenReport;
const need=(value,label)=>{if(!value)throw new Blocked(label+' prerequisite unavailable');return value;};
function status(r,expected,label='HTTP'){assert.ok([].concat(expected).includes(r.status),`${label}: expected ${expected}, got ${r.status}: ${JSON.stringify(r.data).slice(0,1200)}`);return r.data;}
function numberClose(a,b,label){assert.equal(typeof a,'number',label+' must be numeric');assert.ok(Math.abs(a-b)<Math.max(0.01,Math.abs(b)*1e-6),`${label}: ${a} != ${b}`);}
const ok=(r)=>status(r,[200,201,202]);
function assertLinks(html){const ids=[...html.matchAll(/\bid="([^"]*)"/g)].map(m=>m[1]);const refs=[...html.matchAll(/href="#([^"]*)"/g)].map(m=>decodeURIComponent(m[1]));assert.equal(new Set(ids).size,ids.length,'Export has duplicate element IDs');assert.ok(refs.every(r=>ids.includes(r)),'Export has dangling source or metric links');}

async function check(id,features,name,fn){const start=performance.now();try{const evidence=await fn();results.push({id,features,name,status:'passed',duration_ms:Math.round(performance.now()-start),evidence:evidence||null});console.log(`PASS ${id} ${name}`);return true;}catch(e){const state=e instanceof Blocked?'blocked':'failed';results.push({id,features,name,status:state,duration_ms:Math.round(performance.now()-start),error:e.message});console.log(`${state.toUpperCase()} ${id} ${name}: ${e.message}`);return false;}}
async function upload(file,actor=clients.analyst,extra={}){
  const bytes=await readFile(join(root,'fixtures',file));
  const r=await actor.req('POST','/documents',{entity_id:need(entity,'entity').id,filename:file,content_base64:bytes.toString('base64'),rights_confirmed:true,currency:'SAR',scale:1,...extra});
  const upload=ok(r); assert.ok(upload.document?.id,'document id');assert.ok(upload.job_id,'job id');
  const start=Date.now();let j;
  do{j=ok(await actor.req('GET','/jobs/'+upload.job_id));if(['completed','failed'].includes(j.status))break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<60000);
  assert.equal(j.status,'completed',JSON.stringify(j)); assert.ok(j.dataset_id,'job dataset id');
  return {document:upload.document,job:j,dataset:ok(await actor.req('GET','/datasets/'+j.dataset_id)),bytes};
}
async function reviewAll(ds){
  const updates=ds.facts.filter(f=>f.review_status!=='reviewed').map(f=>({id:f.id,review_status:'reviewed'}));
  if(updates.length)ds=ok(await clients.analyst.req('PATCH',`/datasets/${ds.id}/facts`,{version:ds.version,updates,reason:'Independent synthetic QA review of all normalized values and sources'}));
  return ds;
}

const getDataset=()=>clients.analyst.req('GET','/datasets/'+need(dataset,'dataset').id).then(ok);
const getAction=()=>clients.cfo.req('GET','/actions/'+need(action,'action').id).then(ok);
const createActionBody=()=>({entity_id:entity.id,analysis_id:analysis.id,title:'Synthetic QA collection process',description:'Workflow test, no actual company benefit',owner_id:users.operator.id,due_date:'2026-12-31',baseline:1000000,target:900000,unit:'SAR',effect_type:'cash_release',dependency_group:'qa-receivables-2025'});
await check('AUTH-01',['F01'],'Health and anonymous session boundary',async()=>{status(await clients.cfo.req('GET','/health'),200);status(await clients.cfo.req('GET','/session'),401);});
await check('AUTH-02',['F01','F02'],'Register actual tenant, provision independent roles, log in',async()=>{
  const s=ok(await clients.cfo.req('POST','/auth/register',{name:'QA CFO',email:`qa-${stamp}-cfo@example.test`,password,company:`Synthetic QA ${stamp}`}));assert.equal(s.user.role,'cfo');assert.ok(s.csrfToken);assert.ok(s.tenant.id);users.cfo=s.user;
  for(const role of ['analyst','operator','board','reviewer']){const email=`qa-${stamp}-${role}@example.test`;const r=ok(await clients.cfo.req('POST','/members',{name:`QA ${role}`,email,password,role:role==='reviewer'?'cfo':role}));users[role]=r.user||r;const signed=ok(await clients[role].req('POST','/auth/login',{email,password}));assert.equal(signed.tenant.id,s.tenant.id);users[role]=signed.user;}
  const other=ok(await clients.outsider.req('POST','/auth/register',{name:'QA outside',email:`qa-${stamp}-outside@example.test`,password,company:`Other QA ${stamp}`}));assert.notEqual(other.tenant.id,s.tenant.id);
  entity=ok(await clients.cfo.req('POST','/entities',{name:'Synthetic software services',sector:'software',sector_code:'it_services',currency:'SAR'}));assert.ok(entity.id);
  return {roles:Object.keys(users),tenant_id:s.tenant.id,entity_id:entity.id};
});
await check('AUTH-03',['F01','F02'],'CSRF and member provisioning restrictions',async()=>{
  need(entity,'entity');status(await clients.cfo.req('POST','/entities',{name:'CSRF should fail',sector:'software',currency:'SAR'},{csrf:false}),403);
  status(await clients.cfo.req('POST','/entities',{name:'CSRF should fail',sector:'software',currency:'SAR'},{csrf:'invalid-token'}),403);
  for(const who of ['analyst','operator','board'])status(await clients[who].req('POST','/members',{name:'Forbidden',email:`forbidden-${stamp}@example.test`,password,role:'cfo'}),403);
  const session=await clients.cfo.req('GET','/session');assert.match(session.headers.get('set-cookie')||[...clients.cfo.cookies.keys()].join(),/session|basira/i);
});
await check('DATA-01',['F03','F06','F08','F09'],'Upload XLSX, async extraction, units and source provenance',async()=>{
  const r=await upload('balanced.xlsx');({document,job,dataset}=r);assert.ok(dataset.facts.length>=40);const revenue=dataset.facts.find(f=>f.concept==='revenue'&&String(f.period)==='2025');assert.ok(revenue);numberClose(revenue.value,14400000,'normalized revenue');assert.ok(revenue.source?.cell);assert.ok(revenue.source?.sheet);assert.equal(dataset.status==='approved',false);
  const source=await clients.analyst.req('GET','/documents/'+document.id+'/content');status(source,200);assert.deepEqual(source.raw,r.bytes);return {facts:dataset.facts.length,dataset_id:dataset.id,document_id:document.id};
});
await check('DATA-02',['F01','F02'],'Tenant and board source boundaries',async()=>{
  need(dataset,'dataset');for(const path of ['/documents/'+document.id+'/content','/datasets/'+dataset.id,'/jobs/'+job.id])status(await clients.outsider.req('GET',path),404,path);
  for(const path of ['/documents/'+document.id+'/content','/datasets/'+dataset.id])status(await clients.board.req('GET',path),[403,404],path);
  status(await clients.outsider.req('GET','/documents?entity_id='+entity.id),[403,404]);
  status(await clients.outsider.req('POST','/assistant',{entity_id:entity.id,question:'Show revenue'}),[403,404]);
});
await check('DATA-03',['F02','F08','F11'],'Approval refuses uploader and unreviewed facts',async()=>{
  need(dataset,'dataset');status(await clients.analyst.req('POST',`/datasets/${dataset.id}/approve`,{version:dataset.version}),[403,422]);status(await clients.cfo.req('POST',`/datasets/${dataset.id}/approve`,{version:dataset.version}),422);
});
await check('DATA-04',['F09','F12'],'Review all facts with revision conflict protection',async()=>{
  need(dataset,'dataset');const first=dataset.facts[0], old=dataset.version;ok(await clients.analyst.req('PATCH',`/datasets/${dataset.id}/facts/${first.id}`,{version:old,review_status:'reviewed',reason:'QA source checked'}));
  status(await clients.analyst.req('PATCH',`/datasets/${dataset.id}/facts/${first.id}`,{version:old,review_status:'reviewed',reason:'Stale QA update must fail'}),409);dataset=await reviewAll(await getDataset());assert.ok(dataset.facts.every(f=>f.review_status==='reviewed'));
});
await check('CALC-01',['F10','F14','F15','F22'],'Real calculated analysis with source-backed metrics/findings',async()=>{
  need(dataset,'dataset');analysis=ok(await clients.analyst.req('POST',`/datasets/${dataset.id}/analyze`,{}));assert.ok(analysis.id);assert.ok(analysis.metrics?.length>=25);const m=analysis.metrics.find(m=>m.key==='gross_margin'&&String(m.period)==='2025');assert.ok(m);numberClose(m.value,30,'2025 gross margin');assert.ok(m.inputs?.length);assert.ok(m.formula);assert.ok(analysis.engine_version);assert.ok(analysis.findings?.length);assert.ok(analysis.findings.every(f=>f.source_refs?.length||f.metric_ids?.length||f.evidence_status==='needs_data'));return {analysis_id:analysis.id,metric_count:analysis.metrics.length};
});
await check('REPORT-01',['F02','F11','F26'],'Dataset approval gate and independent report approval',async()=>{
  need(analysis,'analysis');const draft=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA preapproval draft',language:'ar'}));status(await clients.reviewer.req('POST',`/reports/${draft.id}/approve`,{}),422);
  dataset=ok(await clients.cfo.req('POST',`/datasets/${dataset.id}/approve`,{version:dataset.version}));analysis=ok(await clients.analyst.req('POST',`/datasets/${dataset.id}/analyze`,{}));
  report=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA approved Arabic report',language:'ar'}));status(await clients.cfo.req('POST',`/reports/${report.id}/approve`,{}),[403,422]);report=ok(await clients.reviewer.req('POST',`/reports/${report.id}/approve`,{}));assert.equal(report.status,'approved');frozenReport=ok(await clients.cfo.req('GET',`/reports/${report.id}/export?format=json`));
  status(await clients.board.req('GET',`/reports/${draft.id}`),[403,404]);status(await clients.board.req('GET',`/reports/${report.id}`),200);status(await clients.outsider.req('GET',`/reports/${report.id}`),404);return {report_id:report.id};
});
await check('SCENARIO-01',['F20','F21'],'Collection scenario cash timing calculated from actual credit sales',async()=>{
  need(dataset,'dataset');const s=ok(await clients.analyst.req('POST','/scenarios/evaluate',{dataset_id:dataset.id,type:'collection_days',low:5,base:10,high:15}));assert.equal(s.effect_type,'cash_release');for(const [k,d]of[['low',5],['base',10],['high',15]])numberClose(typeof s[k]==='number'?s[k]:s[k]?.value,12000000/365*d,k);assert.ok(s.source_refs?.length);assert.ok(s.formula);assert.ok(s.dependency_group);
});
await check('SCENARIO-02',['F20','F21'],'Reject invalid type, order, bounds, nulls and numeric strings',async()=>{
  need(dataset,'dataset');const valid={dataset_id:dataset.id,type:'collection_days',low:5,base:10,high:15};const bad=[{low:-1},{low:20,base:10,high:5},{high:9999},{base:null},{base:'10'},{type:'invented_type'},{type:'gross_margin',high:101},{type:'opex_reduction',high:101},{type:'financing_rate',high:10001}];for(const patch of bad)status(await clients.analyst.req('POST','/scenarios/evaluate',{...valid,...patch}),422,JSON.stringify(patch));
});
await check('PEER-01',['F17','F18','F19'],'Peer metadata and metric validation rejects arbitrary benchmarks',async()=>{
  need(entity,'entity');const p={entity_id:entity.id,name:'Synthetic test only',sector:'software',country:'SA',currency:'SAR',period:'2025',source_url:'https://example.com/synthetic-qa',rights_basis:'Synthetic QA data owned by test author, not external benchmark',definition_notes:'Gross profit / revenue * 100, consolidated calendar year',metrics:{gross_margin:35}};
  for(const patch of [{rights_basis:''},{source_url:''},{source_url:'javascript:alert(1)'},{definition_notes:''},{metrics:{invented_metric:10}},{metrics:{gross_margin:null}}])status(await clients.cfo.req('POST','/peers',{...p,...patch}),422,JSON.stringify(patch));
});
await check('PEER-02',['F17','F18','F19'],'Benchmark cohort eligibility and minimum sample size',async()=>{
  need(analysis,'analysis');const peers=[];const tpl={entity_id:entity.id,sector:'software',country:'SA',currency:'SAR',period:'2025',source_url:'https://example.com/synthetic-qa',rights_basis:'Synthetic QA data owned by test author; not real peer data',definition_notes:'Gross profit / revenue * 100; consolidated; calendar year'};
  for(const [i,value]of[25,30,35,40,45].entries())peers.push(ok(await clients.cfo.req('POST','/peers',{...tpl,name:'Synthetic QA peer '+i,metrics:{gross_margin:value}})));
  const small=ok(await clients.cfo.req('POST','/benchmarks',{entity_id:entity.id,metric_key:'gross_margin',peer_ids:[peers[0].id]}));assert.equal(small.n,1);assert.ok(small.rank===null||small.rank===undefined,'small cohort must suppress rank');
  const wrong=ok(await clients.cfo.req('POST','/peers',{...tpl,name:'Synthetic noncomparable peer',sector:'banking',currency:'USD',period:'2024',metrics:{gross_margin:99}}));
  const b=ok(await clients.cfo.req('POST','/benchmarks',{entity_id:entity.id,metric_key:'gross_margin',peer_ids:[...peers.map(p=>p.id),wrong.id]}));assert.equal(b.n,5);numberClose(b.median,35,'benchmark median');assert.ok(b.exclusions?.length);return {eligible_sample:b.n,excluded:b.exclusions.length};
});
await check('PEER-03',['F17','F18'],'sector_code matches real-world peers a free-text sector never would; period is explicit and disclosed, never silent',async()=>{
  need(entity,'entity');need(analysis,'analysis');
  // entity was created with sector_code:'it_services' and sector:'software'. The fixture
  // (balanced.xlsx) covers 2023/2024/2025, so 2024 is a real, already-analyzed prior period.
  const tpl={entity_id:entity.id,country:'SA',currency:'SAR',source_url:'https://example.com/synthetic-qa',rights_basis:'Synthetic QA data owned by test author; not real peer data',definition_notes:'Gross profit / revenue * 100; consolidated'};
  // Free-text sector deliberately differs from the entity's ("software") the way real peer
  // descriptions always do; only sector_code matches. Also uses an OLDER period than the
  // entity's own latest analyzed year (2025), the way real peer filings routinely lag.
  const codedPeer=ok(await clients.cfo.req('POST','/peers',{...tpl,name:'Synthetic coded peer',sector:'IT services / systems integration (Tadawul: Software & Services)',sector_code:'it_services',period:'2024',metrics:{gross_margin:22}}));
  status(await clients.cfo.req('POST','/peers',{...tpl,name:'bad code',sector:'software',sector_code:'not_a_real_code',period:'2024',metrics:{gross_margin:1}}),422);
  // sector-code differs -> must exclude even though the free-text sector happens to match.
  const mismatchedCode=ok(await clients.cfo.req('POST','/peers',{...tpl,name:'Synthetic mismatched code peer',sector:'software',sector_code:'transport_logistics',period:'2024',metrics:{gross_margin:99}}));
  status(await clients.cfo.req('POST','/benchmarks',{entity_id:entity.id,metric_key:'gross_margin',peer_ids:[codedPeer.id],period:'not-an-analyzed-period'}),422);
  const noPeriod=ok(await clients.cfo.req('POST','/benchmarks',{entity_id:entity.id,metric_key:'gross_margin',peer_ids:[codedPeer.id]}));
  assert.equal(noPeriod.n,0,'a latest-period-default request must exclude a 2024-only peer on period alone');
  assert.ok(noPeriod.exclusions.find(x=>x.id===codedPeer.id)?.reasons.includes('period_mismatch'));
  const withPeriod=ok(await clients.cfo.req('POST','/benchmarks',{entity_id:entity.id,metric_key:'gross_margin',peer_ids:[codedPeer.id,mismatchedCode.id],period:'2024'}));
  assert.equal(withPeriod.n,1,'sector_code must admit the coded peer once the period matches');
  assert.equal(withPeriod.peers[0]?.id,codedPeer.id);
  assert.ok(withPeriod.exclusions.find(x=>x.id===mismatchedCode.id)?.reasons.includes('sector_mismatch'),'differing sector_code must still exclude despite matching free-text sector');
  assert.ok(withPeriod.warnings.some(w=>/2024/.test(w)&&/latest/.test(w)),'using a non-latest period must be disclosed in warnings, never silent');
  return {eligible_with_code_and_period:withPeriod.n};
});
await check('ACTION-01',['F01','F27'],'Action required values and tenant owner validation',async()=>{
  need(analysis,'analysis');const body=createActionBody();for(const patch of [{due_date:''},{owner_id:'does-not-exist'},{baseline:null},{target:'not-a-number'}])status(await clients.cfo.req('POST','/actions',{...body,...patch}),[404,422],JSON.stringify(patch));action=ok(await clients.cfo.req('POST','/actions',body));assert.ok(action.id);status(await clients.outsider.req('GET','/actions/'+action.id),404);
});
await check('ACTION-02',['F27','F28','F29'],'Evidence-gated closure by an independent reviewer',async()=>{
  need(action,'action');action=ok(await clients.cfo.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'approved',reason:'QA plan approved'}));action=ok(await clients.operator.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'in_progress',reason:'QA implementation started'}));
  status(await clients.operator.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'pending_verification',reason:'No evidence must fail'}),422);
  ok(await clients.operator.req('POST',`/actions/${action.id}/evidence`,{title:'Synthetic QA evidence',note:'Workflow proof only; no actual business benefit claimed',filename:'proof.txt',content_base64:(await readFile(join(root,'fixtures/proof.txt'))).toString('base64')}));action=await getAction();action=ok(await clients.operator.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'pending_verification',reason:'Evidence attached'}));
  status(await clients.operator.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'closed',reason:'Owner cannot independently close'}),[403,422]);action=ok(await clients.cfo.req('POST',`/actions/${action.id}/transition`,{version:action.version,status:'closed',reason:'Independent QA evidence checked'}));assert.equal(action.status,'closed');assert.ok(action.evidence?.length);return {action_id:action.id};
});
await check('ACTION-03',['F29','F32','F33'],'Benefit requires independent reviewer and measurement metadata',async()=>{
  need(action,'action');const b={baseline:1000000,actual:900000,amount:100000,effect_type:'cash_release',period_start:'2025-01-01',period_end:'2025-12-31',method:'Synthetic QA comparison, no actual savings',confounders:'QA test only'};
  status(await clients.operator.req('POST',`/actions/${action.id}/benefit`,b),[403,422]);status(await clients.reviewer.req('POST',`/actions/${action.id}/benefit`,{...b,method:''}),422);status(await clients.reviewer.req('POST',`/actions/${action.id}/benefit`,{...b,actual:1100000}),422);status(await clients.cfo.req('POST',`/actions/${action.id}/benefit`,b),422);action=ok(await clients.reviewer.req('POST',`/actions/${action.id}/benefit`,b));assert.equal(action.status,'benefit_verified');status(await clients.reviewer.req('POST',`/actions/${action.id}/benefit`,b),[409,422]);
});
await check('ACTION-04',['F28','F29','F33'],'Second action cannot double-count overlapping benefit; evidence access scoped',async()=>{
  need(action,'verified action');assert.equal(action.status,'benefit_verified');const evidence=action.evidence[0];assert.ok(evidence?.id);status(await clients.operator.req('GET',`/actions/${action.id}/evidence/${evidence.id}/content`),200);status(await clients.outsider.req('GET',`/actions/${action.id}/evidence/${evidence.id}/content`),404);status(await clients.board.req('GET',`/actions/${action.id}/evidence/${evidence.id}/content`),[403,404]);
  let other=ok(await clients.cfo.req('POST','/actions',{...createActionBody(),title:'Synthetic duplicate dependency outcome'}));
  for(const [who,next]of[['cfo','approved'],['operator','in_progress']])other=ok(await clients[who].req('POST',`/actions/${other.id}/transition`,{version:other.version,status:next,reason:'QA overlap verification'}));
  other=ok(await clients.operator.req('POST',`/actions/${other.id}/evidence`,{title:'QA overlap proof',note:'Same cash release, same period; must not double-count'}));
  other=ok(await clients.operator.req('POST',`/actions/${other.id}/transition`,{version:other.version,status:'pending_verification',reason:'QA supplied evidence'}));other=ok(await clients.cfo.req('POST',`/actions/${other.id}/transition`,{version:other.version,status:'closed',reason:'QA closure independent of owner'}));
  status(await clients.reviewer.req('POST',`/actions/${other.id}/benefit`,{baseline:1000000,actual:900000,amount:100000,effect_type:'cash_release',period_start:'2025-06-01',period_end:'2025-12-31',method:'Same synthetic period outcome',confounders:'No actual company benefit'}),[409,422]);
});
await check('AUDIENCE-01',['F22','F24','F25','F26','F34'],'Audience changes structured content while preserving financial facts',async()=>{
  need(analysis,'analysis');need(report,'approved report');const variants={};
  for(const audience of ['board','ceo','cfo','sales','analyst','sector','operations']){const r=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA audience content '+audience,language:'en',audience}));assert.equal(r.audience,audience);assert.equal(r.snapshot.audience,audience);assert.ok(Array.isArray(r.snapshot.sections)&&r.snapshot.sections.length>1,'Structured report sections required');variants[audience]=r;const html=await clients.cfo.req('GET',`/reports/${r.id}/export?format=html`);status(html,200);assertLinks(html.data);}
  const canon=r=>r.snapshot.analysis.metrics.map(m=>({id:m.id,key:m.key,period:m.period,value:m.value,unit:m.unit,formula:m.formula})).sort((a,b)=>a.id.localeCompare(b.id));
  for(const r of Object.values(variants))assert.deepEqual(canon(r),canon(variants.cfo),'audience changed financial metrics');
  assert.notDeepEqual(variants.cfo.snapshot.sections.map(x=>x.id),variants.board.snapshot.sections.map(x=>x.id),'Audience only changed label, not section structure');
  assert.notDeepEqual(variants.sales.snapshot.sections,variants.sector.snapshot.sections,'Sales and sector content identical');
  for(const audience of ['sales','sector']){const missing=variants[audience].snapshot.sections.find(s=>s.id==='missing_data');assert.ok(missing?.items?.length,`${audience}: absent granular data must be explicit`);assert.match(JSON.stringify(missing),/missing|unavailable|not available|require|need|غير|يتطلب|تتوفر|تتوافر|بيانات/i);}
  let approved=ok(await clients.reviewer.req('POST',`/reports/${variants.sales.id}/approve`,{}));const before=structuredClone(approved.snapshot);const mutate=await clients.cfo.req('PATCH',`/reports/${approved.id}`,{audience:'cfo',version:approved.version,title:'Mutation must fail'});status(mutate,[404,405,409,422]);approved=ok(await clients.cfo.req('GET',`/reports/${approved.id}`));assert.deepEqual(approved.snapshot,before,'Approved audience snapshot changed');
  status(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'Bad audience',language:'en',audience:'superadmin'}),422);
  return {audiences:Object.keys(variants),sections:Object.fromEntries(Object.entries(variants).map(([k,r])=>[k,r.snapshot.sections.map(s=>s.id)]))};
});
await check('AUDIENCE-02',['F01','F02','F34'],'Audience selection cannot elevate board role or raw-source access',async()=>{
  need(report,'report');status(await clients.board.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'Forbidden CFO audience',language:'en',audience:'cfo'}),403);status(await clients.board.req('GET',`/documents/${document.id}/content?audience=cfo`),[403,404]);status(await clients.board.req('GET',`/datasets/${dataset.id}?audience=analyst`),[403,404]);const session=ok(await clients.board.req('GET','/session'));assert.equal(session.user.role,'board');
});
await check('AUDIENCE-03',['F22','F24'],'Purpose and depth change actual report content',async()=>{
  need(analysis,'analysis');const common={entity_id:entity.id,analysis_id:analysis.id,title:'QA purpose and depth',language:'en',audience:'cfo'};const periodic=ok(await clients.cfo.req('POST','/reports',{...common,purpose:'periodic_review',detail_level:'standard'}));const capital=ok(await clients.cfo.req('POST','/reports',{...common,purpose:'capital_decision',detail_level:'standard'}));const purpose=r=>r.snapshot.sections.find(s=>s.id==='purpose_focus');assert.ok(purpose(periodic)?.items?.length);assert.notDeepEqual(purpose(periodic).items,purpose(capital).items,'Purpose only changed metadata');
  const brief=ok(await clients.cfo.req('POST','/reports',{...common,purpose:'periodic_review',detail_level:'brief'}));const detailed=ok(await clients.cfo.req('POST','/reports',{...common,purpose:'periodic_review',detail_level:'detailed'}));assert.ok(detailed.snapshot.sections.some(s=>s.id==='methodology'));assert.ok(!brief.snapshot.sections.some(s=>s.id==='methodology'));assert.ok(detailed.snapshot.sections.flatMap(s=>s.items).length>brief.snapshot.sections.flatMap(s=>s.items).length);assert.deepEqual(detailed.snapshot.analysis.metrics,brief.snapshot.analysis.metrics);
});
await check('LANGUAGE-01',['F25'],'Arabic and English report sections preserve identical financial definitions',async()=>{
  need(analysis,'analysis');const reports=[];for(const language of ['ar','en'])reports.push(ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA bilingual check',language,audience:'analyst',detail_level:'detailed'})));assert.deepEqual(reports[0].snapshot.analysis.metrics,reports[1].snapshot.analysis.metrics);assert.notEqual(reports[0].snapshot.sections[0].title,reports[1].snapshot.sections[0].title);const metrics=r=>r.snapshot.sections.flatMap(s=>s.items).filter(i=>i.type==='metric').map(i=>({id:i.metric_id,value:i.value,unit:i.unit,formula:i.formula}));assert.deepEqual(metrics(reports[0]),metrics(reports[1]));
});
await check('FINDING-01',['F23','F26'],'CFO rejection after draft preparation blocks stale publication',async()=>{
  need(analysis,'analysis');const finding=analysis.findings[0];assert.ok(finding);const draft=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA draft before finding rejection',language:'en',audience:'ceo'}));analysis=ok(await clients.cfo.req('POST',`/findings/${analysis.id}/${finding.id}/review`,{status:'rejected',reason:'QA rejected hypothesis must not be published as approved finding'}));assert.equal(analysis.finding_reviews[finding.id].status,'rejected');status(await clients.reviewer.req('POST',`/reports/${draft.id}/approve`,{}),[409,422]);
});
await check('FINDING-02',['F23'],'New report omits rejected findings from decision/watchpoint sections',async()=>{
  need(analysis,'analysis');const rejected=Object.entries(analysis.finding_reviews||{}).filter(([,v])=>v.status==='rejected').map(([id])=>id);assert.ok(rejected.length,'rejected finding prerequisite');const draft=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'QA after rejection',language:'en',audience:'ceo'}));const published=draft.snapshot.sections.flatMap(s=>s.items).filter(x=>x.type==='finding');assert.ok(!published.some(f=>rejected.includes(f.finding_id)),'Rejected finding remains in report decision content');
});
await check('REPORT-02',['F12','F13','F16','F19','F26'],'Fact edit invalidates approval and stale analyses; frozen report unchanged',async()=>{
  need(report,'approved report');assert.equal(report.status,'approved');dataset=await getDataset();const fact=dataset.facts.find(f=>f.concept==='receivables'&&String(f.period)==='2025');assert.ok(fact);ok(await clients.analyst.req('PATCH',`/datasets/${dataset.id}/facts/${fact.id}`,{version:dataset.version,value:fact.value+1000,review_status:'reviewed',reason:'QA change must invalidate future outputs'}));dataset=await getDataset();assert.notEqual(dataset.status,'approved');assert.equal(dataset.facts.find(f=>f.id===fact.id).original_value,fact.original_value);
  const frozenAfter=ok(await clients.cfo.req('GET',`/reports/${report.id}/export?format=json`));assert.deepEqual(frozenAfter,frozenReport,'approved report snapshot mutated after source edit');
  const newDraft=await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:analysis.id,title:'Stale QA analysis must not publish',language:'ar'});
  if([200,201].includes(newDraft.status))status(await clients.reviewer.req('POST',`/reports/${newDraft.data.id}/approve`,{}),422);else status(newDraft,[409,422]);
  dataset=await reviewAll(dataset);dataset=ok(await clients.cfo.req('POST',`/datasets/${dataset.id}/approve`,{version:dataset.version}));
  if([200,201].includes(newDraft.status))status(await clients.reviewer.req('POST',`/reports/${newDraft.data.id}/approve`,{}),422,'Old analysis remains stale after dataset reapproval');
});
await check('DATA-05',['F11'],'Material imbalance blocks dataset approval after human review',async()=>{
  const uploaded=await upload('unbalanced.xlsx');const ds=await reviewAll(uploaded.dataset);const a=ok(await clients.analyst.req('POST',`/datasets/${ds.id}/analyze`,{}));assert.ok(a.checks.some(c=>c.status==='fail'),'must identify material imbalance');status(await clients.cfo.req('POST',`/datasets/${ds.id}/approve`,{version:ds.version}),422);
});
await check('DATA-06',['F04'],'Duplicate source ingestion is prevented or explicitly identified',async()=>{
  need(document,'document');const r=await clients.analyst.req('POST','/documents',{entity_id:entity.id,filename:'balanced.xlsx',content_base64:(await readFile(join(root,'fixtures/balanced.xlsx'))).toString('base64'),rights_confirmed:true,currency:'SAR',scale:1});
  if([200,201,202].includes(r.status))assert.ok(r.data.duplicate===true||r.data.document?.id===document.id,'duplicate silently created a fresh document');else status(r,[409,422]);
});
await check('DATA-07',['F03'],'Unsupported type and missing upload rights fail safely',async()=>{
  need(entity,'entity');const p={entity_id:entity.id,filename:'unsafe.exe',content_base64:Buffer.from('not executable QA fixture').toString('base64'),rights_confirmed:true};status(await clients.analyst.req('POST','/documents',p),[400,415,422]);status(await clients.analyst.req('POST','/documents',{...p,filename:'balanced.xlsx',rights_confirmed:false}),[400,422]);
});
await check('ASSISTANT-01',['F22','F34'],'Board assistant restricted to approved report with evidence',async()=>{
  need(report,'approved report');const reply=ok(await clients.board.req('POST','/assistant',{entity_id:entity.id,report_id:report.id,question:'What is the gross margin in 2025?'}));assert.equal(typeof reply.answer,'string');assert.ok(['evidence','llm'].includes(reply.mode));assert.ok(reply.citations?.length,'financial answer must have citations');status(await clients.outsider.req('POST','/assistant',{entity_id:entity.id,report_id:report.id,question:'What is revenue?'}),[403,404]);
});
await check('CONTROL-01',['F02','F16','F35'],'Settings authority and audit attribution',async()=>{
  need(entity,'entity');status(await clients.operator.req('PATCH','/settings',{materiality_pct:2}),403);const audit=ok(await clients.cfo.req('GET','/audit'));assert.ok(Array.isArray(audit)&&audit.length>=10);assert.ok(audit.some(e=>e.user_id===users.analyst.id));assert.ok(audit.some(e=>e.user_id===users.reviewer.id));const foreign=ok(await clients.outsider.req('GET','/audit'));assert.ok(!foreign.some(e=>e.resource_id===dataset?.id||e.resource_id===report?.id));
});
await check('CONTROL-02',['F16','F26','F35'],'Settings versions invalidate drafts and downloads are audited',async()=>{
  need(dataset,'dataset');dataset=await getDataset();const current=ok(await clients.analyst.req('POST',`/datasets/${dataset.id}/analyze`,{}));const draft=ok(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:current.id,title:'QA before policy change',language:'en'}));const before=ok(await clients.cfo.req('GET','/settings'));const after=ok(await clients.cfo.req('PATCH','/settings',{version:before.version,days:before.days===365?360:365,materiality_pct:2}));assert.ok(after.version>before.version);status(await clients.cfo.req('PATCH','/settings',{version:before.version,days:365}),409);status(await clients.reviewer.req('POST',`/reports/${draft.id}/approve`,{}),[409,422]);status(await clients.cfo.req('POST','/reports',{entity_id:entity.id,analysis_id:current.id,title:'QA old policy',language:'en'}),[409,422]);status(await clients.cfo.req('PATCH','/settings',{version:after.version,days:0}),422);assert.deepEqual(ok(await clients.cfo.req('GET',`/reports/${report.id}/export?format=json`)),frozenReport);
  const audit=ok(await clients.cfo.req('GET','/audit'));for(const event of ['document.download','evidence.download','report.export','settings.update'])assert.ok(audit.some(a=>a.action===event),'Missing audit event '+event);
});
await check('DATA-08',['F03','F27'],'Malformed short XLSX and impossible dates return controlled errors',async()=>{
  need(entity,'entity');status(await clients.analyst.req('POST','/documents',{entity_id:entity.id,filename:'one-byte.xlsx',content_base64:'UA==',rights_confirmed:true}),[400,415,422]);status(await clients.cfo.req('POST','/actions',{...createActionBody(),due_date:'2026-99-99'}),422);
});
await check('DATA-09',['F03','F08'],'Validated CSV upload uses real extraction and currency units',async()=>{const r=await upload('balanced.csv');const f=r.dataset.facts.find(f=>f.concept==='revenue'&&f.period==='2025');assert.ok(f);numberClose(f.value,14400000,'CSV normalized revenue');assert.ok(f.source);});
await check('VERSION-01',['F01','F12','F13'],'Historical dataset versions retain original fact values and attribution',async()=>{
  need(dataset,'dataset');const versions=ok(await clients.cfo.req('GET',`/datasets/${dataset.id}/revisions`));assert.ok(versions.length>=2);assert.ok(versions.some(v=>v.facts.some(f=>f.concept==='receivables'&&f.period==='2025'&&f.value===3200000)));assert.ok(versions.every(v=>v.reason&&v.changed_by&&v.changed_at));status(await clients.outsider.req('GET',`/datasets/${dataset.id}/revisions`),404);status(await clients.board.req('GET',`/datasets/${dataset.id}/revisions`),[403,404]);
});
await check('NOTIFY-01',['F01','F30'],'Overdue reminders reach owner and CFO once per business date',async()=>{
  need(action,'action');const a=ok(await clients.cfo.req('POST','/actions',{...createActionBody(),title:'Synthetic overdue action',due_date:'2025-01-01'}));const own=ok(await clients.operator.req('GET','/notifications')).filter(n=>n.kind==='action_overdue'&&n.action_id===a.id);assert.equal(own.length,1);assert.equal(own[0].user_id,users.operator.id);assert.equal(own[0].time_zone,'Asia/Riyadh');const repeated=ok(await clients.operator.req('GET','/notifications')).filter(n=>n.kind==='action_overdue'&&n.action_id===a.id);assert.deepEqual(repeated,own);const cfo=ok(await clients.cfo.req('GET','/notifications')).filter(n=>n.kind==='action_overdue'&&n.action_id===a.id);assert.equal(cfo.length,1);status(await clients.analyst.req('POST',`/notifications/${own[0].id}/read`,{}),404);ok(await clients.operator.req('POST',`/notifications/${own[0].id}/read`,{}));assert.equal(ok(await clients.operator.req('GET','/notifications')).find(n=>n.id===own[0].id).read,true);const foreign=ok(await clients.outsider.req('GET','/notifications'));assert.ok(!foreign.some(n=>n.action_id===a.id));
});
await check('USAGE-01',['F01','F37'],'Actual engine usage is distinct from declared review cost and inactive providers',async()=>{
  need(dataset,'dataset');const r=ok(await clients.analyst.req('POST','/usage/review',{entity_id:entity.id,dataset_id:dataset.id,minutes:30,hourly_rate:120,currency:'SAR'}));numberClose(r.amount,60,'self-declared review cost');assert.equal(r.source,'self_reported');const u=ok(await clients.cfo.req('GET','/usage?entity_id='+entity.id));assert.ok(u.engine.total_calls>=1);assert.ok(u.jobs.completed>=1);assert.ok(u.engine.events.every(e=>Number.isFinite(e.duration_ms)&&e.duration_ms>=0));assert.equal(u.costs.external_ai.status,'not_configured');assert.equal(u.costs.ocr.status,'not_configured');assert.equal(u.costs.local_compute.amount,null);numberClose(u.costs.review.totals.find(t=>t.currency==='SAR').amount,60,'review cost ledger');status(await clients.outsider.req('GET','/usage?entity_id='+entity.id),404);status(await clients.board.req('GET','/usage?entity_id='+entity.id),403);status(await clients.analyst.req('POST','/usage/review',{entity_id:entity.id,dataset_id:dataset.id,minutes:-1,hourly_rate:120}),422);
});
await check('AUTH-04',['F01','F02'],'Logout revokes server session',async()=>{need(clients.analyst.csrf,'analyst login');status(await clients.analyst.req('POST','/auth/logout',{}),[200,204]);status(await clients.analyst.req('GET','/session'),401);});
context.finished_at=new Date().toISOString();context.summary=Object.fromEntries(['passed','failed','blocked'].map(s=>[s,results.filter(r=>r.status===s).length]));context.results=results;
await mkdir(join(root,'results'),{recursive:true});const output=join(root,'results',`api-${stamp}.json`);await writeFile(output,JSON.stringify(context,null,2));await writeFile(join(root,'results','latest.json'),JSON.stringify(context,null,2));console.log(JSON.stringify({summary:context.summary,output},null,2));process.exitCode=context.summary.failed||context.summary.blocked?1:0;
