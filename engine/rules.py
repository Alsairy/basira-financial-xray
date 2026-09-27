from decimal import Decimal
from .common import output,number,ref

def make_checks(data):
    checks=[]
    def check(key,ar,en,p,cs,calculate):
        values=[data.get(c,p) for c in cs]
        if any(v is None for v in values):
            checks.append({'id':f'{key}:{p}','label_ar':ar,'label_en':en,'status':'warning','details_ar':'المصالحة غير مكتملة بسبب مدخلات مفقودة أو متعارضة.','details_en':'Reconciliation unavailable because inputs are missing or conflicting.','source_refs':data.refs(cs,p)})
            return
        difference=calculate(*values)
        # Display-rounding tolerance, independent of materiality thresholds.
        fs=[data.fact(c,p) for c in cs]
        precision=[]
        for f in fs:
            scale=number(f.get('scale',1)) or Decimal(1)
            original=number(f.get('original_value'))
            quantum=Decimal(1).scaleb(original.as_tuple().exponent) if original is not None else Decimal(1)
            precision.append(scale*min(abs(quantum),Decimal(1)))
        tolerance=max(Decimal(1),sum(precision)/2)
        good=abs(difference)<=tolerance and data.compatible(cs,p)
        checks.append({'id':f'{key}:{p}','label_ar':ar,'label_en':en,'status':'pass' if good else 'fail','difference':output(difference),'tolerance':output(tolerance),'details_ar':'متصالح ضمن دقة العرض.' if good else 'فرق مصالحة أو عدم تجانس عملة/نطاق؛ يلزم التصحيح قبل الاعتماد.','details_en':'Reconciles within display precision.' if good else 'Reconciliation difference or currency/scope mismatch requires review before approval.','source_refs':data.refs(cs,p)})
    for p in data.periods:
        check('balance_sheet','توازن الميزانية','Balance-sheet equation',p,['total_assets','total_liabilities','equity'],lambda a,l,e:a-l-e)
        check('gross_profit','تسوية إجمالي الربح','Gross-profit reconciliation',p,['revenue','cogs','gross_profit'],lambda r,c,g:r-abs(c)-g)
        check('net_income','تسوية صافي الربح والزكاة','Net-income and zakat reconciliation',p,['ebt','zakat','net_income'],lambda b,z,n:b-z-n)
        check('cash_rollforward','حركة النقد','Cash roll-forward',p,['cash_beginning','cfo','cfi','cff','cash_fx','cash_ending'],lambda b,o,i,f,x,e:b+o+i+f+x-e)
        check('cash_to_balance_sheet','نقد التدفقات والميزانية','Cash-flow / balance-sheet tie',p,['cash_ending','cash'],lambda a,b:a-b)
        check('assets_components','مكونات الأصول','Asset components',p,['current_assets','noncurrent_assets','total_assets'],lambda a,b,c:a+b-c)
        check('liabilities_components','مكونات الالتزامات','Liability components',p,['current_liabilities','noncurrent_liabilities','total_liabilities'],lambda a,b,c:a+b-c)
    for c,p in data.conflicts:
        checks.append({'id':f'conflict:{c}:{p}','label_ar':'قيم متعارضة لنفس المفهوم والفترة','label_en':'Conflicting fact values','status':'fail','details_ar':f'{c}، {p}: احتفظ بالمصادر وحدد القيمة المعتمدة؛ لم يختر المحرك إحداها.','details_en':f'{c}, {p}: conflicting values retained; engine did not silently choose a source.','source_refs':data.refs([c],p)})
    for f in data.invalid:
        checks.append({'id':f'invalid:{f.get("id")}','label_ar':'قيمة أو وحدة غير صالحة','label_en':'Invalid numeric value or unit','status':'fail','details_ar':'قيمة غير منتهية أو خارج المجال أو وحدة لا تطابق المفهوم المالي.','details_en':'Non-finite, out-of-range value, or unit incompatible with the financial concept.','source_refs':[ref(f)]})
    for f in data.facts:
        if not f.get('formula'):continue
        state=f.get('cache_status')
        if state in ('independently_verified','recalculated_no_cache'):continue
        override=f.get('manual_override')
        valid_override=isinstance(override,dict) and isinstance(override.get('reason'),str) and bool(override['reason'].strip()) and f.get('review_status')=='reviewed' and f.get('value') is not None and f not in data.invalid
        try:number(f.get('value'),False)
        except ValueError:valid_override=False
        checks.append({'id':f'formula_unresolved:{f.get("id")}','label_ar':'حل قيمة الصيغة ومطابقة الذاكرة','label_en':'Formula resolution and cache reconciliation','status':'pass' if valid_override else 'fail','details_ar':'اعتمدت قيمة بديلة يدويًا مع سبب موثق مع حفظ الصيغة والقيمة الأصلية.' if valid_override else 'الصيغة غير محلولة أو الذاكرة غير متطابقة؛ مجرد وضع علامة المراجعة لا يكفي. أدخل قيمة بديلة مع سبب ثم راجعها.','details_en':'A documented, reviewed manual value override resolves this formula; original formula and cache remain preserved.' if valid_override else 'Formula is unresolved or its cache differs. Review status alone cannot resolve it; explicitly enter a replacement value with rationale and review it.','source_refs':[ref(f)]})
    unreviewed=sum(f.get('review_status')!='reviewed' for f in data.facts)
    if unreviewed:checks.append({'id':'source_review','label_ar':'مراجعة المصادر','label_en':'Source review','status':'warning','details_ar':f'{unreviewed} قيمة لم تعتمد مراجعتها.','details_en':f'{unreviewed} facts have not been marked reviewed.'})
    if not data.facts:checks.append({'id':'empty_dataset','label_ar':'لا توجد حقائق مالية','label_en':'No financial facts','status':'warning','details_ar':'ارفع بيانات ثم اربط البنود.','details_en':'Upload data and map concepts before analysis.'})
    return checks

