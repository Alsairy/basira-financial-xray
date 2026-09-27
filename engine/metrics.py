from decimal import Decimal
from .common import Facts,EngineError,number,output,ref

META={
'revenue_growth':('نمو الإيراد','Revenue growth','growth','percent','(revenue / prior revenue - 1) × 100'),
'ebit_growth':('نمو الربح التشغيلي','Operating profit growth','growth','percent','(EBIT / prior EBIT - 1) × 100'),
'gross_margin':('هامش إجمالي الربح','Gross margin','profitability','percent','gross profit / revenue × 100'),
'ebit_margin':('الهامش التشغيلي','Operating margin','profitability','percent','EBIT / revenue × 100'),
'net_margin':('هامش صافي الربح','Net margin','profitability','percent','consolidated net income / revenue × 100'),
'sga_ratio':('المصروف البيعي والإداري إلى الإيراد','SG&A / revenue','profitability','percent','source-defined SG&A / revenue × 100'),
'ebitda':('الربح قبل التمويل والضريبة والاستهلاك','EBITDA','profitability','currency','EBIT + depreciation and amortization included in EBIT'),
'ebitda_margin':('هامش EBITDA','EBITDA margin','profitability','percent','EBITDA / revenue × 100'),
'cfo_to_net_income':('تحويل صافي الربح إلى نقد','Cash conversion of net income','cash','percent','consolidated CFO / consolidated net income × 100'),
'operating_cash_margin':('هامش النقد التشغيلي','Operating cash margin','cash','percent','CFO / revenue × 100'),
'free_cash_flow':('التدفق النقدي الحر','Free cash flow','cash','currency','CFO - cash capital expenditure (excluding acquisitions)'),
'current_ratio':('نسبة التداول','Current ratio','liquidity','multiple','current assets / current liabilities'),
'quick_ratio':('تغطية الأصول السريعة','Quick ratio','liquidity','multiple','eligible quick assets / current liabilities'),
'cash_ratio':('تغطية النقد المؤهل','Eligible cash ratio','liquidity','multiple','eligible cash / current liabilities'),
'operating_working_capital':('رأس المال العامل التشغيلي','Operating working capital','working_capital','currency','receivables + contract assets + inventory - trade payables - contract liabilities'),
'receivables_days':('أيام رصيد الذمم الختامي التقريبي','Closing receivables days proxy','working_capital','days','closing receivables / total revenue × days'),
'dso':('أيام التحصيل بمتوسط الأرصدة','DSO using average receivables','working_capital','days','average comparable receivables / credit sales × days'),
'dio':('أيام المخزون','Inventory days','working_capital','days','average inventory / related cost of sales × days'),
'dpo':('أيام الموردين','Supplier payable days','working_capital','days','average supplier payables / credit purchases × days'),
'ccc':('دورة تحويل النقد','Cash conversion cycle','working_capital','days','DSO + DIO - DPO'),
'contract_assets_ratio':('أصول العقود إلى الإيراد','Contract assets / revenue','working_capital','percent','closing contract assets / revenue × 100'),
'net_debt':('صافي الدين وفق النقد المؤهل','Net debt using eligible cash','funding','currency','current + noncurrent borrowings + eligible leases - eligible cash'),
'net_debt_to_ebitda':('صافي الدين إلى EBITDA','Net debt / EBITDA','funding','multiple','net debt / positive EBITDA'),
'interest_coverage':('تغطية تكلفة التمويل','Finance cost coverage','funding','multiple','EBIT / finance cost'),
'roa':('العائد على متوسط الأصول','Return on average assets','returns','percent','consolidated net income / average assets × 100'),
'roe':('العائد على متوسط حقوق الملكية','Return on average equity','returns','percent','parent net income / average parent equity × 100'),
'roic':('العائد على رأس المال المستثمر','Return on invested capital','returns','percent','approved NOPAT / average invested capital × 100'),
'organic_growth':('النمو على نطاق متماثل','Like-for-like growth','growth','percent','(current comparable revenue / prior comparable revenue - 1) × 100'),
'customer_concentration':('تركيز أكبر عميل','Largest customer concentration','profitability','percent','largest customer revenue / revenue × 100'),
'allowance_coverage':('تغطية مخصص الذمم','Receivables allowance coverage','working_capital','percent','AR allowance / gross receivables × 100'),
'overdue_receivables_ratio':('الذمم بعد الاستحقاق','Past-due receivables ratio','working_capital','percent','receivables past contractual due date / gross receivables × 100'),
'dscr':('تغطية خدمة الدين','Debt service coverage','funding','multiple','contract-defined cash available for debt service / debt service'),
'covenant_headroom':('هامش التعهد','Covenant headroom','funding','multiple','limit - actual for maximum; actual - limit for minimum'),
'customer_profit':('ربح العميل بعد تكلفة الخدمة','Customer profit after service cost','profitability','currency','customer revenue - approved allocated service cost'),
'liquidity_forecast':('النقد المتوقع من نموذج معتمد','Cash from approved forecast','liquidity','currency','approved forecast cash; no forecast inferred from annual history'),
}

