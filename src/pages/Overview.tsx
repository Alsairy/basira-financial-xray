import {
  ArrowUpLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  FileCheck2,
  SearchCheck,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { audiences } from '../components/AudienceSelector';
import { Badge, Button, Empty, Notice, PageTitle, Panel, TextLink } from '../components/ui';
import { format, useApp } from '../context';
export default function Overview() {
  const { tr, locale, dashboard, period, navigate, inspect, session, audience } = useApp();
  const analysis = dashboard?.analysis,
    dataset = dashboard?.dataset;
  if (session.user.role === 'operator')
    return (
      <>
        <PageTitle
          eyebrow={tr('متابعة التنفيذ', 'EXECUTION WORKSPACE')}
          title={tr('إجراءات تحتاج تنفيذك', 'Your assigned actions')}
          description={tr(
            'تابع التكليفات وارفع أدلة التنفيذ قبل طلب التحقق المستقل.',
            'Track assigned work and attach evidence before independent verification.',
          )}
          action={
            <Button onClick={() => navigate('actions')}>
              {tr('فتح مساحة الإجراءات', 'Open action workspace')}
            </Button>
          }
        />
        <Panel title={tr('المسند إليك', 'Assigned to you')}>
          {dashboard?.actions.length ? (
            dashboard.actions.map((a) => (
              <button
                className="finding-row"
                key={a.id}
                onClick={() => navigate(`actions?id=${a.id}`)}
              >
                <Target size={20} />
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                  <small>{a.due_date}</small>
                </div>
                <Badge status={a.status} />
              </button>
            ))
          ) : (
            <Empty
              title={tr('لا توجد تكليفات حاليًا', 'No assigned actions yet')}
              description={tr(
                'ستظهر هنا الإجراءات التي يكلّفك بها الفريق المالي.',
                'Actions assigned by the financial team appear here.',
              )}
            />
          )}
        </Panel>
      </>
    );
  if (session.user.role === 'board')
    return (
      <>
        <PageTitle
          eyebrow={tr('قراءة من نسخة معتمدة', 'APPROVED REPORT PERSPECTIVE')}
          title={tr('مساحة المجلس', 'Board overview')}
          description={tr(
            'القراءة التالية محصورة في آخر تقرير معتمد متاح لك.',
            'This view is limited to the latest approved report available to you.',
          )}
          action={
            <Button onClick={() => navigate('reports')}>
              <FileCheck2 size={17} />
              {tr('التقارير المعتمدة', 'Approved reports')}
            </Button>
          }
        />
        {analysis ? (
          <>
            <Notice type="success">
              {tr(
                'البيانات مجمدة داخل تقرير معتمد. روابط التفاصيل تحترم صلاحية المجلس.',
                'Data is frozen in an approved report. Drill-down respects board permissions.',
              )}{' '}
              · {period}
            </Notice>
            <div className="kpi-grid">
              {analysis.metrics
                .filter(
                  (m) =>
                    m.period === period &&
                    ['ebit_margin', 'cfo_to_net_income', 'net_debt', 'roa'].includes(m.key),
                )
                .map((m) => (
                  <button className="kpi-card" key={m.id} onClick={() => inspect(m)}>
                    <div className="kpi-top">
                      {tr(m.label_ar, m.label_en)}
                      <ArrowUpLeft size={16} />
                    </div>
                    <strong className="kpi-value" dir="ltr">
                      {format(m.value, m.unit, true, locale)}
                    </strong>
                    <Badge status={m.status} />
                  </button>
                ))}
            </div>
            <Panel title={tr('الملاحظات في التقرير المعتمد', 'Approved report observations')}>
              {analysis.findings
                .filter((f) => analysis.finding_reviews?.[f.id]?.status !== 'rejected')
                .map((f) => (
                  <button className="finding-row" key={f.id} onClick={() => inspect(f)}>
                    <span className={`finding-index severity-${f.severity}`}>
                      <SearchCheck size={17} />
                    </span>
                    <div>
                      <h3>{tr(f.title_ar, f.title_en)}</h3>
                      <p>{tr(f.summary_ar, f.summary_en)}</p>
                    </div>
                    <Badge status={f.evidence_status} />
                  </button>
                ))}
            </Panel>
          </>
        ) : (
          <Panel>
            <Empty
              title={tr('لا توجد تقارير معتمدة بعد', 'No approved reports yet')}
              description={tr(
                'ستظهر القراءة بعد المراجعة والاعتماد المستقل من المدير المالي.',
                'Your financial reading appears after independent CFO approval.',
              )}
            />
          </Panel>
        )}
      </>
    );

  if (!analysis)
    return (
      <>
        <PageTitle
          eyebrow={tr('مساحة القرار المالي', 'FINANCIAL DECISION WORKSPACE')}
          title={tr('ابدأ بصورة أوضح لشركتك', 'A clearer picture starts here')}
          description={tr(
            'ارفع قوائمك المالية لنربط الأرقام بالأسباب والقرارات.',
            'Upload your statements to connect numbers, causes, and decisions.',
          )}
        />
        <Panel>
          <Empty
            title={
              String(session.user.role) === 'board'
                ? tr('لا توجد تقارير معتمدة بعد', 'No approved reports yet')
                : tr('مساحة العمل جاهزة', 'Your workspace is ready')
            }
            description={
              String(session.user.role) === 'board'
                ? tr(
                    'ستظهر التقارير هنا بعد اعتمادها من المدير المالي.',
                    'Reports appear here after CFO approval.',
                  )
                : tr(
                    'ابدأ بقوائم Excel أو PDF نصي أو ملف CSV. تحتفظ بصيرة بمصدر كل رقم.',
                    'Start with Excel, text PDF, or CSV. Basira retains a source for every figure.',
                  )
            }
            action={
              String(session.user.role) !== 'board' && (
                <Button onClick={() => navigate('data')}>
                  <Upload size={18} />
                  {tr('رفع القوائم المالية', 'Upload statements')}
                </Button>
              )
            }
          />
        </Panel>
      </>
    );
  const metrics = analysis.metrics.filter((m) => m.period === period),
    facts = dataset?.facts || [];
  const fact = (key: string) => {
    const matches = facts.filter((f) => f.period === period && f.concept === key);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const metric = (key: string) => metrics.find((m) => m.key === key);
  const revenue = fact('revenue'),
    cfo = fact('cfo'),
    margin = metric('gross_margin'),
    conversion = metric('cash_conversion') || metric('cfo_to_net_income');
  let items = [
    {
      label: tr('الإيرادات', 'Revenue'),
      value: revenue?.value,
      unit: 'currency',
      icon: TrendingUp,
      target: revenue,
      foot: tr('قيمة النشاط خلال الفترة', 'Activity during the period'),
    },
    {
      label: tr('النقد التشغيلي', 'Operating cash flow'),
      value: cfo?.value,
      unit: 'currency',
      icon: Wallet,
      target: cfo,
      foot: tr('من قائمة التدفقات النقدية', 'From the cash flow statement'),
    },
    {
      label: tr('الهامش الإجمالي', 'Gross margin'),
      value: margin?.value,
      unit: 'percent',
      icon: ChartNoAxesCombined,
      target: margin,
      foot: tr('الربح الإجمالي / الإيراد', 'Gross profit / revenue'),
    },
    {
      label: tr('تحويل الربح إلى نقد', 'Cash conversion'),
      value: conversion?.value,
      unit: conversion?.unit || 'multiple',
      icon: ArrowUpRight,
      target: conversion,
      foot: tr('النقد التشغيلي / صافي الربح', 'Operating cash / net income'),
    },
  ];
  const profile = audiences.find((a) => a.id === audience)!;
  const views: Record<string, string[]> = {
    cfo: ['current_ratio', 'receivables_days', 'contract_assets_ratio', 'net_debt'],
    board: ['ebit_margin', 'cfo_to_net_income', 'net_debt', 'roa'],
    sales: ['revenue_growth', 'gross_margin', 'receivables_days', 'contract_assets_ratio'],
    analyst: ['revenue_growth', 'ebit_margin', 'cfo_to_net_income', 'current_ratio'],
    sector: ['revenue_growth', 'gross_margin', 'ebit_margin', 'operating_cash_margin'],
    operations: ['gross_margin', 'sga_ratio', 'contract_assets_ratio', 'receivables_days'],
  };
  if (views[audience])
    items = views[audience].map((key, i) => {
      const m = metric(key);
      return {
        label: m ? tr(m.label_ar, m.label_en) : key,
        value: m?.value,
        unit: m?.unit || 'number',
        icon: [TrendingUp, Wallet, ChartNoAxesCombined, ArrowUpRight][i],
        target: m,
        foot:
          m?.status === 'proxy'
            ? tr('مؤشر تقريبي · افحص التعريف', 'Proxy · inspect definition')
            : m?.period || period,
      };
    });
  const periods = analysis.periods || dataset?.periods || [];
  const chartValue = (key: string, p: string) => {
    const found = facts.filter((f) => f.period === p && f.concept === key);
    return found.length === 1 &&
      found[0].currency === dashboard?.entity.currency &&
      found[0].value !== null
      ? found[0].value / 1e9
      : null;
  };
  const chart = periods.map((p) => ({
    period: p,
    revenue: chartValue('revenue', p),
    cfo: chartValue('cfo', p),
    profit: chartValue('net_income', p),
  }));
  const actions = dashboard?.actions || [],
    open = actions.filter((a) => !['closed', 'benefit_verified'].includes(a.status)),
    overdue = open.filter((a) => a.due_date < new Date().toISOString().slice(0, 10));
  const findings = analysis.findings.filter(
    (f) => analysis.finding_reviews?.[f.id]?.status !== 'rejected',
  );
  const quality = analysis.checks || [];
  const reviewed = facts.filter((f) => f.review_status === 'reviewed').length;
  return (
    <>
      <PageTitle
        eyebrow={tr('نظرة واحدة. قرارات أوضح.', 'ONE VIEW. CLEARER DECISIONS.')}
        title={tr('الصورة المالية', 'Financial overview')}
        description={`${session.tenant.demo && dashboard?.entity.name === 'Elm reference - demonstration' ? tr('شركة علم · بيانات مرجعية', 'Elm · reference data') : dashboard?.entity.name} · ${tr('السنة المالية', 'Financial year')} ${period}`}
        action={
          <Button
            onClick={() => navigate(String(session.user.role) === 'board' ? 'reports' : 'data')}
          >
            <FileCheck2 size={18} />
            {tr(
              String(session.user.role) === 'board' ? 'تقارير المجلس' : 'مراجعة البيانات',
              String(session.user.role) === 'board' ? 'Board reports' : 'Review data',
            )}
          </Button>
        }
      />
      <div className="context-strip">
        <span>
          <span className="status-dot" />
          {session.tenant.demo
            ? tr('بيانات علم المرجعية · للتجربة', 'Elm reference data · demo')
            : tr('مساحة عمل خاصة', 'Private workspace')}
        </span>
        <span>
          {tr('آخر نسخة بيانات', 'Data version')} <b>{dataset?.version || '—'}</b>
        </span>
        <Badge status={dataset?.status || 'draft'} />
        <button onClick={() => navigate('data')}>
          {tr('عرض مسار الاعتماد', 'Review approval status')}
          <ArrowUpLeft size={14} />
        </button>
      </div>
      <div className="audience-focus">
        <div>
          <span>{tr('أسئلة هذه القراءة', 'QUESTIONS FOR THIS READING')}</span>
          <strong>{tr(profile.label_ar, profile.label_en)}</strong>
        </div>
        <ul>
          {(locale === 'ar' ? profile.focus_ar : profile.focus_en).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <button className="text-link" onClick={() => navigate('reports')}>
          {tr('إعداد تقرير مخصص', 'Create tailored report')}
          <ArrowUpLeft size={15} />
        </button>
      </div>
      {['sales', 'sector', 'operations'].includes(audience) && (
        <Notice>
          {tr(
            'المؤشرات التالية على مستوى الشركة. القراءة التفصيلية لهذا المتلقي تحتاج: ',
            'The metrics below are company-wide. This reader’s detailed analysis requires: ',
          )}
          {(locale === 'ar' ? profile.data_needs_ar : profile.data_needs_en).join('، ')}
        </Notice>
      )}
      <div className="kpi-grid">
        {items.map((item) => (
          <button
            className="kpi-card"
            key={item.label}
            onClick={() => item.target && inspect(item.target)}
            disabled={!item.target}
          >
            <div className="kpi-top">
              <span>{item.label}</span>
              <item.icon size={19} />
            </div>
            <strong className="kpi-value" dir="ltr">
              {format(item.value, item.unit, true, locale)}
            </strong>
            <div className="kpi-bottom">
              <span>
                {item.unit === 'currency'
                  ? item.target && 'currency' in item.target
                    ? item.target.currency
                    : dashboard?.entity.currency || ''
                  : item.foot}
              </span>
              <ArrowUpLeft size={15} />
            </div>
          </button>
        ))}
      </div>
      <div className="overview-main">
        <Panel
          title={tr('النمو وجودة النقد', 'Growth & quality of cash')}
          subtitle={
            tr(
              'الإيرادات، الربح، والتدفق التشغيلي · مليار ',
              'Revenue, profit and operating cash · billion ',
            ) + dashboard?.entity.currency
          }
          action={
            <TextLink onClick={() => navigate('analysis')}>
              {tr('تفصيل المؤشرات', 'Explore metrics')}
            </TextLink>
          }
        >
          <div className="chart-legend">
            <span>
              <i style={{ background: '#0d8079' }} />
              {tr('الإيرادات', 'Revenue')}
            </span>
            <span>
              <i style={{ background: '#8dbcb6' }} />
              {tr('النقد التشغيلي', 'Operating cash')}
            </span>
            <span>
              <i style={{ background: '#d5e5e1' }} />
              {tr('صافي الربح', 'Net income')}
            </span>
          </div>
          <div
            className="chart"
            dir="ltr"
            role="img"
            aria-label={tr(
              'مقارنة الإيراد والنقد والربح لثلاث سنوات؛ البيانات التفصيلية في المؤشرات',
              'Revenue, cash and profit across three years; details in metrics',
            )}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} barGap={7} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edec" />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#697a7b', fontSize: 13 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#697a7b', fontSize: 12 }} />
                <Tooltip
                  formatter={(v, name) => [
                    `${format(Number(v))} ${tr('مليار', 'B')}`,
                    name === 'revenue'
                      ? tr('الإيراد', 'Revenue')
                      : name === 'cfo'
                        ? tr('النقد', 'Cash')
                        : tr('الربح', 'Profit'),
                  ]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #dee5e3' }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#0d8079"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="cfo"
                  fill="#8dbcb6"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="profit"
                  fill="#d5e5e1"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          className={`review-panel ${String(session.user.role) === 'board' ? 'board-review' : ''}`}
          title={tr('الثقة تبدأ من المصدر', 'Confidence starts at the source')}
        >
          <div className="review-symbol">
            <ShieldCheck size={34} />
          </div>
          <strong className="review-number">
            {reviewed}
            <span> / {facts.length}</span>
          </strong>
          <p>{tr('حقائق تمت مراجعتها', 'facts reviewed')}</p>
          <div className="progress-track">
            <span style={{ width: `${facts.length ? (reviewed / facts.length) * 100 : 0}%` }} />
          </div>
          <div className="checks-mini">
            {quality.slice(0, 3).map((c) => (
              <div key={c.id}>
                <CheckCircle2 size={15} className={c.status === 'pass' ? 'good' : 'warn'} />
                <span>{tr(c.label_ar, c.label_en)}</span>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate(String(session.user.role) === 'board' ? 'reports' : 'data')}
          >
            {tr(
              String(session.user.role) === 'board' ? 'التقرير المعتمد' : 'فتح مركز المراجعة',
              String(session.user.role) === 'board' ? 'Approved report' : 'Open review center',
            )}
            <ArrowUpLeft size={16} />
          </Button>
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title={tr('أولويات تستحق النقاش', 'Priorities worth discussing')}
          subtitle={
            tr('ملاحظات آخر فترة', 'Findings for latest period') +
            ' ' +
            analysis.periods.at(-1) +
            ' · ' +
            tr('مرتبطة بالدليل وقابلة للاعتراض', 'Evidence-linked and open to challenge')
          }
          action={
            <TextLink onClick={() => navigate('analysis')}>
              {tr('كل الملاحظات', 'All findings')}
            </TextLink>
          }
        >
          {findings.length ? (
            findings.slice(0, 3).map((f, i) => (
              <button className="finding-row" key={f.id} onClick={() => inspect(f)}>
                <span className={`finding-index severity-${f.severity}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="finding-title">
                    <h3>{tr(f.title_ar, f.title_en)}</h3>
                    <Badge status={f.evidence_status} />
                  </div>
                  <p>{tr(f.summary_ar, f.summary_en)}</p>
                </div>
                <ArrowUpLeft size={18} />
              </button>
            ))
          ) : (
            <Empty
              title={tr('لا ملاحظات مؤهلة حاليًا', 'No eligible findings')}
              description={tr(
                'غياب الملاحظات لا يثبت غياب المخاطر. راجع أهلية البيانات.',
                'No findings does not establish the absence of risk. Review data eligibility.',
              )}
            />
          )}
        </Panel>
        <Panel title={tr('من التحليل إلى التنفيذ', 'From insight to execution')}>
          <div className="action-counts">
            <div>
              <span className="counter-icon">
                <Target size={19} />
              </span>
              <strong>{open.length}</strong>
              <small>{tr('إجراءات مفتوحة', 'Open actions')}</small>
            </div>
            <div>
              <span className="counter-icon amber">
                <Clock3 size={19} />
              </span>
              <strong>{overdue.length}</strong>
              <small>{tr('تجاوزت الموعد', 'Overdue')}</small>
            </div>
          </div>
          {actions.length ? (
            <div className="compact-actions">
              {open.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => navigate(`actions?id=${a.id}`)}>
                  <span>{a.title}</span>
                  <Badge status={a.status} />
                </button>
              ))}
            </div>
          ) : (
            <p className="muted center">
              {tr(
                'حوّل ملاحظة إلى إجراء، وحدد مالكها ومقياس نجاحها.',
                'Turn a finding into an action with an owner and a success measure.',
              )}
            </p>
          )}
          <Button variant="secondary" onClick={() => navigate('actions')}>
            {tr('مساحة الإجراءات', 'Action workspace')}
            <ArrowUpLeft size={16} />
          </Button>
        </Panel>
      </div>
      <p className="page-footnote">
        <SearchCheck size={15} />
        {tr(
          'كل رقم قابل للفحص. المؤشرات التقريبية والبيانات الناقصة موضحة في تفاصيلها.',
          'Every number is inspectable. Proxies and missing data are identified in their details.',
        )}
      </p>
    </>
  );
}
