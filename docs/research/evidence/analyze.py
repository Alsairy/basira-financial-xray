import json,csv,math,re,hashlib
from pathlib import Path
from openpyxl.formula.tokenizer import Tokenizer
from openpyxl.utils.cell import range_boundaries,get_column_letter

OUT=Path(__file__).resolve().parent
d=json.loads((OUT/'full_cell_extraction.json').read_text())
cells={s['name']:{c['cell']:c for c in s['cells']} for s in d['sheets']}
memo={}
def cell(sheet,address):
    address=address.replace('$','')
    key=(sheet,address)
    if key in memo:return memo[key]
    c=cells[sheet].get(address)
    if c is None:return 0
    value=c['value']
    if c['type']=='f': value=Parser(sheet,value).parse()
    memo[key]=value
    return value
def ref(sheet,address):
    if '!' in address:
        sheet,address=address.rsplit('!',1);sheet=sheet.strip("'").replace("''", "'")
    address=address.replace('$','')
    if ':' not in address:return cell(sheet,address)
    c1,r1,c2,r2=range_boundaries(address)
    return [cell(sheet,f'{get_column_letter(c)}{r}') for r in range(r1,r2+1) for c in range(c1,c2+1)]
class Parser:
    precedence={'=':1,'<>':1,'<':1,'>':1,'<=':1,'>=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5}
    def __init__(self,sheet,formula):self.sheet=sheet;self.t=[x for x in Tokenizer(formula).items if x.type!='WHITE-SPACE'];self.i=0
    def parse(self,minp=0):
        tok=self.t[self.i];self.i+=1
        if tok.type=='OPERAND':
            if tok.subtype=='RANGE':left=ref(self.sheet,tok.value)
            elif tok.subtype=='NUMBER':left=float(tok.value)
            elif tok.subtype=='TEXT':left=tok.value[1:-1].replace('""','"')
            elif tok.subtype=='LOGICAL':left=tok.value=='TRUE'
            else:raise ValueError(tok)
        elif tok.type=='OPERATOR-PREFIX':left=self.parse(6)*(-1 if tok.value=='-' else 1)
        elif tok.type=='PAREN' and tok.subtype=='OPEN':left=self.parse();self.i+=1
        elif tok.type=='FUNC' and tok.subtype=='OPEN':
            name=tok.value[:-1];args=[]
            while not(self.t[self.i].type=='FUNC' and self.t[self.i].subtype=='CLOSE'):
                args.append(self.parse())
                if self.t[self.i].type=='SEP':self.i+=1
                else:break
            self.i+=1
            if name=='SUM':left=sum(v for a in args for v in (a if isinstance(a,list) else [a]))
            elif name=='ROUND':left=round(args[0],int(args[1]))
            elif name=='IF':left=args[1] if args[0] else args[2]
            elif name=='AND':left=all(args)
            elif name=='NOT':left=not args[0]
            elif name=='ISNUMBER':left=isinstance(args[0],(int,float)) and not isinstance(args[0],bool)
            elif name=='TEXT':left=format(args[0],'.'+str(len(args[1].partition('.')[2]))+'f')
            else:raise ValueError(name)
        else:raise ValueError(tok)
        while self.i<len(self.t):
            op=self.t[self.i]
            if op.type!='OPERATOR-INFIX' or self.precedence.get(op.value,-1)<minp:break
            self.i+=1; right=self.parse(self.precedence[op.value]+1)
            try:
                if op.value=='+':left=left+right
                elif op.value=='-':left=left-right
                elif op.value=='*':left=left*right
                elif op.value=='/':left=left/right
                elif op.value=='&':left=str(left)+str(right)
                elif op.value=='=':left=left==right
                elif op.value=='<>':left=left!=right
                elif op.value=='<':left=left<right
                elif op.value=='>':left=left>right
                elif op.value=='<=':left=left<=right
                elif op.value=='>=':left=left>=right
                else:raise ValueError(op.value)
            except ZeroDivisionError:left='#DIV/0!'
            except TypeError:
                if op.value in ('<','>','<=','>='):left=False
                else:left='#VALUE!'
        return left

formula_checks=[]
for s in d['sheets']:
    for c in s['cells']:
        if c['type']=='f':
            try:
                result=cell(s['name'],c['cell']); cached=c['cached']
                match=math.isclose(result,cached,rel_tol=1e-10,abs_tol=1e-6) if isinstance(result,(int,float)) and isinstance(cached,(int,float)) else result==cached
                formula_checks.append({'sheet':s['name'],'cell':c['cell'],'computed':result,'cached':cached,'match':match})
            except Exception as e: formula_checks.append({'sheet':s['name'],'cell':c['cell'],'error':str(e)})
(OUT/'formula_reconciliation.json').write_text(json.dumps(formula_checks,ensure_ascii=False,indent=2))

metrics=[]
def metric(name,year,value,unit,formula,inputs,kind='calculated',limits=''):
    metrics.append(dict(metric=name,year=year,value=value,unit=unit,formula=formula,inputs=inputs,kind=kind,limits=limits))
for col,year in zip('CDE',[2023,2024,2025]):
    v=lambda row:cell('03_RAW_DATA',f'{col}{row}')/1000
    cite=lambda *rows:', '.join(f'03_RAW_DATA!{col}{r}' for r in rows)
    raw={8:'revenue',9:'cogs',10:'gross_profit',15:'opex_ex_DA_impairment',16:'depreciation_amortization',17:'impairment',18:'ebit',19:'finance_cost',20:'murabaha_income',26:'zakat',27:'net_income',35:'cash_equivalents',36:'murabaha_deposits',37:'net_receivables',38:'net_contract_assets',44:'current_assets',55:'total_assets',57:'payables_and_other_current_liabilities',58:'current_borrowing',59:'contract_liabilities',61:'current_lease',64:'current_liabilities',65:'noncurrent_borrowing',66:'noncurrent_lease',70:'total_liabilities',79:'total_equity',86:'cfo',87:'cfi',88:'cff'}
    for row,name in raw.items():metric(name,year,v(row),'SAR million','raw value / 1000',cite(row),'workbook source' if cells['03_RAW_DATA'][f'{col}{row}']['type']!='f' else 'workbook formula')
    ratios=[('gross_margin',v(10)/v(8),'ratio','gross_profit / revenue',(10,8)),('ebit_margin',v(18)/v(8),'ratio','ebit / revenue',(18,8)),('net_margin',v(27)/v(8),'ratio','net_income / revenue',(27,8)),('cfo_net_income',v(86)/v(27),'ratio','cfo / net_income',(86,27)),('current_ratio',v(44)/v(64),'times','current_assets / current_liabilities',(44,64)),('quick_ratio_workbook', (v(44)-v(38))/v(64),'times','(CA - contract assets)/CL',(44,38,64)),('cash_ratio_strict',v(35)/v(64),'times','cash equivalents / CL',(35,64)),('cash_deposits_ratio',(v(35)+v(36))/v(64),'times','(cash equivalents + murabaha)/CL',(35,36,64)),('bank_borrowing_equity',(v(58)+v(65))/v(79),'times','borrowing / equity',(58,65,79)),('borrowing_lease_equity',(v(58)+v(65)+v(61)+v(66))/v(79),'times','(borrowing+lease)/equity',(58,65,61,66,79)),('liabilities_assets',v(70)/v(55),'ratio','total liabilities / assets',(70,55)),('interest_cover',v(18)/v(19),'times','EBIT / finance costs',(18,19)),('dso_closing_net_total_sales',365*v(37)/v(8),'days','365 * closing net AR / annual total revenue',(37,8)),('contract_asset_days_closing',365*v(38)/v(8),'days','365 * net contract assets / annual total revenue',(38,8)),('ar_contract_days_closing',365*(v(37)+v(38))/v(8),'days','365 * (net AR + net contract assets) / annual total revenue',(37,38,8)),('dpo_broad_invalid',365*v(57)/v(9),'days','365 * closing broad payables / COGS',(57,9)),('roe_closing',v(27)/v(79),'ratio','NI / closing equity',(27,79)),('roa_closing',v(27)/v(55),'ratio','NI / closing assets',(27,55)),('cash_deposits',v(35)+v(36),'SAR million','cash+murabaha',(35,36)),('net_cash_exleases',v(35)+v(36)-v(58)-v(65),'SAR million','cash+murabaha-borrowing',(35,36,58,65)),('net_cash_incleases',v(35)+v(36)-v(58)-v(65)-v(61)-v(66),'SAR million','cash+murabaha-borrowing-leases',(35,36,58,65,61,66)),('net_working_capital',v(44)-v(64),'SAR million','CA-CL',(44,64)),('revenue_1day',v(8)/365,'SAR million','revenue/365',(8,))]
    for name,val,unit,formula,rows in ratios:metric(name,year,val,unit,formula,cite(*rows))
    if year>2023:
        prev=chr(ord(col)-1);p=lambda r:cell('03_RAW_DATA',f'{prev}{r}')/1000
        for row,name in raw.items():
            if p(row)!=0:metric(name+'_growth',year,v(row)/p(row)-1,'ratio','current / prior - 1',f'03_RAW_DATA!{prev}{row}, '+cite(row))
        metric('roe_average',year,v(27)/((v(79)+p(79))/2),'ratio','NI / mean(opening,closing equity)',cite(27,79)+f', 03_RAW_DATA!{prev}79',limits='Acquisition timing and equity distributions distort simple annual mean')
        metric('roa_average',year,v(27)/((v(55)+p(55))/2),'ratio','NI / mean(opening,closing assets)',cite(27,55)+f', 03_RAW_DATA!{prev}55')
        metric('dso_average_net_total_sales',year,365*((v(37)+p(37))/2)/v(8),'days','365 * mean(opening,closing net AR) / revenue',cite(37,8)+f', 03_RAW_DATA!{prev}37',limits='total not credit revenue; net not gross AR; FY25 acquired AR not timing-adjusted')

g=lambda name,year=2025:next(m['value'] for m in metrics if m['metric']==name and m['year']==year)
assumptions=[]
def scenario(name,value,formula,inputs,assumption,unit='SAR million',effect=''):
    assumptions.append(dict(scenario=name,value=value,unit=unit,formula=formula,inputs=inputs,assumption=assumption,effect=effect,classification='hypothetical sensitivity, not established saving/loss'))
for days in [5,10,15]:scenario(f'collection_{days}_days',g('revenue')/365*days,f'FY25 revenue / 365 * {days}','03_RAW_DATA!E8',f'{days} days earlier collection; revenue level and same-scope receivables held constant',effect='one-time cash timing; no new revenue or guaranteed profit')
for target in [120,90]:scenario(f'closing_net_dso_target_{target}',g('net_receivables')-g('revenue')*target/365,f'FY25 net AR - FY25 revenue * {target}/365','03_RAW_DATA!E37,E8',f'Closing net DSO proxy target {target}, achievable scope not established',effect='one-time conditional cash release')
scenario('contract_asset_10pct',g('net_contract_assets')*.1,'FY25 net contract assets * 10%','03_RAW_DATA!E38','10% accelerated billing followed by actual collection',effect='one-time conditional cash release; may overlap DSO scenario')
for pp in [.005,.01]:scenario(f'gross_margin_plus_{pp*100:g}pp',g('revenue')*pp,'FY25 revenue * margin improvement','03_RAW_DATA!E8',f'{pp*100:g} percentage-point margin increase with sales, opex and volume constant',effect='annualized gross profit sensitivity, before implementation costs and zakat')
scenario('GA_3pct',748.519572*.03,'FY25 G&A * 3%','03_RAW_DATA!E14','3% avoidable G&A, service capacity unchanged',effect='annual cost sensitivity; not verified avoidable spend')
scenario('borrowing_cost_50bp',(g('current_borrowing')+g('noncurrent_borrowing'))*.005,'closing borrowing * 0.5%','03_RAW_DATA!E58,E65','whole closing debt repriced for a year, fees/rate resets and deposits unchanged',effect='annual finance-cost sensitivity; must net foregone deposit income if repaying')
scenario('cash_conversion_back_to_2024',g('cfo')-g('net_income')*g('cfo_net_income',2024),'FY25 CFO - FY25 NI * FY24 CFO/NI','03_RAW_DATA!D86,D27,E86,E27','FY25 cash conversion falls to FY24 ratio with NI unchanged',effect='downside liquidity stress, not forecast or loss')
scenario('zakat_reversal_removed',g('net_income')-69,'FY25 NI - 69','03_RAW_DATA!E27; 09_EXEC_RECOMMENDATION!A10','Workbook narrative approximate SAR69m reversal, subject to exact note33 confirmation',effect='illustrative normalized income, no cash savings')

# External evidence values are captured separately from workbook source.
external={
 'official_annual_report':'https://www.elm.sa/en/investor-relations/financial-information/AnnualReports/elm%202025%20Annual%20Report%20-%20English.pdf',
 'official_signed_fs':'https://www.elm.sa/en/investor-relations/financial-information/FinancialStatements/ELM%20YE25%20FS-EN%20Version%20-%20Signed.pdf',
 'official_results':'https://www.elm.sa/en/investor-relations/financial-information/FinancialStatements/Results%20presentation%20%20-FY2025-EN.pdf',
 'verified_note18_SAR':{'gross_AR_2025':4354837350,'AR_allowance_2025':748333567,'AR_allowance_2024':588703691,'AR_allowance_acquired':96216584,'AR_allowance_charge':63413292,'government_age_over365':759933884,'private_age_over365':597216002,'over365_total':1357149886,'workbook_claim_government_approx':710000000,'workbook_claim_total_approx':1307000000},
 'verified_note19_SAR':{'gross_contract_assets':1343248416,'net_contract_assets':1173197325,'contract_allowance':170051091,'contract_allowance_acquired':807474,'contract_allowance_charge':42297036},
 'external_results_SAR_million_rounded':{'thiqah_revenue_digital':505,'thiqah_revenue_bpo':583,'thiqah_operating_loss':69.7,'thiqah_net_loss':63},
 'cashflow_detail_SAR':{'AR_change_operating':-481019256,'contract_assets_change_operating':-177156910,'payables_change_operating':465636618,'contract_liabilities_change_operating':231991172,'murabaha_income_received':142867423,'PPE_intangibles_purchases':144205897,'CWIP_purchases':185845000,'acquisition_net_cash_out':3141074348,'loan_drawdown':1900000000,'dividends_paid':661212437},
 'reclassification_note39_SAR':{'FY2024_cost_of_revenue_reduction':5371520,'FY2024_GA_increase':5371520},
 'verification_limit':'Retrieved indexed official tables using web search; direct PDF download/open failed. No independent access to all acquisition/cash/debt note pages.'}
ex=external['external_results_SAR_million_rounded'];thi=ex['thiqah_revenue_digital']+ex['thiqah_revenue_bpo']
external['derived']={'gross_AR_days':4354.837350/g('revenue')*365,'age_over365_gross_AR_pct':1357.149886/4354.837350,'AR_allowance_coverage':748.333567/4354.837350,'AR_allowance_growth_acquired_share':96.216584/(748.333567-588.703691),'thiqah_contribution_revenue_rounded':thi,'growth_ex_thiqah_approx':(g('revenue')-thi)/g('revenue',2024)-1,'thiqah_share_total_revenue_growth_approx':thi/(g('revenue')-g('revenue',2024)),'CFO_after_PPE_CWIP':g('cfo')-144.205897-185.845,'operating_AR_contract_outflow':481.019256+177.156910,'operating_payables_contract_inflow':465.636618+231.991172,'contract_assets_increase_not_in_operating_cashflow':(g('net_contract_assets')-g('net_contract_assets',2024))-177.156910,'cash_deposits_year_increase':g('cash_deposits')-g('cash_deposits',2024)}

for m in metrics:
    if m['metric'] in ('cash_deposits','cash_deposits_ratio','net_cash_exleases','net_cash_incleases'):
        m['limits']='Includes full balance-sheet murabaha deposits. Analytical definition only, not confirmed immediately available funds, distributable surplus, or a covenant measure. Deposit maturities/restrictions and operating cash needs not fully reviewed.'
allout={'source_sha256':d['sha256'],'unit_note':'Workbook financial figures SAR thousands, divided by1000 here to SAR million. Ratios unrounded unless presented. 365 days retained consistently incl leap year2024 for comparability.','metrics':metrics,'scenarios':assumptions,'external_evidence':external,'formula_verification':{'formulas':len(formula_checks),'matched':sum(c.get('match',False) for c in formula_checks),'errors':[c for c in formula_checks if not c.get('match',False)]}}
(OUT/'calculations.json').write_text(json.dumps(allout,ensure_ascii=False,indent=2))
for filename,rows in [('calculations.csv',metrics),('scenarios.csv',assumptions)]:
    with (OUT/filename).open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0].keys()));writer.writeheader();writer.writerows(rows)
print(json.dumps({'formula_verification':allout['formula_verification'],'metrics_count':len(metrics),'scenarios':assumptions,'external_derived':external['derived']},ensure_ascii=False,indent=2))