def eligible_cash(data,p):
    cash=data.get('cash',p);restricted=data.get('restricted_cash',p)
    sources=['cash'];notes=[];proxy=False
    if cash is None:return None,sources,False,[]
    if restricted is not None:
        cash-=restricted;sources.append('restricted_cash')
        if cash<0:return None,sources,True,['Restricted cash exceeds cash balance.']
    deposits=data.get('eligible_deposits',p)
    if deposits is not None:cash+=deposits;sources.append('eligible_deposits')
    elif data.get('deposits_eligible',p)==1 and data.get('deposits',p) is not None:
        cash+=data.get('deposits',p);sources+=['deposits','deposits_eligible']
    elif data.get('deposits',p) not in (None,0):
        proxy=True;sources.append('deposits');notes.append('Murabaha/deposits excluded pending maturity and restriction review; this does not establish a liquidity shortfall.')
    return cash,sources,proxy,notes

def analyze(facts,settings=None):
    settings=settings or {};data=Facts(facts)
    days=number(settings.get('days',365),False)
    if days<1 or days>366:raise EngineError('days must be between1 and366')
    materiality=number(settings.get('materiality_pct',1),False)
    if materiality<0 or materiality>100:raise EngineError('materiality_pct must be0–100')
    if not isinstance(settings.get('include_leases',True),bool):raise EngineError('include_leases must be boolean')
    metrics=[];lookup={}
    for p in data.periods:
        prior=data.prior(p)
        def add(key,value=None,inputs=(),status='ok',ar='',en='',prior_inputs=(),**extra):
            if value is None and status in ('ok','proxy'):status='insufficient_data'
            if not data.compatible(inputs,p):value=None;status='insufficient_data';ar='عملة أو نطاق المدخلات غير متجانس.';en='Inputs have incompatible currency or reporting scope.'
            if prior_inputs:
                fs=[data.fact(c,t) for t,cs in [(p,inputs),(prior,prior_inputs)] for c in cs]
                fs=[f for f in fs if f and f.get('value') is not None]
                if len({f.get('currency','SAR') for f in fs if f.get('unit','currency')=='currency'})>1 or len({f.get('scope','consolidated') for f in fs})>1:
                    value=None;status='insufficient_data';ar='المقارنة غير متجانسة في العملة أو نطاق التوحيد.';en='Prior/current inputs have incompatible currencies or reporting scopes.'
            if value is None and not ar:ar='المدخلات الموثقة أو المقارنة اللازمة غير متاحة؛ لا يعوض المفقود بصفر.'
            if value is None and not en:en='Required documented inputs or comparable opening balance are unavailable; missing is not zero.'
            a,e,g,u,formula=META[key]
            result={'id':f'{key}:{p}','key':key,'period':p,'label_ar':a,'label_en':e,'value':output(value),'unit':u,'status':status,'formula':formula,'inputs':data.ids(inputs,p)+data.ids(prior_inputs,prior),'source_refs':data.refs(inputs,p)+data.refs(prior_inputs,prior),'explanation_ar':ar,'explanation_en':en,'group':g,**extra}
            prev=lookup.get((key,prior))
            if value is not None and prev and prev['value'] is not None:result.update(prior_value=prev['value'],delta=output(value-number(prev['value'])))
            metrics.append(result);lookup[(key,p)]=result;return value
        def ratio(key,numerator,denominator,inputs,multiplier=Decimal(1),**kwargs):
            if denominator is not None and denominator<=0:
                kwargs.update(status='invalid_denominator',ar='المقام صفر أو سالب؛ اعرض القيم والتغير المطلق.',en='Denominator is zero or negative; use source values and absolute change.')
                return add(key,inputs=inputs,**kwargs)
            result=numerator/denominator*multiplier if numerator is not None and denominator is not None else None
            return add(key,result,inputs,**kwargs)
        def get(c):return data.get(c,p)
        for key,c in [('revenue_growth','revenue'),('ebit_growth','ebit')]:
            previous=data.get(c,prior);current=get(c)
            if previous is not None and previous<=0:add(key,inputs=[c],prior_inputs=[c],status='invalid_denominator',ar='أساس المقارنة صفر أو سالب؛ نسبة النمو غير صالحة.',en='Prior base is zero or negative; growth percentage is not meaningful.')
            else:add(key,(current/previous-1)*100 if current is not None and previous is not None else None,[c],prior_inputs=[c],ar='افصل الاستحواذ وتغير نطاق التوحيد قبل تفسير النمو.',en='Separate acquisitions and reporting-scope changes before interpreting growth.')
        for key,num,den in [('gross_margin','gross_profit','revenue'),('ebit_margin','ebit','revenue'),('net_margin','net_income','revenue'),('sga_ratio','sga','revenue'),('cfo_to_net_income','cfo','net_income'),('operating_cash_margin','cfo','revenue')]:
            ratio(key,get(num),get(den),[num,den],Decimal(100))
        ebitda=data.sum(['ebit','depreciation_amortization'],p)
        add('ebitda',ebitda,['ebit','depreciation_amortization'],status='proxy' if ebitda is not None else 'insufficient_data',ar='تحقق أن الاستهلاك والإطفاء مدرجان داخل EBIT مرة واحدة. ليس EBITDA معدلًا.',en='Verify D&A is included once in EBIT. This is not adjusted EBITDA.')
        ratio('ebitda_margin',ebitda,get('revenue'),['ebit','depreciation_amortization','revenue'],Decimal(100),status='proxy' if ebitda is not None else 'insufficient_data',ar='على تعريف EBITDA المبين؛ دون تعديلات غير متكررة.',en='Uses the stated EBITDA definition without non-recurring adjustments.')
        add('free_cash_flow',get('cfo')-abs(get('capex')) if get('cfo') is not None and get('capex') is not None else None,['cfo','capex'],ar='الإنفاق الرأسمالي النقدي وحده؛ الاستحواذات والإيجارات منفصلة.',en='Cash capex only; acquisitions and lease payments are separate.')
        ratio('current_ratio',get('current_assets'),get('current_liabilities'),['current_assets','current_liabilities'])
        cash,cash_refs,cash_proxy,cash_notes=eligible_cash(data,p)
        quick=get('quick_assets');quick_refs=['quick_assets','current_liabilities'];quick_proxy=False
        if quick is None and cash is not None and get('receivables') is not None:
            quick=cash+get('receivables');quick_refs=cash_refs+['receivables','current_liabilities'];quick_proxy=True
        ratio('quick_ratio',quick,get('current_liabilities'),quick_refs,status='proxy' if quick_proxy else 'ok',ar='البديل يستخدم النقد المؤهل والذمم فقط؛ تحقق من قابلية التحصيل والسيولة.' if quick_proxy else '',en='Proxy uses eligible cash and receivables only; collectibility and liquidity require review.' if quick_proxy else '')
        ratio('cash_ratio',cash,get('current_liabilities'),cash_refs+['current_liabilities'],status='proxy' if cash_proxy else 'ok',ar='الودائع غير مؤكدة الأهلية مستبعدة؛ يلزم فحص آجالها وقيودها.' if cash_proxy else '',en=' '.join(cash_notes))
        wc_assets=data.sum(['receivables','contract_assets','inventory'],p);wc_liabs=data.sum(['trade_payables','contract_liabilities'],p)
        add('operating_working_capital',wc_assets-wc_liabs if wc_assets is not None and wc_liabs is not None else None,['receivables','contract_assets','inventory','trade_payables','contract_liabilities'])
        ratio('receivables_days',get('receivables'),get('revenue'),['receivables','revenue'],days,status='proxy',ar='رصيد ختامي وإيراد كلي؛ ليس متوسط سداد الفواتير ولا مبيعات آجلة.',en='Closing balance / total sales proxy, not observed invoice collection time or credit-sales DSO.')
        dso=ratio('dso',data.average('receivables',p),get('credit_sales'),['receivables','credit_sales'],days,prior_inputs=['receivables'],ar='يلزم تطابق صافي/إجمالي الذمم والضريبة ونطاق الاستحواذ مع المبيعات الآجلة.',en='Align receivable gross/net basis, VAT and acquisition scope with credit sales.')
        if get('inventory')==0:
            dio=Decimal(0);add('dio',None,['inventory'],status='not_applicable',ar='لا يوجد مخزون معلن؛ يعامل بصفر داخل دورة النقد فقط إن تأهلت بقية المكونات.',en='Reported inventory is zero; only the structural inventory component is zero in an otherwise eligible CCC.')
        else:dio=ratio('dio',data.average('inventory',p),get('cogs'),['inventory','cogs'],days,prior_inputs=['inventory'])
        dpo=ratio('dpo',data.average('trade_payables',p),get('purchases'),['trade_payables','purchases'],days,prior_inputs=['trade_payables'],ar='لا تستخدم الدائنين والمستحقات العامة بدل الموردين أو تكلفة الخدمات بدل المشتريات.',en='Broad payables/accruals are not supplier balances; service costs are not credit purchases.')
        add('ccc',dso+dio-dpo if all(v is not None for v in (dso,dio,dpo)) else None,['receivables','credit_sales','inventory','cogs','trade_payables','purchases'],prior_inputs=['receivables','inventory','trade_payables'])
        ratio('contract_assets_ratio',get('contract_assets'),get('revenue'),['contract_assets','revenue'],Decimal(100),ar='أصل العقد ليس نقدًا ولا فاتورة مستحقة؛ افصل الأرصدة المكتسبة.',en='Contract assets are not cash or billed receivables; separate acquired balances.')
        debt_refs=['borrowing_current','borrowing_noncurrent']+(['lease_current','lease_noncurrent'] if settings.get('include_leases',True) else [])
        debt=data.sum(debt_refs,p);net_debt=debt-cash if debt is not None and cash is not None else None
        extra={}
        if debt is not None and get('cash') is not None and get('deposits') is not None:extra['including_all_deposits_value']=output(debt-get('cash')-get('deposits'))
        add('net_debt',net_debt,debt_refs+cash_refs,status='proxy' if cash_proxy else 'ok',ar='نقد مؤهل فقط؛ الودائع غير مؤكدة السيولة مستبعدة. لا يثبت هذا وحده ضغطًا ماليًا.' if cash_proxy else '',en='Eligible cash only; unverified deposits excluded. This alone does not establish financial distress.' if cash_proxy else '',**extra)
        ratio('net_debt_to_ebitda',net_debt,ebitda,debt_refs+cash_refs+['ebit','depreciation_amortization'],status='proxy' if cash_proxy or ebitda is not None else 'ok',ar='راجع تعريف النقد وEBITDA والإيجارات؛ لا يساوي تعهدًا تعاقديًا تلقائيًا.',en='Cash, EBITDA and lease policies must be reviewed; this is not automatically a contractual covenant.')
        ratio('interest_coverage',get('ebit'),get('finance_cost'),['ebit','finance_cost'],ar='تغطية مصروف التمويل لا تقيس سداد الأصل أو آجال النقد.',en='Finance-cost coverage does not measure principal repayments or cash maturities.')
        ratio('roa',get('net_income'),data.average('total_assets',p),['net_income','total_assets'],Decimal(100),prior_inputs=['total_assets'],ar='متوسط رصيدين؛ قد يتطلب الاستحواذ متوسطًا مرجحًا زمنيًا.',en='Two-point average; acquisitions may require time-weighted balances.')
        parent=get('net_income_parent') is not None and get('equity_parent') is not None
        profit,equity=('net_income_parent','equity_parent') if parent else ('net_income','equity')
        ratio('roe',get(profit),data.average(equity,p),[profit,equity],Decimal(100),prior_inputs=[equity],status='ok' if parent else 'proxy',ar='متوسط ملكية الأم.' if parent else 'الربح والملكية الموحدان متطابقا النطاق؛ ليس عائد مساهمي الأم منفردًا.',en='Average parent equity.' if parent else 'Uses matched consolidated profit and equity, not parent-only return.')
        ratio('roic',get('nopat'),data.average('invested_capital',p),['nopat','invested_capital'],Decimal(100),prior_inputs=['invested_capital'])
        numerator,denominator=get('organic_revenue_current'),get('organic_revenue_prior')
        ratio('organic_growth',numerator-denominator if numerator is not None and denominator is not None else None,denominator,['organic_revenue_current','organic_revenue_prior'],Decimal(100))
        for key,num,den in [('customer_concentration','largest_customer_revenue','revenue'),('allowance_coverage','ar_allowance','gross_receivables'),('overdue_receivables_ratio','overdue_receivables','gross_receivables'),('dscr','cfads','debt_service')]:
            ratio(key,get(num),get(den),[num,den],Decimal(1) if key=='dscr' else Decimal(100))
        limit,actual=get('covenant_limit'),get('covenant_actual');f=data.fact('covenant_limit',p) or {};direction=f.get('comparison')
        headroom=(limit-actual if direction=='maximum' else actual-limit) if limit is not None and actual is not None and direction in ('maximum','minimum') else None
        add('covenant_headroom',headroom,['covenant_limit','covenant_actual'],ar='يلزم نص تعهد واتجاه الحد والفترة؛ القيمة السالبة تستدعي التحقق من المخالفة والاستثناءات.',en='Requires contract threshold direction and period; negative headroom calls for breach/waiver review.')
        add('customer_profit',get('customer_revenue')-get('customer_service_cost') if get('customer_revenue') is not None and get('customer_service_cost') is not None else None,['customer_revenue','customer_service_cost'],ar='يلزم تطابق العميل والفترة واعتماد تخصيص تكلفة الخدمة.',en='Customer, period and service-cost allocation must match.')
        f=data.fact('forecast_cash',p) or {}
        add('liquidity_forecast',get('forecast_cash') if f.get('forecast_approved') is True else None,['forecast_cash'],ar='لا يبنى توقع13 أسبوعًا من القوائم السنوية وحدها؛ يتطلب نموذجًا معتمدًا.',en='A13-week forecast cannot be inferred from annual statements alone; requires an approved forecast model.')
    from .rules import make_findings,make_checks
    return {'engine_version':'0.1.0','periods':data.periods,'metrics':metrics,'findings':make_findings(data,lookup,materiality),'checks':make_checks(data),'policy':{'days':output(days),'include_leases':settings.get('include_leases',True),'percent_values':'0–100','cash_eligibility':'deposits require explicit approval'}}
