import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const project=process.env.APP_ROOT||join(root,'../..');
const require=createRequire(join(project,'package.json'));
const {chromium}=require('playwright');
const base=process.env.UI_URL||'http://127.0.0.1:4317';
const output=join(root,'results','ui-'+Date.now());await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'ar-SA'});
const page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message,url:page.url()}));
page.on('console',m=>{if(m.type()==='error'&&!(m.text().includes('401')&&m.location().url.includes('/api/session')))errors.push({type:'console',message:m.text(),url:page.url()});});
page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText||''))errors.push({type:'requestfailed',message:r.failure()?.errorText,url:r.url()});});
try{
  await page.goto(base,{waitUntil:'networkidle'});await page.screenshot({path:join(output,'landing-desktop.png'),fullPage:true});
  // The live server creates an isolated demo tenant; no fixture is injected into application state.
  const login=await context.request.post(base+'/api/auth/demo',{data:{role:'cfo'}});if(!login.ok())throw Error('Demo session failed '+login.status());const session=await login.json();
  const seed=await context.request.post(base+'/api/demo/seed',{data:{},headers:{'X-CSRF-Token':session.csrfToken}});if(!seed.ok())throw Error('Demo seed failed '+seed.status());const job=await seed.json();
  if(job.job_id){for(let i=0;i<90;i++){const r=await context.request.get(base+'/api/jobs/'+job.job_id);const j=await r.json();if(j.status==='completed')break;if(j.status==='failed')throw Error('Real demo extraction failed: '+j.error);if(i===89)throw Error('Demo extraction timeout');await new Promise(r=>setTimeout(r,500));}}
  await page.reload({waitUntil:'networkidle'});
  const links=await page.locator('nav a[href], aside a[href]').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),label:n.textContent.trim()})));
  const routes=process.env.UI_ROUTES?process.env.UI_ROUTES.split(',').map(href=>({href,label:href})):links;
  if(!routes.length)throw Error('No observed navigation links; supply verified UI_ROUTES');
  const unique=[...new Map(routes.map(x=>[x.href,x])).values()].filter(x=>x.href&&!/^https?:\/\//.test(x.href));
  for(const viewport of [{width:1440,height:1000,name:'desktop'},{width:390,height:844,name:'mobile'},{width:720,height:900,name:'narrow-reflow'}]){
    await page.setViewportSize(viewport);
    for(let i=0;i<unique.length;i++){
      const route=unique[i];await page.goto(new URL(route.href,base).href,{waitUntil:'networkidle'});await page.getByRole('heading',{level:1}).waitFor();await page.locator('#main .loading').waitFor({state:'hidden'});await page.waitForTimeout(route.href.includes('overview')?1800:300);
      const state=await page.evaluate(()=>({title:document.title,dir:document.documentElement.dir,inner:innerWidth,scroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,bodyFont:getComputedStyle(document.body).fontSize,textLength:document.body.innerText.length,heading:document.querySelector('h1')?.textContent,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2)&&getComputedStyle(e).position!=='fixed';}).slice(0,12).map(e=>({tag:e.tagName,cls:String(e.className),text:e.textContent.slice(0,60)}))}));
      await page.screenshot({path:join(output,`${viewport.name}-${i}-${route.href.replace(/\W+/g,'_')}.png`),fullPage:true});
      results.push({viewport:viewport.name,route:route.href,label:route.label,...state,bodyOverflow:state.scroll>state.inner+1||state.bodyScroll>state.inner+1});
    }
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(base,{waitUntil:'networkidle'});await page.keyboard.press('Tab');
  const focus=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent.slice(0,80),outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,boxShadow:s.boxShadow,rect:e.getBoundingClientRect().toJSON()};});
  await page.screenshot({path:join(output,'keyboard-focus.png'),fullPage:true});
  await writeFile(join(output,'results.json'),JSON.stringify({base,results,errors,focus,notes:['API-created demo is real persistent server state. This route audit is not a substitute for visible-form workflows.','Narrow viewport checks reflow; it is not a certified OS/browser 200% zoom accessibility audit.']},null,2));
  console.log(JSON.stringify({output,routes:unique.length,screens:results.length,bodyOverflows:results.filter(r=>r.bodyOverflow).map(r=>[r.viewport,r.route]),errors,focus},null,2));
  if(errors.length||results.some(r=>r.bodyOverflow||r.textLength<100))process.exitCode=1;
}catch(e){await writeFile(join(output,'error.json'),JSON.stringify({error:e.message,errors,results},null,2));console.error(e);process.exitCode=1;}finally{await browser.close();}
