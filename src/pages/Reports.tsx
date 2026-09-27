import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpLeft,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { api, post } from '../api';
import { audiences, AudienceSelector } from '../components/AudienceSelector';
import {
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Notice,
  PageTitle,
  Panel,
} from '../components/ui';
import { useApp } from '../context';
import type { Report } from '../types';
const sectionLabels: Record<string, [string, string]> = {
  decision_brief: ['موجز القرار', 'Decision brief'],
  material_risks: ['المخاطر الجوهرية', 'Material risks'],
  capital_allocation: ['تخصيص رأس المال', 'Capital allocation'],
  execution_assurance: ['متابعة التنفيذ', 'Execution assurance'],
  evidence_appendix: ['ملحق الدليل', 'Evidence appendix'],
  executive_reading: ['القراءة التنفيذية', 'Executive reading'],
  strengths: ['ما يبرز', 'What stands out'],
  watchpoints: ['ما يستحق المراقبة', 'Worth watching'],
  management_questions: ['أسئلة الإدارة', 'Management questions'],
  next_90_days: ['أولويات 90 يومًا', 'Next 90 days'],
  financial_control: ['الرقابة المالية', 'Financial control'],
  reconciliation: ['المصالحة', 'Reconciliation'],
  cash_and_working_capital: ['النقد ورأس المال العامل', 'Cash & working capital'],
  scenario_assumptions: ['السيناريوهات والافتراضات', 'Scenarios & assumptions'],
  funding_and_covenants: ['التمويل والتعهدات', 'Funding & covenants'],
  benefit_ledger: ['سجل الأثر', 'Benefit ledger'],
  commercial_context: ['السياق التجاري', 'Commercial context'],
  revenue_quality: ['جودة الإيراد', 'Revenue quality'],
  collections_handoff: ['البيع إلى التحصيل', 'Sales to collections'],
  customer_economics: ['اقتصاديات العملاء', 'Customer economics'],
  commercial_actions: ['الإجراءات التجارية', 'Commercial actions'],
  missing_data: ['البيانات المطلوبة', 'Required data'],
  analytical_scope: ['نطاق التحليل', 'Analytical scope'],
  metric_dictionary: ['قاموس المؤشرات', 'Metric dictionary'],
  source_lineage: ['مسار المصادر', 'Source lineage'],
  comparability: ['أهلية المقارنة', 'Comparability'],
  sensitivity: ['الحساسية', 'Sensitivity'],
  limitations: ['حدود القراءة', 'Limitations'],
  unit_scope: ['نطاق القطاع', 'Unit scope'],
  segment_performance: ['أداء القطاع', 'Segment performance'],
  controllable_costs: ['التكاليف القابلة للتحكم', 'Controllable costs'],
  unit_actions: ['إجراءات القطاع', 'Unit actions'],
  operating_context: ['السياق التشغيلي', 'Operating context'],
  margin_drivers: ['محركات الهامش', 'Margin drivers'],
  work_to_cash: ['من الإنجاز إلى النقد', 'Work to cash'],
  delivery_actions: ['إجراءات التنفيذ', 'Delivery actions'],
};
export default function Reports() {
  const { tr, locale, entityId, dashboard, audience, setAudience, session, notify } = useApp();
  const [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Report | null>(null),
    [reportAudience, setReportAudience] = useState(audience),
    [purpose, setPurpose] = useState('periodic_review'),
    [detail, setDetail] = useState('standard'),
    [questions, setQuestions] = useState(''),
    [language, setLanguage] = useState(locale),
    [busy, setBusy] = useState(''),
    [error, setError] = useState<unknown>(null);
  const query = useQuery({
    queryKey: ['reports', entityId],
    queryFn: () => api<Report[]>(`/reports?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const profile = audiences.find((a) => a.id === reportAudience)!;
  const approve = async (id: string) => {
    setBusy('approve');
    setError(null);
    try {
      const r = await post<Report>(`/reports/${id}/approve`);
      setSelected(r);
      await query.refetch();
      notify(tr('اعتمد التقرير كنسخة ثابتة', 'Report approved as a frozen snapshot'));
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <PageTitle
        eyebrow={tr(
          'حقيقة واحدة. قراءة تناسب القرار.',
          'ONE SOURCE OF TRUTH. A VIEW FOR EVERY DECISION.',
        )}
        title={tr('التقارير ومساحة المجلس', 'Reports & boardroom')}
        description={tr(
          'اختر المتلقي، فتتغير الأسئلة والأولويات وعمق القراءة، مع ثبات الأرقام.',
          'Choose the recipient to tailor questions, priorities and detail, while keeping the figures consistent.',
        )}
        action={
          ['cfo', 'analyst'].includes(session.user.role) && (
            <Button
              onClick={() => {
                setReportAudience(audience);
                setError(null);
                setCreate(true);
              }}
            >
              <Plus size={17} />
              {tr('إعداد تقرير', 'Create report')}
            </Button>
          )
        }
      />
      <div className="audience-banner">
        <span className="audience-icon">
          <Users size={25} />
        </span>
        <div>
          <h2>{tr('التقرير يبدأ بمن سيقرأه', 'The report starts with its reader')}</h2>
          <p>
            {tr(
              'مجلس يريد قرارًا، رئيس يريد أولوية، ومدير مالي يريد دليلًا ومصالحة.',
              'A board needs a decision, a CEO needs priorities, and a CFO needs evidence and reconciliation.',
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setReportAudience(audience);
            setCreate(true);
          }}
          disabled={session.user.role === 'board' || session.user.role === 'operator'}
        >
          {tr('تخصيص تقرير', 'Tailor a report')}
          <ArrowUpLeft size={16} />
        </Button>
      </div>
      {query.error && <ErrorBox error={query.error} />}
      {query.data?.length ? (
        <div className="report-grid">
          {query.data.map((r) => {
            const a = audiences.find((a) => a.id === r.audience);
            return (
              <article className="panel report-card" key={r.id}>
                <div className={`report-cover ${r.audience || 'ceo'}`}>
                  <span className="report-cover-brand">
                    بصيرة <small>BASIRA</small>
                  </span>
                  <span>
                    {a ? tr(a.label_ar, a.label_en) : tr('تقرير مالي', 'Financial report')}
                  </span>
                  <div className="report-cover-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <FileText size={42} />
                </div>
                <div className="report-card-body">
                  <div className="row between">
                    <Badge status={r.status} />
                    <small className="muted">{r.language === 'ar' ? 'العربية' : 'English'}</small>
                  </div>
                  <h2>{r.title}</h2>
                  <p>
                    {new Date(r.created_at).toLocaleDateString(locale)} ·{' '}
                    {tr('نسخة ثابتة من التحليل', 'Frozen analysis snapshot')}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setError(null);
                      try {
                        setSelected(await api<Report>(`/reports/${r.id}`));
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    <Eye size={17} />
                    {tr('قراءة التقرير', 'Read report')}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel>
          <Empty
            icon={<FileText size={32} />}
            title={tr('مساحة مخصصة للتقارير المعتمدة', 'A home for approved reports')}
            description={tr(
              'إعداد التقرير ينشئ نسخة ثابتة للمراجعة. المجلس يرى النسخ المعتمدة فقط.',
              'Creating a report captures a snapshot for review. Board readers see approved versions only.',
            )}
            action={
              ['cfo', 'analyst'].includes(session.user.role) && (
                <Button onClick={() => setCreate(true)}>
                  {tr('إعداد التقرير الأول', 'Create first report')}
                </Button>
              )
            }
          />
        </Panel>
      )}
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title={tr('لمن نُعد هذا التقرير؟', 'Who is this report for?')}
        description={tr(
          'المتلقي يحدد طريقة القراءة؛ الصلاحيات تحدد ما يمكن الوصول إليه.',
          'The audience shapes the reading experience; permissions determine access.',
        )}
        wide
      >
        <AudienceSelector value={reportAudience} onChange={setReportAudience} />
        <div className="report-outline">
          <div>
            <h3>{tr('بنية التقرير', 'Report structure')}</h3>
            <ol>
              {profile.sections.map((s) => (
                <li key={s}>{sectionLabels[s] ? tr(...sectionLabels[s]) : s}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3>{tr('أسئلة هذا المتلقي', 'Questions for this reader')}</h3>
            <ul>
              {(locale === 'ar' ? profile.focus_ar : profile.focus_en).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <small className="muted">
              <Clock3 size={14} />
              {tr('قراءة مستهدفة', 'Target read')} {profile.reading_minutes}{' '}
              {tr('دقائق', 'minutes')}
            </small>
          </div>
        </div>
        {['sales', 'sector', 'operations'].includes(reportAudience) && (
          <Notice type="warning">
            {tr(
              'البيانات المجمعة تعطي سياق الشركة فقط. التفاصيل الوظيفية تتطلب: ',
              'Consolidated data provides company context only. Functional detail requires: ',
            )}
            {(locale === 'ar' ? profile.data_needs_ar : profile.data_needs_en).join('، ')}
          </Notice>
        )}
        <div className="form-grid">
          <Field label={tr('الغرض', 'Purpose')}>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="periodic_review">
                {tr('مراجعة دورية للأداء', 'Periodic performance review')}
              </option>
              <option value="performance_improvement">
                {tr('تحسين الأداء', 'Performance improvement')}
              </option>
              <option value="capital_decision">
                {tr('قرار استثماري أو تمويلي', 'Capital or financing decision')}
              </option>
              <option value="initiative_followup">
                {tr('متابعة المبادرات', 'Initiative follow-up')}
              </option>
            </select>
          </Field>
          <Field label={tr('عمق القراءة', 'Reading depth')}>
            <select value={detail} onChange={(e) => setDetail(e.target.value)}>
              <option value="brief">{tr('موجز تنفيذي', 'Executive brief')}</option>
              <option value="standard">
                {tr('تقرير مع روابط للتفصيل', 'Report with drill-down links')}
              </option>
              <option value="detailed">
                {tr('تفصيلي مع ملحق المنهج', 'Detailed with methodology')}
              </option>
            </select>
          </Field>
          <Field label={tr('لغة التقرير', 'Report language')}>
            <select value={language} onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
        <Field label={tr('أسئلة إضافية تحتاج الإجابة', 'Additional questions to address')}>
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder={tr(
              'سؤال في كل سطر؛ الإجابة مشروطة بالبيانات المتاحة.',
              'One question per line; answers depend on available evidence.',
            )}
          />
        </Field>
        {!!error && <ErrorBox error={error} />}
        <div className="modal-footer">
          <Button variant="secondary" onClick={() => setCreate(false)}>
            {tr('إلغاء', 'Cancel')}
          </Button>
          <Button
            disabled={!dashboard?.analysis}
            busy={busy === 'create'}
            onClick={async () => {
              setBusy('create');
              setError(null);
              try {
                const r = await post<Report>('/reports', {
                  entity_id: entityId,
                  analysis_id: dashboard?.analysis?.id,
                  title: `${tr('قراءة', 'Financial reading')} ${dashboard?.entity.name} — ${tr(profile.label_ar, profile.label_en)}`,
                  language,
                  audience: reportAudience,
                  purpose,
                  detail_level: detail,
                  focus_questions: questions.split('\n').filter(Boolean),
                });
                setAudience(reportAudience);
                await query.refetch();
                setCreate(false);
                setSelected(r);
                notify(tr('أُنشئت المسودة للمراجعة', 'Draft created for review'));
              } catch (e) {
                setError(e);
              } finally {
                setBusy('');
              }
            }}
          >
            {tr('إنشاء مسودة مخصصة', 'Create tailored draft')}
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || ''}
        description={tr(
          'كل تقرير مرتبط بإصدار بيانات وقالب وجمهور ثابت.',
          'Each report freezes its data version, template and audience.',
        )}
        wide
      >
        {selected && (
          <>
            <div className="report-controls">
              <div className="row gap">
                <Badge status={selected.status} />
                <Badge>
                  {audiences.find((a) => a.id === selected.audience)?.[
                    locale === 'ar' ? 'label_ar' : 'label_en'
                  ] || selected.audience}
                </Badge>
              </div>
              <div className="row gap wrap">
                <a
                  className="btn btn-secondary"
                  href={`/api/reports/${selected.id}/export?format=html`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} />
                  {tr('فتح / طباعة PDF', 'Open / print PDF')}
                </a>
                <a
                  className="btn btn-ghost"
                  href={`/api/reports/${selected.id}/export?format=json`}
                  download
                >
                  <Download size={16} />
                  JSON
                </a>
                {session.user.role === 'cfo' && selected.status !== 'approved' && (
                  <Button busy={busy === 'approve'} onClick={() => approve(selected.id)}>
                    <ShieldCheck size={16} />
                    {tr('اعتماد مستقل', 'Independent approval')}
                  </Button>
                )}
              </div>
            </div>
            {!!error && <ErrorBox error={error} />}
            <iframe
              className="report-preview"
              title={tr('معاينة التقرير المحفوظ', 'Saved report preview')}
              src={`/api/reports/${selected.id}/export?format=html`}
            />
            <Notice>
              {tr(
                'للحصول على PDF افتح التقرير واختر طباعة ثم حفظ كـ PDF. روابط التفاصيل داخل مساحة العمل تتطلب تسجيل الدخول والصلاحية المناسبة.',
                'For PDF, open the report and choose Print, then Save as PDF. Workspace detail links require sign-in and appropriate access.',
              )}
            </Notice>
          </>
        )}
      </Modal>
    </>
  );
}
