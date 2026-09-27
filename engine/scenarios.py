from decimal import Decimal
from .common import Facts,number,output,EngineError

TYPES={'collection_days','gross_margin','opex_reduction','financing_rate','contract_assets'}

def evaluate(facts,scenario):
    if not isinstance(scenario,dict):raise EngineError('scenario must be an object')
    kind=scenario.get('type')
    if kind not in TYPES:raise EngineError('Unsupported scenario type')
    values=[]
    for k in ('low','base','high'):
        v=scenario.get(k)
        if not isinstance(v,(int,float,Decimal)) or isinstance(v,bool):raise EngineError(f'{k} must be a finite JSON number')
        values.append(number(v,False))
    maximum=Decimal(365) if kind=='collection_days' else Decimal(10000) if kind=='financing_rate' else Decimal(100)
    if any(v<0 or v>maximum for v in values):raise EngineError(f'Scenario assumptions must be between0 and{maximum}')
    if not values[0]<=values[1]<=values[2]:raise EngineError('Require low <= base <= high')
    implementation=scenario.get('implementation_cost',0)
    if not isinstance(implementation,(int,float,Decimal)) or isinstance(implementation,bool):raise EngineError('implementation_cost must be numeric')
    implementation=number(implementation,False)
    if implementation<0:raise EngineError('implementation_cost cannot be negative')
    data=Facts(facts)
    if not data.periods:raise EngineError('No facts available','insufficient_data')
    period=str(scenario.get('period') or data.periods[-1])
    if period not in data.periods:raise EngineError('Scenario period is unavailable','insufficient_data')
    days=number(scenario.get('days',365),False)
    if days<1 or days>366:raise EngineError('days must be1–366')
    ar=[];en=[];proxy=False
    if kind=='collection_days':
        source='credit_sales' if data.get('credit_sales',period) is not None else 'revenue'
        amount=data.get(source,period);inputs=[source];factor=Decimal(1)/days;effect='cash_release';group='receivables_and_billing'
        formula=f'{source} / {days} × reduction_days'
        proxy=source=='revenue'
        ar=['توقيت نقدي لمرة واحدة مع ثبات الإيراد ونطاق الذمم.','الهدف افتراض يحتاج اختبارًا؛ لا يمثل وفرًا أو ربحًا مؤكدًا.']
        en=['One-time cash timing at constant sales and receivable scope.','Target is a testable assumption, not an established saving or profit.']
        if proxy:ar.append('استُخدم إجمالي الإيرادات لغياب المبيعات الآجلة؛ النتيجة تقريبية.');en.append('Total revenue substitutes for unavailable credit sales; result is a proxy.')
    elif kind=='gross_margin':
        amount=data.get('revenue',period);inputs=['revenue'];factor=Decimal('.01');effect='annual_profit';group='margin_and_cost'
        formula='revenue × improvement_percentage_points / 100'
        ar=['المدخل نقاط مئوية:0.5 يعني نصف نقطة.','أثر على إجمالي الربح السنوي عند ثبات الإيراد؛ أثر EBIT مشروط بثبات المصروفات الأخرى.']
        en=['Input is percentage points:0.5 means half a point.','Annual gross-profit sensitivity at constant revenue; EBIT impact requires unchanged other operating expenses.']
        gp=data.get('gross_profit',period)
        if amount is not None and amount>0 and gp is not None and gp/amount*100+values[-1]>100:raise EngineError('Scenario would imply gross margin above100%')
    elif kind=='opex_reduction':
        source='sga' if data.get('sga',period) is not None else 'gna'
        amount=data.get(source,period);inputs=[source];factor=Decimal('.01');effect='annual_profit';group='margin_and_cost'
        formula=f'{source} × assumed_reduction_percent / 100'
        ar=[f'يستخدم بند {source} كما عرّفه المصدر.','النسبة ليست تقديرًا للهدر؛ يلزم إثبات قابلية تجنب المصروف مع الحفاظ على الخدمة.']
        en=[f'Uses source-defined {source}.','Percentage does not estimate waste; avoidable cost and preserved service must be established.']
    elif kind=='financing_rate':
        inputs=['borrowing_current','borrowing_noncurrent'];amount=data.sum(inputs,period);factor=Decimal('.0001');effect='financing_saving';group='financing_cost'
        formula='closing bank borrowings × assumed_basis_point_reduction / 10000'
        ar=['المدخل نقاط أساس:50 يعني0.5 نقطة مئوية.','يفترض إعادة تسعير كامل رصيد الإقفال لسنة؛ قبل الرسوم والقيود والعائد الضائع إن سُدد الدين من الودائع.']
        en=['Input is basis points:50 means0.5 percentage points.','Assumes full closing debt repriced for one year, before fees, restrictions and forgone deposit returns if repaid from deposits.']
    else:
        inputs=['contract_assets'];amount=data.get('contract_assets',period);factor=Decimal('.01');effect='cash_release';group='receivables_and_billing'
        formula='contract_assets × assumed_accelerated_percent / 100'
        ar=['تحويل أصل العقد إلى فاتورة لا يحرر نقدًا حتى يُحصّل.','الأثر النقدي مشروط بالفوترة والسداد ويتداخل مع سيناريو التحصيل؛ لا يجمع تلقائيًا.']
        en=['Turning a contract asset into an invoice releases no cash until collection.','Cash impact is conditional on billing and payment and overlaps collection scenarios; do not automatically aggregate.']
    if amount is None:raise EngineError('Required scenario inputs are missing or conflicting','insufficient_data')
    if amount<=0:raise EngineError('Scenario base must be positive','invalid_denominator')
    if not data.compatible(inputs,period):raise EngineError('Scenario currencies/reporting scopes are incompatible','incompatible_inputs')
    fs=[data.fact(c,period) for c in inputs];currency=next((f.get('currency','SAR') for f in fs if f),'SAR')
    outputs=[amount*v*factor for v in values]
    ar.append('الحالات بدائل وليست مبالغ تجمع؛ تكلفة التنفيذ منفصلة.');en.append('Cases are alternatives, not additive amounts; implementation cost is separate.')
    result={'type':kind,'effect_type':effect,'low':output(outputs[0]),'base':output(outputs[1]),'high':output(outputs[2]),'currency':currency,'unit':'currency','formula':formula,'source_refs':data.refs(inputs,period),'inputs':data.ids(inputs,period),'period':period,'assumptions_ar':ar,'assumptions_en':en,'dependency_group':group,'status':'proxy' if proxy else 'ok','assumption_unit':'days' if kind=='collection_days' else 'percentage_points' if kind=='gross_margin' else 'basis_points' if kind=='financing_rate' else 'percent','assumption_values':dict(zip(('low','base','high'),map(output,values))),'implementation_cost':output(implementation),'recurring':effect!='cash_release','aggregation_policy':'alternative_cases; do_not_sum_overlapping_dependency_group; never_sum_cash_release_with_profit','engine_version':'0.1.0'}
    rate=scenario.get('financing_rate')
    if rate is not None:
        if not isinstance(rate,(int,float,Decimal)) or isinstance(rate,bool):raise EngineError('financing_rate must be numeric annual percent')
        rate=number(rate,False)
        if not 0<=rate<=100:raise EngineError('financing_rate must be annual percent0–100')
        if effect=='cash_release':
            result['conditional_annual_financing_saving']={k:output(v*rate/100) for k,v in zip(('low','base','high'),outputs)}
            result['financing_rate_unit']='annual_percent'
            result['assumptions_ar'].append('وفر التمويل الإضافي يفترض استخدام النقد فعليًا لخفض دين بهذه التكلفة لسنة؛ يعرض منفصلًا عن السيولة.')
            result['assumptions_en'].append('Additional financing saving assumes cash actually reduces debt at this annual rate for a year; shown separately from liquidity.')
    return result
