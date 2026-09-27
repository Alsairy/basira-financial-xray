import { ArrowUpLeft, HelpCircle, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { post } from '../api';
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
import { MetricTrend } from '../components/MetricTrend';
import { format, useApp } from '../context';
import type { Finding } from '../types';
const groups: Record<string, [string, string]> = {
  all: ['كل المؤشرات', 'All metrics'],
  growth: ['النمو', 'Growth'],
  profitability: ['الربحية', 'Profitability'],
  cash: ['النقد', 'Cash'],
  liquidity: ['السيولة', 'Liquidity'],
  working_capital: ['رأس المال العامل', 'Working capital'],
  funding: ['التمويل', 'Funding'],
  returns: ['العوائد', 'Returns'],
};
export default function Analysis() {
  const { tr, locale, dashboard, period, inspect, refresh, navigate, session } = useApp();
  const [tab, setTab] = useState('findings'),
    [group, setGroup] = useState('all'),
    [search, setSearch] = useState(''),
    [review, setReview] = useState<Finding | null>(null),
    [reviewState, setReviewState] = useState('accepted'),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const analysis = dashboard?.analysis;
  const metrics =
    analysis?.metrics.filter(
      (m) =>
        m.period === period &&
        (group === 'all' || m.group === group) &&
        `${m.label_ar} ${m.label_en}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const sortedPeriods = [...(analysis?.periods || [])].sort();
  const trendFor = (key: string) =>
    sortedPeriods.map((p) => {
      const m = analysis?.metrics.find((x) => x.key === key && x.period === p);
      return { period: p, value: m?.value ?? null, status: m?.status };
    });
  return (
    <>
      <PageTitle
        eyebrow={tr('أشعة مالية قابلة للفحص', 'AN INSPECTABLE FINANCIAL X-RAY')}
        title={tr('التشخيص والمؤشرات', 'Diagnosis & metrics')}
        description={tr(
          'افصل الحقيقة عن التفسير، ثم حوّل الملاحظة المؤهلة إلى قرار.',
          'Separate facts from interpretation, then turn supported findings into decisions.',
        )}
        action={
          <Button variant="secondary" onClick={() => navigate('scenarios')}>
            <SlidersHorizontal size={17} />
            {tr('اختبار الأثر', 'Model impact')}
          </Button>
        }
      />
      <div className="tab-bar" role="tablist">
        <button role="tab" aria-selected={tab === 'findings'} onClick={() => setTab('findings')}>
          {tr('الملاحظات', 'Findings')} <span>{analysis?.findings.length || 0}</span>
        </button>
        <button role="tab" aria-selected={tab === 'metrics'} onClick={() => setTab('metrics')}>
          {tr('مكتبة المؤشرات', 'Metric library')}{' '}
          <span>{analysis?.metrics.filter((m) => m.period === period).length || 0}</span>
        </button>
      </div>
      {!analysis ? (
        <Panel>
          <Empty
            title={tr('بانتظار قوائم مالية', 'Awaiting statements')}
            action={
              <Button onClick={() => navigate('data')}>{tr('مركز البيانات', 'Data center')}</Button>
            }
          />
        </Panel>
      ) : tab === 'findings' ? (
        <div className="findings-grid">
          {analysis.findings.map((f) => (
            <article key={f.id} className="panel finding-card">
              <div className="row between">
                <Badge status={f.severity} />
                <span className="muted mono">{f.rule_id}</span>
              </div>
              <h2>{tr(f.title_ar, f.title_en)}</h2>
              <p>{tr(f.summary_ar, f.summary_en)}</p>
              <div className="row gap wrap">
                <Badge status={f.evidence_status} />
                {analysis.finding_reviews?.[f.id] && (
                  <Badge status={analysis.finding_reviews[f.id].status} />
                )}
              </div>
              <div className="finding-question">
                <HelpCircle size={17} />
                <span>{(locale === 'ar' ? f.questions_ar : f.questions_en)[0]}</span>
              </div>
              <div className="finding-card-footer">
                <Button variant="secondary" onClick={() => inspect(f)}>
                  {tr('فحص الملاحظة', 'Inspect finding')}
                  <ArrowUpLeft size={15} />
                </Button>
                {['cfo', 'analyst'].includes(session.user.role) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setReview(f);
                      setReason('');
                      setError(null);
                    }}
                  >
                    {tr('تسجيل موقف', 'Review')}
                  </Button>
                )}
              </div>
            </article>
          ))}
          {!analysis.findings.length && (
            <Panel>
              <Empty
                title={tr('لم تتأهل ملاحظات', 'No eligible findings')}
                description={tr(
                  'راجع نواقص البيانات وحدود المؤشرات قبل استخلاص حكم عام.',
                  'Review missing data and metric limitations before reaching a broader conclusion.',
                )}
              />
            </Panel>
          )}
        </div>
      ) : (
        <Panel>
          <div className="filter-bar">
            <div className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('بحث في المؤشرات…', 'Search metrics…')}
                aria-label={tr('بحث المؤشرات', 'Search metrics')}
              />
            </div>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label={tr('مجموعة المؤشر', 'Metric group')}
            >
              {Object.entries(groups).map(([k, l]) => (
                <option value={k} key={k}>
                  {tr(...l)}
                </option>
              ))}
            </select>
            <span className="muted">
              {period} · {metrics.length} {tr('مؤشر', 'metrics')}
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('المؤشر', 'Metric')}</th>
                  <th>{tr('القيمة', 'Value')}</th>
                  <th>{tr('الاتجاه', 'Trend')}</th>
                  <th>{tr('الأهلية', 'Eligibility')}</th>
                  <th>{tr('التفسير والمنهج', 'Definition & method')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <button className="cell-link" onClick={() => inspect(m)}>
                        {tr(m.label_ar, m.label_en)}
                      </button>
                      <small className="block muted">
                        {tr(...(groups[m.group] || groups.all))}
                      </small>
                    </td>
                    <td className="number strong">{format(m.value, m.unit, true, locale)}</td>
                    <td>
                      <MetricTrend points={trendFor(m.key)} unit={m.unit} locale={locale} tr={tr} />
                    </td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td className="definition-cell">{tr(m.explanation_ar, m.explanation_en)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`${tr('فحص', 'Inspect')} ${tr(m.label_ar, m.label_en)}`}
                        onClick={() => inspect(m)}
                      >
                        <ArrowUpLeft size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={tr('مراجعة الملاحظة', 'Review finding')}
        description={review ? tr(review.title_ar, review.title_en) : ''}
      >
        <Field label={tr('قرار المراجعة', 'Review decision')}>
          <select value={reviewState} onChange={(e) => setReviewState(e.target.value)}>
            <option value="accepted">{tr('قبول الملاحظة', 'Accept finding')}</option>
            <option value="needs_data">{tr('تحتاج بيانات إضافية', 'Needs more data')}</option>
            <option value="rejected">{tr('استبعاد مع بيان السبب', 'Reject with reason')}</option>
          </select>
        </Field>
        <Field label={tr('السبب أو البيانات المطلوبة', 'Reason or required data')}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
        </Field>
        <Notice>
          {tr(
            'الاعتراض محفوظ في سجل التدقيق؛ لا يحذف الأرقام أو النسخ السابقة.',
            'Reviews are recorded in the audit log; facts and earlier versions are preserved.',
          )}
        </Notice>
        {!!error && <ErrorBox error={error} />}
        <div className="modal-footer">
          <Button
            disabled={!reason.trim()}
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post(`/findings/${analysis?.id}/${review?.id}/review`, {
                  status: reviewState,
                  reason,
                });
                await refresh();
                setReview(null);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr('حفظ القرار', 'Save review')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
