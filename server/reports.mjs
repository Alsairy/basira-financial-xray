import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const fallback = {
  version: '1.0.0',
  audiences: [
    {
      id: 'ceo',
      label_en: 'Chief executive officer',
      label_ar: 'CEO',
      sections: [
        'executive_reading',
        'watchpoints',
        'management_questions',
        'next_90_days',
        'evidence_appendix',
      ],
      metric_groups: ['growth', 'profitability', 'cash'],
      focus_en: ['What changed?'],
      focus_ar: ['What changed?'],
      data_needs_en: ['Business plan'],
      data_needs_ar: ['Business plan'],
    },
  ],
};
export function audienceConfig(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'shared', 'audiences.json'), 'utf8'));
  } catch {
    return fallback;
  }
}
const headings = {
  decision_brief: ['Decisions for the board', 'قرارات المجلس'],
  material_risks: ['Material risks', 'المخاطر الجوهرية'],
  capital_allocation: ['Capital allocation', 'تخصيص رأس المال'],
  execution_assurance: ['Execution assurance', 'متابعة التنفيذ'],
  executive_reading: ['Executive reading', 'القراءة التنفيذية'],
  strengths: ['Supported strengths', 'نقاط القوة المدعومة'],
  watchpoints: ['Watchpoints', 'ما يستحق الانتباه'],
  management_questions: ['Management questions', 'أسئلة الإدارة'],
  next_90_days: ['Next 90 days', 'الأيام التسعون القادمة'],
  financial_control: ['Financial control', 'الرقابة المالية'],
  reconciliation: ['Reconciliation', 'المصالحة'],
  cash_and_working_capital: ['Cash and working capital', 'النقد ورأس المال العامل'],
  scenario_assumptions: ['Scenario assumptions', 'فرضيات السيناريوهات'],
  funding_and_covenants: ['Funding and covenants', 'التمويل والتعهدات'],
  benefit_ledger: ['Verified benefit ledger', 'سجل الأثر المثبت'],
  commercial_context: ['Commercial context', 'السياق التجاري'],
  revenue_quality: ['Revenue quality', 'جودة الإيراد'],
  collections_handoff: ['Collections handoff', 'تسليم الفوترة والتحصيل'],
  customer_economics: ['Customer economics', 'ربحية العملاء'],
  commercial_actions: ['Commercial actions', 'إجراءات المبيعات'],
  missing_data: ['Required data', 'البيانات المطلوبة'],
  analytical_scope: ['Analytical scope', 'نطاق التحليل'],
  metric_dictionary: ['Metric dictionary', 'قاموس المؤشرات'],
  source_lineage: ['Source lineage', 'سلسلة الأدلة'],
  comparability: ['Comparability', 'قابلية المقارنة'],
  sensitivity: ['Sensitivity', 'الحساسية'],
  limitations: ['Limitations', 'حدود القراءة'],
  unit_scope: ['Business unit scope', 'نطاق القطاع'],
  segment_performance: ['Segment performance', 'أداء القطاع'],
  controllable_costs: ['Controllable costs', 'التكاليف القابلة للتأثير'],
  unit_actions: ['Unit actions', 'إجراءات القطاع'],
  operating_context: ['Operating context', 'السياق التشغيلي'],
  margin_drivers: ['Margin drivers', 'محركات الهامش'],
  work_to_cash: ['Work to cash', 'من الإنجاز إلى النقد'],
  delivery_actions: ['Delivery actions', 'إجراءات التنفيذ'],
  evidence_appendix: ['Evidence appendix', 'ملحق الأدلة'],
};
export function buildSections(snapshot, config, language = 'ar', detail = 'standard', focus = []) {
  const ar = language === 'ar',
    audience = config.audiences.find((a) => a.id === snapshot.audience),
    a = snapshot.analysis,
    latest = [...(a.periods || [])].sort().at(-1),
    all = a.metrics || [],
    latestMetrics = all.filter((m) => m.period === latest),
    selected = latestMetrics.filter((m) => audience.metric_groups.includes(m.group));
  const text = (en, arabic) => (ar ? arabic : en),
    label = (x) => x[ar ? 'label_ar' : 'label_en'] || x.label_en || x.key;
  const ms = (items) =>
    items.map((m) => ({
      type: 'metric',
      metric_id: m.id,
      label: label(m),
      value: m.value,
      unit: m.unit,
      status: m.status,
      formula: m.formula,
      inputs: m.inputs,
      source_refs: m.source_refs,
      explanation: m[ar ? 'explanation_ar' : 'explanation_en'],
    }));
  const findings = (a.findings || [])
    .filter((f) => a.finding_reviews?.[f.id]?.status !== 'rejected')
    .map((f) => ({
      type: 'finding',
      finding_id: f.id,
      title: f[ar ? 'title_ar' : 'title_en'],
      text: f[ar ? 'summary_ar' : 'summary_en'],
      severity: f.severity,
      evidence_status: f.evidence_status,
      metric_ids: f.metric_ids,
      source_refs: f.source_refs,
    }));
  const questions = [...focus, ...audience[ar ? 'focus_ar' : 'focus_en']];
  const needs = audience[ar ? 'data_needs_ar' : 'data_needs_en'].map((x) => ({
    type: 'data_request',
    text: x,
  }));
  const actionRows = snapshot.actions.map((x) => ({
    type: 'action',
    id: x.id,
    title: x.title,
    status: x.status,
    owner_id: x.owner_id,
    due_date: x.due_date,
    target: x.target,
    baseline: x.baseline,
    effect_type: x.effect_type,
  }));
  const missingAction = {
    type: 'text',
    text: text(
      'No action has been recorded. Assign an owner and due date before claiming an execution commitment.',
      'لم يسجل إجراء بعد. يلزم تحديد مسؤول وموعد قبل اعتبار التوصية التزامًا تنفيذيًا.',
    ),
  };
  const metricGroups = (...groups) => ms(latestMetrics.filter((m) => groups.includes(m.group)));
  const generalScope = {
    type: 'text',
    text: text(
      `Consolidated financial statement evidence, period ${latest || 'unknown'}. Aggregate results do not establish customer, product or segment performance.`,
      `قراءة من القوائم المالية المجمعة للفترة ${latest || 'غير محددة'}. النتائج الإجمالية لا تثبت أداء عميل أو منتج أو قطاع بعينه.`,
    ),
  };
  const datasetNote = {
    type: 'text',
    text: text(
      `Dataset revision ${snapshot.dataset.version}; status ${snapshot.dataset.status}; engine ${a.engine_version || 'unknown'}.`,
      `إصدار البيانات ${snapshot.dataset.version}؛ حالة المصدر ${snapshot.dataset.status}؛ محرك الحساب ${a.engine_version || 'غير محدد'}.`,
    ),
  };
  const sourceRows = snapshot.dataset.facts.map((f) => ({
    type: 'fact',
    fact_id: f.id,
    label: label(f),
    period: f.period,
    value: f.value,
    currency: f.currency,
    source: f.source,
    review_status: f.review_status,
  }));
  const purpose = snapshot.purpose;
  const purposeItems =
    purpose === 'capital_decision'
      ? [
          ...metricGroups('funding', 'returns', 'liquidity'),
          {
            type: 'data_request',
            text: text(
              'A capital decision requires the investment case, maturity schedule, covenant headroom and downside liquidity forecast. This statement reading does not approve an investment.',
              'قرار رأس المال يتطلب دراسة الاستثمار وجدول الاستحقاقات وهامش التعهدات وتوقع السيولة في الحالة المنخفضة. قراءة القوائم لا تعتمد استثمارًا.',
            ),
          },
        ]
      : purpose === 'initiative_followup'
        ? [
            ...(actionRows.length ? actionRows : [missingAction]),
            ...snapshot.actions.flatMap((x) =>
              (x.benefits || []).map((b) => ({ type: 'benefit', ...b, action_id: x.id })),
            ),
            {
              type: 'text',
              text: text(
                'Track commitments and independently verified outcomes separately. Cash release, annual profit and financing savings are distinct effects.',
                'تتبع الالتزامات والآثار المثبتة بشكل مستقل. تحرير النقد والربح السنوي ووفر التمويل آثار منفصلة.',
              ),
            },
          ]
        : purpose === 'performance_improvement'
          ? [
              ...findings.slice(0, 5),
              ...(actionRows.length ? actionRows : [missingAction]),
              {
                type: 'question',
                text: text(
                  'Which intervention has an accountable owner, feasible implementation cost and a verifiable baseline? Test assumptions before assigning a savings target.',
                  'ما التدخل الذي له مسؤول وتكلفة تنفيذ واقعية وخط أساس يمكن إثباته؟ اختبر الفرضيات قبل تحديد مستهدف وفورات.',
                ),
              },
            ]
          : [
              {
                type: 'text',
                text: text(
                  'Review current performance against prior periods; distinguish measured change, untested explanations and required decisions.',
                  'راجع الأداء الحالي مقابل الفترات السابقة، وافصل التغير المقاس والتفسير غير المختبر والقرارات المطلوبة.',
                ),
              },
              ...ms(selected.slice(0, 4)),
            ];
  const sections = [
    {
      id: 'purpose_focus',
      title: text('Decision purpose and priorities', 'الغرض وأولويات القرار'),
      items: purposeItems,
    },
  ];
  for (const key of audience.sections) {
    let items = [];
    if (
      [
        'executive_reading',
        'commercial_context',
        'operating_context',
        'analytical_scope',
        'unit_scope',
      ].includes(key)
    )
      items = [generalScope, datasetNote, ...ms(selected.slice(0, detail === 'brief' ? 4 : 8))];
    else if (key === 'decision_brief')
      items = [
        ...questions.map((q) => ({ type: 'question', text: q })),
        ...actionRows.filter((x) => ['draft', 'approved', 'blocked'].includes(x.status)),
        ...ms(selected.slice(0, 6)),
      ];
    else if (key === 'strengths') {
      const positive = latestMetrics.filter(
        (m) =>
          ['revenue_growth', 'ebit_growth', 'operating_cash_margin', 'free_cash_flow'].includes(
            m.key,
          ) &&
          m.status === 'ok' &&
          m.value > 0,
      );
      items = positive.length
        ? ms(positive)
        : [
            {
              type: 'text',
              text: text(
                'No strength is stated without a supported metric.',
                'لا تُثبت نقطة قوة دون مؤشر يدعمها.',
              ),
            },
          ];
    } else if (['watchpoints', 'material_risks'].includes(key))
      items = findings.filter(
        (f) => key === 'watchpoints' || ['high', 'medium'].includes(f.severity),
      );
    else if (['management_questions', 'financial_control'].includes(key))
      items = [
        ...questions.map((q) => ({ type: 'question', text: q })),
        ...(key === 'financial_control' ? [datasetNote] : []),
      ];
    else if (
      [
        'next_90_days',
        'commercial_actions',
        'unit_actions',
        'delivery_actions',
        'execution_assurance',
      ].includes(key)
    )
      items = actionRows.length ? actionRows : [missingAction];
    else if (key === 'reconciliation')
      items = (a.checks || []).map((c) => ({
        type: 'check',
        id: c.id,
        label: label(c),
        status: c.status,
        difference: c.difference,
        tolerance: c.tolerance,
        text: c[ar ? 'details_ar' : 'details_en'],
      }));
    else if (key === 'cash_and_working_capital')
      items = metricGroups('cash', 'liquidity', 'working_capital');
    else if (key === 'funding_and_covenants') items = [...metricGroups('funding'), ...needs];
    else if (key === 'capital_allocation')
      items = [...metricGroups('funding', 'returns', 'cash'), ...needs];
    else if (['scenario_assumptions', 'sensitivity'].includes(key))
      items = snapshot.scenarios.length
        ? snapshot.scenarios.map((s) => ({
            type: 'scenario',
            id: s.id,
            title: s.title,
            low: s.low,
            base: s.base,
            high: s.high,
            effect_type: s.effect_type,
            formula: s.formula,
            text: (s[ar ? 'assumptions_ar' : 'assumptions_en'] || []).join?.(' ') || '',
          }))
        : [
            {
              type: 'data_request',
              text: text(
                'No saved sensitivity analysis. Set explicit low, base and high assumptions before assessing an intervention.',
                'لا يوجد تحليل حساسية محفوظ. حدد فرضيات منخفضة وأساسية وعالية قبل تقييم التدخل.',
              ),
            },
          ];
    else if (key === 'benefit_ledger') {
      items = snapshot.actions.flatMap((x) =>
        (x.benefits || []).map((b) => ({ type: 'benefit', ...b, action_id: x.id })),
      );
      if (!items.length)
        items = [
          {
            type: 'text',
            text: text(
              'No independently verified benefit has been recorded. Scenario estimates are not realized savings.',
              'لم يسجل أثر مثبت بمراجعة مستقلة. تقديرات السيناريوهات ليست وفورات محققة.',
            ),
          },
        ];
    } else if (key === 'revenue_quality')
      items = [
        ...ms(
          latestMetrics.filter((m) =>
            ['revenue_growth', 'gross_margin', 'net_margin', 'contract_assets_ratio'].includes(
              m.key,
            ),
          ),
        ),
        generalScope,
      ];
    else if (['collections_handoff', 'work_to_cash'].includes(key))
      items = [...metricGroups('working_capital', 'cash'), ...needs];
    else if (key === 'margin_drivers')
      items = [
        ...metricGroups('profitability'),
        {
          type: 'data_request',
          text: text(
            'Provide cost, volume, price and utilization bridges to identify operational causes.',
            'يلزم جسر للتكلفة والحجم والسعر واستغلال الطاقة لتحديد الأسباب التشغيلية.',
          ),
        },
      ];
    else if (['customer_economics', 'segment_performance', 'controllable_costs'].includes(key))
      items = [
        {
          type: 'text',
          text: text(
            'Unavailable from aggregate statements. No customer or segment ranking can be inferred.',
            'غير متاح من القوائم الإجمالية. لا يمكن استنتاج ترتيب العملاء أو القطاعات.',
          ),
        },
        ...needs,
      ];
    else if (key === 'missing_data') items = needs;
    else if (key === 'metric_dictionary') items = ms(detail === 'detailed' ? all : selected);
    else if (['source_lineage', 'evidence_appendix'].includes(key))
      items =
        detail === 'brief'
          ? sourceRows
              .filter((f) => selected.some((m) => m.inputs?.includes(f.fact_id)))
              .slice(0, 20)
          : sourceRows;
    else if (key === 'comparability')
      items = snapshot.benchmarks.length
        ? snapshot.benchmarks.map((b) => ({
            type: 'benchmark',
            id: b.id,
            metric_key: b.metric_key,
            n: b.n,
            median: b.median,
            q1: b.q1,
            q3: b.q3,
            eligible: b.eligible,
            warnings: b.warnings,
          }))
        : [
            {
              type: 'data_request',
              text: text(
                'No licensed, definition-reviewed peer cohort was provided.',
                'لم تقدم عينة نظراء موثقة الحقوق ومراجعة التعريفات.',
              ),
            },
          ];
    else if (key === 'limitations')
      items = [
        generalScope,
        ...needs,
        ...(snapshot.dataset.warnings || []).map((t) => ({ type: 'text', text: t })),
      ];
    if (!items.length)
      items = [
        {
          type: 'text',
          text: text(
            'No supported item is available in this section for the selected source revision.',
            'لا تتوفر مادة مدعومة لهذا القسم في إصدار المصدر المختار.',
          ),
        },
      ];
    sections.push({ id: key, title: (headings[key] || [key, key])[ar ? 1 : 0], items });
  }
  if (detail === 'brief')
    for (const section of sections) {
      if (section.items.length > 6) {
        const omitted = section.items.length - 6;
        section.items = section.items.slice(0, 6);
        section.items.push({
          type: 'text',
          text: text(
            `${omitted} additional items are retained in the report snapshot; select standard or detailed depth for the complete reading.`,
            `حُفظ ${omitted} عنصرًا إضافيًا في نسخة البيانات؛ اختر قراءة عادية أو تفصيلية لعرضها.`,
          ),
        });
      }
    }
  if (detail === 'detailed')
    sections.push({
      id: 'methodology',
      title: text('Methodology and full metric definitions', 'المنهج والتعريفات التفصيلية'),
      items: [
        {
          type: 'text',
          text: text(
            `Days convention: ${snapshot.settings.days}; include leases: ${snapshot.settings.include_leases}; reconciliation tolerance: ${snapshot.settings.materiality_pct}%. Missing or invalid denominators remain unavailable.`,
            `أساس الأيام: ${snapshot.settings.days}؛ إدراج الإيجارات: ${snapshot.settings.include_leases}؛ هامش المصالحة: ${snapshot.settings.materiality_pct}%. القيم الناقصة والمقامات غير الصالحة تبقى غير متاحة.`,
          ),
        },
        ...ms(all),
      ],
    });
  return completeEvidenceReferences(snapshot, sections, language);
}