def make_findings(data,metrics,materiality):
    findings=[]
    def mv(k,p):
        m=metrics.get((k,p),{});return number(m.get('value'))
    def add(rule,p,title_ar,title_en,summary_ar,summary_en,cs,keys,questions_ar,questions_en,action_ar,action_en,severity='medium',kind='risk',evidence='hypothesis'):
        prev=data.prior(p)
        # Direct fact rules and comparisons between periods need the same scope
        # and currency protection as metrics. Abstain rather than comparing unlike amounts.
        if rule.startswith('R'):
            periods=[p] if rule in ('R05','R08','R10') else [p,prev]
            fs=[data.fact(c,period) for period in periods for c in cs]
            fs=[f for f in fs if f and f.get('value') is not None]
            currencies={f.get('currency','SAR') for f in fs if f.get('unit','currency')=='currency'}
            scopes={f.get('scope','consolidated') for f in fs}
            if len(currencies)>1 or len(scopes)>1:return
        findings.append({'id':f'{rule}:{p}','rule_id':rule,'period':p,'title_ar':title_ar,'title_en':title_en,'summary_ar':summary_ar,'summary_en':summary_en,'severity':severity,'kind':kind,'evidence_status':evidence,'metric_ids':[f'{k}:{p}' for k in keys if (k,p) in metrics],'source_refs':list(dict.fromkeys(data.refs(cs,p)+data.refs(cs,prev))),'questions_ar':questions_ar,'questions_en':questions_en,'action_ar':action_ar,'action_en':action_en})
    for p in data.periods:
        prev=data.prior(p)
        gm,old_gm=mv('gross_margin',p),mv('gross_margin',prev)
        if gm is not None and old_gm is not None and old_gm-gm>=materiality:
            add('R01',p,'تراجع الهامش يحتاج تفكيكًا','Margin decline needs a bridge',f'انخفض الهامش الإجمالي {output(old_gm-gm):.2f} نقطة مئوية؛ السبب غير مثبت.',f'Gross margin decreased {output(old_gm-gm):.2f} percentage points; the cause is not established.',['gross_profit','revenue'],['gross_margin'],['ما أثر السعر والمزيج وتكلفة التنفيذ والاستحواذ؟'],['What changed in price, mix, delivery cost and acquisition scope?'],'أعد جسر الهامش حسب قطاع وعقد.','Build a margin bridge by segment and contract.')
        cv,old_cv=mv('cfo_to_net_income',p),mv('cfo_to_net_income',prev)
        if cv is not None and old_cv is not None and cv<100 and old_cv<100:
            add('R02',p,'النقد لا يواكب الربح لفترتين','Cash conversion below profit for two periods',f'تحويل الربح إلى نقد {output(old_cv):.1f}% ثم {output(cv):.1f}%. لا يثبت ضعف جودة الربح منفردًا.',f'Cash conversion was {output(old_cv):.1f}% then {output(cv):.1f}%; this alone does not prove poor earnings quality.',['cfo','net_income'],['cfo_to_net_income'],['هل السبب موسمية أو رأس مال عامل أو زكاة أو نطاق توحيد؟'],['Is the change seasonal, working-capital related, tax related or scope related?'],'حلل حركة رأس المال العامل والبنود غير النقدية.','Reconcile working-capital and noncash movements.')
        ar,old_ar=data.get('receivables',p),data.get('receivables',prev);rg=mv('revenue_growth',p)
        if ar is not None and old_ar is not None and old_ar>0 and rg is not None and (ar/old_ar-1)*100-rg>=materiality:
            add('R03',p,'الذمم تنمو أسرع من الإيراد','Receivables grow faster than revenue','قارن النمو بعد فصل المبيعات الآجلة والأرصدة المكتسبة؛ الزيادة ليست خسارة نقدية مثبتة.','Compare growth after separating credit sales and acquired balances; the increase is not an established cash loss.',['receivables','revenue'],['receivables_days','revenue_growth'],['هل هناك استحواذ أو تغير شروط سداد أو مطالبات محل خلاف؟'],['Were there acquisitions, payment-term changes or disputed claims?'],'راجع أعمار الذمم والتحصيل اللاحق حسب العميل.','Review receivable ageing and subsequent collections by customer.')
        ca,old_ca=mv('contract_assets_ratio',p),mv('contract_assets_ratio',prev)
        if ca is not None and old_ca is not None and ca-old_ca>=materiality:
            add('R04',p,'ارتفاع أصول العقود نسبة إلى الإيراد','Contract assets increased relative to revenue',f'ارتفعت النسبة {output(ca-old_ca):.2f} نقطة؛ الفوترة وحدها لا تعني تحصيل النقد.',f'The ratio rose {output(ca-old_ca):.2f} percentage points; billing alone is not cash collection.',['contract_assets','revenue'],['contract_assets_ratio'],['ما المراحل المنجزة غير المفوترة وما أثر الاستحواذ؟'],['Which completed milestones are unbilled, and what is the acquisition effect?'],'أعد كشف قبول المراحل ومواعيد الفوترة والتحصيل.','Prepare a milestone acceptance, billing and collection schedule.')
        cash=data.get('cash',p);need=data.get('liquidity_requirements',p);undrawn=data.get('undrawn_facility',p)
        if cash is not None and need is not None and undrawn is not None and cash+undrawn<need:
            add('R05',p,'متطلبات نقدية تتجاوز الموارد المحددة','Documented cash requirements exceed specified resources','المقارنة تخص المدخلات الموثقة فقط؛ تحقق من آجال الودائع والقيود وباقي التدفقات.','Comparison covers documented inputs only; review deposit maturities, restrictions and other cash flows.',['cash','liquidity_requirements','undrawn_facility'],['cash_ratio'],['هل الفترات متطابقة والتسهيل متاح بشروطه؟'],['Are periods aligned and facility terms satisfied?'],'أعد توقع13 أسبوعًا وخطة تمويل معتمدة.','Prepare an approved13-week cash and funding plan.',severity='high')
        debt=data.sum(['borrowing_current','borrowing_noncurrent'],p);old_debt=data.sum(['borrowing_current','borrowing_noncurrent'],prev)
        rev=data.get('revenue',p)
        if debt is not None and old_debt is not None and debt>old_debt and (rev is None or rev<=0 or (debt-old_debt)/rev*100>=materiality):
            add('R06',p,'اقتراض جديد يستلزم مراجعة الآجال','New borrowing warrants maturity review',f'زاد الاقتراض {output(debt-old_debt):,.0f} بوحدة العملة الأصلية. لا يعني ذلك تلقائيًا صافي مديونية أو تعثرًا.',f'Borrowing increased by {output(debt-old_debt):,.0f} currency units. This does not automatically mean net indebtedness or distress.',['borrowing_current','borrowing_noncurrent','cash','deposits'],['net_debt','interest_coverage'],['ما استخدام التمويل ومواعيد السداد والتعهدات؟'],['What are the use of proceeds, maturities and covenants?'],'راجع جدول الدين والنقد المؤهل وتكلفة الاحتفاظ بالودائع.','Review debt maturities, eligible cash and deposit carry cost.')
        ga,old_ga=data.get('gna',p),data.get('gna',prev);rev0=data.get('revenue',prev)
        if all(v is not None for v in (ga,old_ga,rev,rev0)) and rev>0 and rev0>0 and (ga/rev-old_ga/rev0)*100>=materiality:
            add('R07',p,'المصروف الإداري أسرع من النشاط','Administrative expense intensity increased','ارتفعت نسبة G&A؛ يجب فصل التكلفة المكتسبة وغير المتكررة قبل اعتبارها قابلة للتخفيض.','G&A intensity increased; acquired and nonrecurring costs must be separated before treating any amount as avoidable.',['gna','revenue'],['sga_ratio'],['ما التكلفة المتكررة وما مصروف الدمج أو التوسع؟'],['Which costs recur and which relate to integration or expansion?'],'حلل G&A حسب سبب ومركز تكلفة مع الحفاظ على الخدمة.','Analyze G&A by driver and cost center while preserving service.')
        peer=data.get('peer_gross_margin',p);n=data.get('peer_count',p)
        if peer is not None and n is not None and n>=5 and gm is not None and abs(gm-peer)>=materiality:
            add('R08',p,'اختلاف عن مجموعة النظراء المدخلة','Difference from supplied peer cohort','الانحراف يحتاج اعتماد تجانس العينة والتعريف والترخيص؛ ليس حكم أداء تلقائيًا.','Deviation requires confirmation of cohort comparability, definitions and rights; it is not an automatic performance judgment.',['peer_gross_margin','peer_count','gross_profit','revenue'],['gross_margin'],['هل النظراء متماثلون في المزيج والعقود وتعريف الهامش؟'],['Are business mix, contracts and margin definitions comparable?'],'اعتمد مجموعة مقارنة وتعديلات موثقة.','Approve a documented cohort and adjustments.',kind='data_quality',evidence='needs_data')
        ac,old_ac=mv('allowance_coverage',p),mv('allowance_coverage',prev)
        if ac is not None and old_ac is not None and abs(ac-old_ac)>=materiality:
            add('R09',p,'تغير تغطية المخصص يحتاج جسرًا','Allowance coverage change needs a roll-forward','افصل مصروف السنة والمخصص المكتسب والشطب والتحصيل؛ الرصيد ليس خسارة السنة.','Separate current-year charges, acquired allowance, writeoffs and recoveries; the balance is not the current-year loss.',['ar_allowance','gross_receivables'],['allowance_coverage'],['ما حركات الاستحواذ والشطب والافتراضات؟'],['What were acquisition, writeoff and estimation movements?'],'صالح حركة المخصص واعتمادات الائتمان.','Reconcile allowance movements and credit assumptions.')
        actual,target=data.get('action_effect_actual',p),data.get('action_effect_target',p)
        if actual is not None and target is not None and target>0 and actual<target:
            add('R10',p,'أثر المبادرة المقاس دون الهدف','Measured initiative effect below target','إقفال التنفيذ لا يثبت تحقق الأثر؛ راجع فترة القياس والعوامل الخارجية.','Operational completion does not prove financial benefit; review the measurement window and confounders.',['action_effect_actual','action_effect_target'],[],['هل اكتملت فترة الأثر وهل منع احتسابه مرتين؟'],['Is the measurement window complete and double counting prevented?'],'أعد التحقق من الأثر مقابل خط أساس معتمد.','Revalidate benefit against an approved baseline.',kind='opportunity')
    for c,p in data.conflicts:
        add('DQ01',p,'تعارض مصادر يمنع الحساب','Conflicting sources block calculation',f'توجد قيم مختلفة للمفهوم {c}.',f'Different values exist for concept {c}.',[c],[],['أي مصدر وفترة ونطاق يجب اعتماده؟'],['Which source, period and scope should be authoritative?'],'حدد المصدر المعتمد مع حفظ الأصل.','Resolve the authoritative source while preserving originals.',severity='high',kind='data_quality',evidence='supported')
    return findings