// Resolve the transitive evidence graph from the frozen snapshot. Brief body
// limits never remove destinations needed by a finding or metric citation.
export function completeEvidenceReferences(snapshot, rawSections, language = 'ar') {
  const sections = structuredClone(rawSections),
    ar = language === 'ar';
  const byMetric = new Map(),
    byFact = new Map(),
    bySource = new Map();
  const label = (x) => x[ar ? 'label_ar' : 'label_en'] || x.label_en || x.label || x.key || x.id;
  const anchor = (item) =>
    item.metric_id
      ? `metric:${item.metric_id}`
      : item.fact_id
        ? `fact:${item.fact_id}`
        : item.finding_id
          ? `finding:${item.finding_id}`
          : item.id
            ? `${item.type || 'item'}:${item.id}`
            : null;
  const addFact = (item) => {
    item.label = item.label || byFact.get(item.fact_id)?.label || item.fact_id;
    byFact.set(item.fact_id, item);
    bySource.set(item.fact_id, item);
    const source = item.source || {};
    if (source.sheet && source.cell) bySource.set(`${source.sheet}!${source.cell}`, item);
    if (source.page) bySource.set(`page:${source.page}`, item);
  };
  for (const m of snapshot.analysis?.metrics || [])
    byMetric.set(m.id, {
      type: 'metric',
      metric_id: m.id,
      label: label(m),
      period: m.period,
      value: m.value,
      unit: m.unit,
      status: m.status,
      formula: m.formula,
      inputs: m.inputs,
      source_refs: m.source_refs,
      explanation: m[ar ? 'explanation_ar' : 'explanation_en'],
    });
  for (const f of snapshot.dataset?.facts || [])
    addFact({
      type: 'fact',
      fact_id: f.id,
      label: label(f),
      period: f.period,
      value: f.value,
      currency: f.currency,
      source: f.source,
      review_status: f.review_status,
    });
  // Board-safe snapshots may intentionally omit raw dataset facts. Only use
  // their already authorized evidence rows; never fetch another dataset here.
  for (const section of sections)
    for (const item of section.items) {
      if (item.fact_id) addFact(item);
      if (item.metric_id && !byMetric.has(item.metric_id)) byMetric.set(item.metric_id, item);
    }
  let appendix = sections.find((s) => s.id === 'evidence_appendix');
  if (!appendix) {
    appendix = {
      id: 'evidence_appendix',
      title: ar ? 'ملحق الأدلة' : 'Evidence appendix',
      items: [],
    };
    sections.push(appendix);
  }
  const queue = sections.flatMap((s) => s.items),
    present = new Set(queue.map(anchor).filter(Boolean));
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    item.anchor_id = anchor(item);
    const resolved = new Map(),
      missing = new Set();
    const add = (ref, target) => {
      if (!target) {
        missing.add(String(ref));
        return;
      }
      const targetAnchor = anchor(target);
      resolved.set(targetAnchor, {
        anchor_id: targetAnchor,
        label: target.label || String(ref),
        fact_id: target.fact_id,
        metric_id: target.metric_id,
      });
      if (!present.has(targetAnchor)) {
        const copy = structuredClone(target);
        appendix.items.push(copy);
        queue.push(copy);
        present.add(targetAnchor);
      }
    };
    for (const ref of item.evidence_refs || []) {
      const target = ref.fact_id
        ? byFact.get(ref.fact_id)
        : ref.metric_id
          ? byMetric.get(ref.metric_id)
          : null;
      if (target) add(ref.label, target);
    }
    for (const ref of item.metric_ids || []) add(ref, byMetric.get(ref));
    for (const ref of item.inputs || []) add(ref, byFact.get(ref) || byMetric.get(ref));
    for (const ref of item.source_refs || []) add(ref, bySource.get(ref) || byMetric.get(ref));
    item.evidence_refs = [...resolved.values()];
    item.missing_references = [...missing];
  }
  return sections;
}

export function renderReport(report) {
  const ar = report.language === 'ar',
    locale = ar ? 'ar-SA' : 'en-GB',
    t = (en, arabic) => (ar ? arabic : en);
  const e = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const labels = {
    draft: ['Draft', 'مسودة'],
    approved: ['Approved', 'معتمد'],
    needs_review: ['Needs review', 'بحاجة إلى مراجعة'],
    reviewed: ['Reviewed', 'مُراجع'],
    ok: ['Supported', 'مدعوم'],
    proxy: ['Proxy estimate', 'مؤشر تقريبي'],
    pass: ['Passed', 'اجتاز الفحص'],
    fail: ['Failed', 'فحص غير مجتاز'],
    warning: ['Attention required', 'يتطلب الانتباه'],
    insufficient_data: ['Insufficient data', 'بيانات غير كافية'],
    invalid_denominator: ['Invalid denominator', 'مقام غير صالح'],
    not_applicable: ['Not applicable', 'غير منطبق'],
    high: ['High', 'مرتفعة'],
    medium: ['Medium', 'متوسطة'],
    low: ['Low', 'منخفضة'],
    info: ['Information', 'معلومة'],
    supported: ['Supported', 'مدعوم'],
    hypothesis: ['Needs validation', 'فرضية تحتاج تحققًا'],
    needs_data: ['More data required', 'يتطلب بيانات'],
    in_progress: ['In progress', 'قيد التنفيذ'],
    blocked: ['Blocked', 'متعثر'],
    pending_verification: ['Pending verification', 'بانتظار التحقق'],
    closed: ['Closed', 'مغلق'],
    benefit_verified: ['Benefit verified', 'أثر مثبت'],
    reopened: ['Reopened', 'أعيد فتحه'],
    cash_release: ['Cash release', 'تحرير نقد'],
    annual_profit: ['Annual profit', 'ربح سنوي'],
    financing_saving: ['Financing saving', 'وفر تمويلي'],
    risk_exposure: ['Risk exposure', 'تعرض للمخاطر'],
    implementation_cost: ['Implementation cost', 'تكلفة التنفيذ'],
    board: ['Board of directors', 'مجلس الإدارة'],
    ceo: ['Chief executive officer', 'الرئيس التنفيذي'],
    cfo: ['Chief financial officer', 'المدير المالي'],
    sales: ['Sales leader', 'مدير المبيعات'],
    analyst: ['Financial analyst', 'المحلل المالي'],
    sector: ['Business unit leader', 'مدير القطاع'],
    operations: ['Operations leader', 'مدير العمليات'],
    periodic_review: ['Periodic performance review', 'مراجعة دورية للأداء'],
    performance_improvement: ['Performance improvement', 'تحسين الأداء'],
    capital_decision: ['Capital or financing decision', 'قرار استثماري أو تمويلي'],
    initiative_followup: ['Initiative follow-up', 'متابعة المبادرات'],
    'Evidence-based financial reading': ['Financial reading', 'قراءة مالية قائمة على الأدلة'],
    brief: ['Executive brief', 'موجز تنفيذي'],
    standard: ['Financial report', 'تقرير مالي'],
    detailed: ['Detailed financial report', 'تقرير مالي تفصيلي'],
    currency: ['Currency units', 'وحدة نقدية'],
    percent: ['%', '٪'],
    days: ['days', 'يوم'],
    multiple: ['×', 'مرة'],
    number: ['', ''],
    SAR: ['SAR', 'ريال سعودي'],
    USD: ['USD', 'دولار أمريكي'],
    question: ['Management question', 'سؤال للإدارة'],
    data_request: ['Required data', 'بيانات مطلوبة'],
    benefit: ['Verified benefit', 'أثر مثبت'],
    scenario: ['Scenario', 'سيناريو'],
    benchmark: ['Peer comparison', 'مقارنة النظراء'],
    text: ['Reading note', 'ملاحظة'],
    fact: ['Source fact', 'بند المصدر'],
    metric: ['Financial metric', 'مؤشر مالي'],
    check: ['Reconciliation check', 'فحص المصالحة'],
  };
  const local = (v) => labels[v]?.[ar ? 1 : 0] ?? String(v ?? '');
  const moneyCode = report.snapshot.entity?.currency;
  const number = (value, unit = '', compact = false) => {
    if (value === null || value === undefined || !Number.isFinite(value))
      return {
        value: '—',
        unit: local(unit === 'currency' ? moneyCode || unit : unit),
        full: t('Unavailable', 'غير متاح'),
      };
    const monetary = unit === 'currency' || /^[A-Z]{3}$/.test(unit),
      scale = compact && monetary && Math.abs(value) >= 1000000 ? 1000000 : 1;
    const digits =
      unit === 'days' ? 1 : monetary && scale === 1 ? (Number.isInteger(value) ? 0 : 2) : 2;
    const formatted = new Intl.NumberFormat(locale, {
      numberingSystem: 'latn',
      maximumFractionDigits: digits,
    }).format(value / scale);
    const unitLabel = local(unit === 'currency' ? moneyCode || unit : unit);
    return {
      value: formatted,
      unit: scale === 1000000 ? `${t('million', 'مليون')} ${unitLabel}` : unitLabel,
      full: new Intl.NumberFormat(locale, {
        numberingSystem: 'latn',
        maximumFractionDigits: 20,
      }).format(value),
    };
  };
  const date = (value) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat(locale, {
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(value));
  };
  const sections = completeEvidenceReferences(
      report.snapshot,
      report.snapshot.sections,
      report.language,
    ),
    detailed = report.detail_level === 'detailed' || report.snapshot.detail_level === 'detailed';
  const used = new Set(sections.map((s) => s.id));
  const badge = (value) =>
    value ? `<span class="badge badge-${e(value)}">${e(local(value))}</span>` : '';
  const latest = [...(report.snapshot.analysis.periods || [])].sort().at(-1);
  const priorities = {
    board: ['net_debt', 'net_debt_to_ebitda', 'roe', 'free_cash_flow'],
    ceo: ['revenue_growth', 'gross_margin', 'operating_cash_margin', 'receivables_days'],
    cfo: ['current_ratio', 'cfo_to_net_income', 'receivables_days', 'net_debt'],
    sales: ['revenue_growth', 'gross_margin', 'receivables_days', 'contract_assets_ratio'],
    analyst: ['revenue_growth', 'gross_margin', 'operating_cash_margin', 'current_ratio'],
    sector: ['revenue_growth', 'ebit_margin', 'roic', 'receivables_days'],
    operations: ['gross_margin', 'sga_ratio', 'receivables_days', 'operating_cash_margin'],
  };
  const metricRows = new Map(
    sections
      .flatMap((s) => s.items)
      .filter((i) => i.metric_id)
      .map((i) => [i.metric_id, i]),
  );
  const eligible = (report.snapshot.analysis.metrics || []).filter(
    (m) =>
      m.period === latest &&
      Number.isFinite(m.value) &&
      ['ok', 'proxy'].includes(m.status) &&
      metricRows.has(m.id),
  );
  const priority = priorities[report.audience] || priorities.ceo;
  const hero = [...eligible]
    .sort((a, b) => {
      const rank = (m) => (priority.includes(m.key) ? priority.indexOf(m.key) : priority.length);
      return rank(a) - rank(b);
    })
    .slice(0, 4);
  const heroHtml = hero
    .map((m) => {
      const n = number(m.value, m.unit, true);
      return `<a class="kpi-card" href="#${encodeURIComponent(`metric:${m.id}`)}"><span class="kpi-label">${e(m[ar ? 'label_ar' : 'label_en'] || m.label_en || m.key)}</span><strong title="${e(n.full)}" dir="ltr">${e(n.value)}</strong><span class="kpi-unit">${e(n.unit)} · ${e(m.period)}</span>${m.status === 'proxy' ? `<span class="proxy-label">${e(local('proxy'))}</span>` : ''}</a>`;
    })
    .join('');
  const row = (item) => {
    const anchor = item.anchor_id && !used.has(item.anchor_id) ? item.anchor_id : null;
    if (anchor) used.add(anchor);
    const links = (item.evidence_refs || [])
      .map((ref) => `<a href="#${encodeURIComponent(ref.anchor_id)}">${e(ref.label)}</a>`)
      .join('<span aria-hidden="true"> · </span>');
    const n =
      item.value !== undefined ? number(item.value, item.unit || item.currency || '', false) : null;
    const title = item.title || item.label || item.text || local(item.metric_key || item.type);
    const technical = [
      item.formula
        ? `<div class="detail-label">${t('Definition', 'التعريف')}</div><code>${e(item.formula)}</code>`
        : '',
      item.explanation ? `<p>${e(item.explanation)}</p>` : '',
      item.source
        ? `<div class="source-location">${t('Source:', 'المصدر:')} ${e([item.source.sheet, item.source.cell, item.source.page ? `${t('page', 'صفحة')} ${item.source.page}` : ''].filter(Boolean).join(' / '))}</div>`
        : '',
      links
        ? `<div class="evidence-links"><span>${t('Evidence', 'الأدلة')}</span><div>${links}</div></div>`
        : '',
      item.missing_references?.length
        ? `<p class="missing-evidence">${t('Reference unavailable in this authorized snapshot; it cannot substantiate the claim:', 'مرجع غير متاح ضمن هذه النسخة المصرح بها؛ لا يمكن الاستناد إليه:')} ${item.missing_references.map(e).join(' · ')}</p>`
        : '',
    ]
      .filter(Boolean)
      .join('');
    const metricDetail =
      technical && ['metric', 'fact'].includes(item.type)
        ? `<details class="metric-details"${detailed ? ' open' : ''}><summary>${t('Definition and evidence', 'التعريف والدليل')}</summary><div class="details-content">${technical}</div></details>`
        : technical;
    return `<article class="report-item item-${e(item.type || 'text')}"${anchor ? ` id="${e(anchor)}"` : ''}><div class="item-heading"><div><strong class="item-title">${e(title)}</strong>${item.period ? `<span class="period">${e(item.period)}</span>` : ''}</div>${n ? `<div class="item-number"><strong title="${e(n.full)}" dir="ltr">${e(n.value)}</strong><span>${e(n.unit)}</span></div>` : ''}</div>
${item.status || item.evidence_status ? `<div class="status-row">${badge(item.status)}${badge(item.evidence_status)}</div>` : ''}
${item.text && (item.title || item.label) ? `<p class="item-body">${e(item.text)}</p>` : ''}
${item.due_date ? `<p class="item-meta">${t('Due', 'الموعد')} ${e(date(item.due_date))} · ${e(local(item.effect_type))}</p>` : ''}
${
  item.low !== undefined
    ? `<div class="scenario-values">${[
        ['low', t('Low', 'منخفض')],
        ['base', t('Base', 'أساسي')],
        ['high', t('High', 'مرتفع')],
      ]
        .map(([key, label]) => {
          const v = number(
            typeof item[key] === 'number' ? item[key] : item[key]?.value,
            'currency',
            true,
          );
          return `<div><span>${label}</span><strong dir="ltr">${e(v.value)}</strong><small>${e(v.unit)}</small></div>`;
        })
        .join('')}</div>`
    : ''
}
${item.n !== undefined ? `<p class="item-meta">${t('Sample', 'العينة')}: ${e(number(item.n).value)} · ${t('Median', 'الوسيط')}: ${e(number(item.median).value)} · ${t('First quartile', 'الربيع الأول')}: ${e(number(item.q1).value)} · ${t('Third quartile', 'الربيع الثالث')}: ${e(number(item.q3).value)}</p>` : ''}
${item.amount !== undefined ? `<p class="item-meta">${e(number(item.amount, 'currency').value)} ${e(number(item.amount, 'currency').unit)} · ${e(local(item.effect_type))} · ${e(date(item.period_start))}–${e(date(item.period_end))}</p>` : ''}
${metricDetail}</article>`;
  };
  const sectionHtml = sections
    .map((s, index) => {
      const appendix = ['evidence_appendix', 'source_lineage'].includes(s.id),
        body = s.items.map(row).join('');
      return `<section class="report-section${appendix ? ' appendix' : ''}" id="${e(s.id)}">${appendix ? `<details class="appendix-details"${detailed ? ' open' : ''}><summary><span><span class="section-number">${String(index + 1).padStart(2, '0')}</span>${e(s.title)}</span><span class="appendix-count">${new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(s.items.length)} ${t('items · open evidence', 'عنصرًا · عرض الأدلة')}</span></summary><div class="details-content appendix-content">${body}</div></details>` : `<div class="section-heading"><span class="section-number">${String(index + 1).padStart(2, '0')}</span><h2>${e(s.title)}</h2></div><div class="section-body">${body}</div>`}</section>`;
    })
    .join('');
  return `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(report.title)}</title><style>
:root{color-scheme:light;--navy:#122c3e;--teal:#087c80;--muted:#617784;--line:#dce6e9;--paper:#fff}*{box-sizing:border-box}body{font:16px/1.75 system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:var(--navy);background:#edf2f4;margin:0;padding:40px 28px;overflow-wrap:anywhere}.report{max-width:1080px;margin:auto}.cover{background:var(--paper);border:1px solid var(--line);border-top:6px solid var(--teal);border-radius:14px;padding:36px 40px 28px}.brand-line{display:flex;justify-content:space-between;align-items:center;gap:20px}.brand{font-weight:800;font-size:25px;letter-spacing:-.5px}.brand small{font-size:11px;letter-spacing:2px;display:block;color:var(--teal);margin-top:-8px}.report-kind{font-size:13px;color:var(--muted);margin-top:34px}.cover h1{font-size:30px;line-height:1.5;letter-spacing:-.5px;margin:10px 0 16px;font-weight:750;max-width:900px}.cover-meta{display:flex;gap:8px 20px;flex-wrap:wrap;color:var(--muted);font-size:13px}.purpose{margin:22px 0 0;padding:16px 18px;background:#f3f8f8;border-inline-start:3px solid var(--teal);border-radius:6px}.purpose span{font-size:12px;color:var(--muted);display:block}.purpose strong{font-weight:650}.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:26px}.kpi-card{display:flex;flex-direction:column;padding:17px;border:1px solid var(--line);border-radius:9px;color:inherit;text-decoration:none;min-width:0;transition:background .15s}.kpi-card:hover,.kpi-card:focus-visible{background:#edf9f8;outline:2px solid var(--teal);outline-offset:2px}.kpi-label{font-size:13px;min-height:26px;color:var(--muted)}.kpi-card>strong{font-size:29px;font-variant-numeric:tabular-nums;line-height:1.5;align-self:flex-start;white-space:nowrap}.kpi-unit{font-size:12px;color:var(--muted)}.proxy-label{font-size:11px;color:#875512;margin-top:5px}.reading-note{font-size:12px;color:var(--muted);margin:16px 0 0}.report-nav{display:flex;gap:7px 16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:22px 4px;font-size:13px}.report-nav a{color:var(--teal);text-decoration:none}.report-nav a:hover{text-decoration:underline}.report-section{background:var(--paper);border:1px solid var(--line);border-radius:12px;margin:18px 0;overflow:hidden;scroll-margin-top:16px}.section-heading{display:flex;align-items:center;gap:12px;padding:22px 28px;border-bottom:1px solid var(--line)}.section-number{font-size:12px;font-weight:650;color:var(--teal);font-variant-numeric:tabular-nums;background:#edf6f6;padding:3px 8px;border-radius:5px}.section-heading h2{font-size:21px;line-height:1.5;margin:0}.section-body,.appendix-content{padding:2px 28px 16px}.report-item{padding:18px 0;border-bottom:1px solid #e7eef0;scroll-margin-top:24px}.report-item:last-child{border-bottom:0}.report-item:target{background:#edf9f8;outline:2px solid var(--teal);outline-offset:7px;border-radius:3px}.item-heading{display:flex;align-items:start;justify-content:space-between;gap:20px}.item-title{font-size:16px;font-weight:650}.period{display:inline-block;color:var(--muted);font-size:12px;margin-inline-start:12px}.item-number{display:flex;gap:10px;align-items:baseline;flex-shrink:0}.item-number strong{font-size:22px;font-variant-numeric:tabular-nums;font-weight:650;white-space:nowrap}.item-number>span{font-size:12px;color:var(--muted)}.item-body{margin:8px 0;color:#445e6d}.item-meta{font-size:13px;color:var(--muted);margin:8px 0}.status-row{display:flex;gap:8px;margin-top:5px}.badge{display:inline-flex;border:1px solid #d8e5e9;border-radius:30px;padding:2px 10px;font-size:11px;line-height:1.8;color:#526d7b;background:#f5f8f9}.badge-approved,.badge-ok,.badge-pass,.badge-supported,.badge-reviewed{color:#11675a;border-color:#c6e6de;background:#edf8f4}.badge-fail,.badge-high{color:#944337;border-color:#efd4d1;background:#fdf3f1}.badge-proxy,.badge-hypothesis,.badge-warning,.badge-needs_review,.badge-pending_verification{color:#8a601c;border-color:#eddfc7;background:#fff9ed}details summary{cursor:pointer;list-style-position:inside}summary:focus-visible{outline:2px solid var(--teal);outline-offset:5px}.metric-details{margin-top:8px;font-size:13px;color:var(--muted)}.metric-details>summary{color:var(--teal);font-size:12px}.metric-details .details-content{background:#f7fafb;border-radius:7px;padding:13px 16px;margin-top:8px}.detail-label{font-size:11px;color:var(--muted);margin-bottom:3px}code{display:block;direction:ltr;text-align:left;font-size:12px;line-height:1.6;white-space:normal;color:#4d6575;background:none}.details-content p{margin:8px 0}.evidence-links{font-size:12px;margin-top:10px}.evidence-links>span{font-weight:650;color:#506b7a}.evidence-links a{color:var(--teal);text-underline-offset:3px}.source-location{font-size:12px;margin-top:10px}.missing-evidence{font-size:12px;color:#8a4b12}.appendix-details>summary{padding:22px 28px;font-size:20px;font-weight:650}.appendix-details>summary .section-number{margin-inline-end:12px}.appendix-count{display:block;font-size:12px;font-weight:400;color:var(--muted);margin-inline-start:38px;margin-top:4px}.appendix-details[open]>summary{border-bottom:1px solid var(--line)}.appendix .report-item{padding:12px 0}.appendix .item-title{font-size:14px}.appendix .item-number strong{font-size:18px}.appendix .metric-details{margin-top:4px}.scenario-values{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:15px 0}.scenario-values>div{background:#f4f8f9;border-radius:7px;padding:12px}.scenario-values span,.scenario-values strong,.scenario-values small{display:block}.scenario-values span,.scenario-values small{font-size:12px;color:var(--muted)}.scenario-values strong{font-size:20px}.report-footer{color:var(--muted);font-size:11px;padding:20px 8px}.report-footer p{margin:4px 0}@media(max-width:760px){body{padding:18px 12px}.cover{padding:25px 23px}.cover h1{font-size:25px}.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-heading{padding:19px 21px}.section-body,.appendix-content{padding-inline:21px}.item-heading{gap:10px}.item-number{display:block;text-align:end}.item-number>span{display:block}.appendix-details>summary{padding:20px}.kpi-card>strong{font-size:27px}}@media print{@page{size:A4;margin:14mm 13mm}body{padding:0;background:white;font-size:10pt;line-height:1.55}.report{max-width:none}.cover{padding:18px 22px;border-radius:0;border-width:0 0 1px;border-top:4px solid var(--teal);break-inside:avoid}.cover h1{font-size:21pt}.report-kind{margin-top:18px}.kpi-card>strong{font-size:19pt}.kpi-card{padding:10px}.kpi-grid{gap:8px;margin-top:18px}.report-nav{display:none}.report-section{border:0;border-radius:0;margin:16px 0;overflow:visible;break-inside:auto}.section-heading{padding:12px 0;break-after:avoid}.section-heading h2{font-size:15pt}.section-body,.appendix-content{padding:0}.report-item{padding:10px 0;break-inside:avoid}.item-title{font-size:11pt}.item-number strong{font-size:14pt}.metric-details{font-size:9pt}details::details-content{content-visibility:visible!important;display:block!important}details>.details-content{display:block!important}summary{list-style:none}.metric-details>summary{display:none}.metric-details .details-content{padding:5px 0;background:transparent}.appendix-details>summary{padding:12px 0;font-size:15pt;break-after:avoid}.appendix-count{display:none}.evidence-links{font-size:8pt}.report-footer{font-size:8pt}.scenario-values>div{padding:8px}a{color:inherit;text-decoration:none}.badge{font-size:8pt}}
</style></head><body><main class="report"><header class="cover"><div class="brand-line"><div class="brand">بصيرة<small>BASIRA</small></div>${badge(report.status)}</div><div class="report-kind">${e(local(report.detail_level || report.snapshot.detail_level || 'standard'))} · ${e(local(report.audience))}</div><h1>${e(report.title)}</h1><div class="cover-meta"><span>${t('Period', 'الفترة')}: ${e(latest || '—')}</span><span>${e(date(report.created_at))}</span><span>${t('Data revision', 'إصدار البيانات')}: ${e(report.snapshot.dataset.version)}</span></div><div class="purpose"><span>${t('Purpose of this reading', 'الغرض من القراءة')}</span><strong>${e(local(report.purpose || report.snapshot.purpose))}</strong></div>${heroHtml ? `<div class="kpi-grid">${heroHtml}</div>` : ''}<p class="reading-note">${t('Select a figure to inspect its definition and evidence. Rounded display values preserve the exact underlying data.', 'اختر رقمًا للاطلاع على تعريفه ودليله. قُرّبت الأرقام للعرض مع الاحتفاظ بالقيم الدقيقة في البيانات.')}${['sales', 'sector', 'operations'].includes(report.audience) ? ` ${t('These are company-level indicators; detailed customer or business-unit conclusions require additional data.', 'هذه مؤشرات على مستوى الشركة؛ استنتاجات العملاء والقطاعات تتطلب بيانات تفصيلية إضافية.')}` : ''}</p></header><nav class="report-nav" aria-label="${t('Report contents', 'محتويات التقرير')}">${sections.map((s) => `<a href="#${e(s.id)}">${e(s.title)}</a>`).join('')}</nav>${sectionHtml}<footer class="report-footer"><p>${t('Evidence-based reading, not an audit opinion or investment recommendation.', 'قراءة قائمة على الأدلة المتاحة، وليست رأيًا تدقيقيًا أو توصية استثمارية.')}</p><p>BASIRA · ${e(report.id)} · ${t('Template', 'القالب')} ${e(report.template_version || '—')}</p></footer></main></body></html>`;
}
