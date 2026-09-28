import { useQuery } from '@tanstack/react-query';
import { Globe2, Plus, Scale } from 'lucide-react';
import { useState } from 'react';
import { api, post } from '../api';
import { BenchmarkDistribution } from '../components/BenchmarkDistribution';
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
import { format, useApp } from '../context';
interface Peer {
  id: string;
  name: string;
  sector: string;
  country: string;
  currency: string;
  period: string;
  source_url: string;
  rights_basis: string;
  metrics: Record<string, number>;
  definition_notes: string;
}
interface Benchmark {
  id: string;
  metric_key: string;
  company_value: number | null;
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  rank?: number;
  eligible: boolean;
  exclusions: unknown[];
  warnings: string[];
  peers: Peer[];
}
interface ClassificationCode {
  code: string;
  title: string;
}
interface GlobalBenchmark {
  available: boolean;
  sector_code?: string;
  label_ar?: string;
  label_en?: string;
  classification?: {
    isic: ClassificationCode;
    naics: ClassificationCode;
    gics: ClassificationCode;
  };
  classification_caveat?: string;
  global_average?: {
    source_name: string;
    damodaran_industry: string;
    source_page: string;
    data_as_of: string;
    n_firms: number;
    region: string;
    metrics: Record<string, number>;
    industry_match_caveat?: string;
    average_only_caveat: string;
  };
}
export default function Benchmarks() {
  const { tr, locale, entityId, dashboard, period, notify } = useApp();
  const [add, setAdd] = useState(false),
    [metricKey, setMetricKey] = useState('gross_margin'),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [result, setResult] = useState<Benchmark | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const peers = useQuery({
    queryKey: ['peers', entityId],
    queryFn: () => api<Peer[]>(`/peers?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const sectorCode = dashboard?.entity.sector_code;
  const globalBenchmark = useQuery({
    queryKey: ['global-benchmark', sectorCode],
    queryFn: () => api<GlobalBenchmark>(`/global-benchmark?sector_code=${sectorCode}`),
    enabled: !!sectorCode,
  });
  const globalMetricValue = globalBenchmark.data?.available
    ? globalBenchmark.data.global_average?.metrics[metricKey]
    : undefined;
  const metrics =
    dashboard?.analysis?.metrics.filter((m) => m.period === period && m.value !== null) || [];
  const metric = metrics.find((m) => m.key === metricKey);
  const history = dashboard?.analysis?.metrics.filter((m) => m.key === metricKey) || [];
  return (
    <>
      <PageTitle
        eyebrow={tr('المقارنة تبدأ بالتجانس', 'COMPARABILITY COMES FIRST')}
        title={tr('النظراء والمعايير المرجعية', 'Peers & benchmarks')}
        description={tr(
          'قارن تاريخ الشركة أو عينة موثّقة. اطلع على التعريف قبل الحكم على الفارق.',
          'Compare company history or a documented cohort. Review definitions before interpreting the gap.',
        )}
        action={
          <Button onClick={() => setAdd(true)}>
            <Plus size={17} />
            {tr('إضافة نظير موثّق', 'Add documented peer')}
          </Button>
        }
      />
      <Notice>
        {tr(
          'لا توجد قاعدة عالمية مرخصة (مدفوعة) متصلة حاليًا. مقارنة النظراء بالاسم تعتمد على بيانات تضيفها بإذن استخدام؛ لا تمثل ترتيبًا عالميًا أو تطابقًا تلقائيًا في نموذج العمل. أسفل الصفحة متوسط قطاعي عالمي مجاني (Damodaran) عند توفره لقطاع الشركة — وهو رقم متوسط واحد لا توزيع، منفصل تمامًا عن مقارنة النظراء بالاسم.',
          'No licensed (paid) global dataset is connected. Named peer comparison uses authorized data you provide and does not represent a global ranking or automatic business-model match. A free global sector average (Damodaran) appears below when available for the company sector — a single average figure, not a distribution, entirely separate from the named peer comparison.',
        )}
      </Notice>
      <Panel title={tr('اختر المؤشر', 'Choose a metric')}>
        <div className="filter-bar">
          <select
            aria-label={tr('المؤشر المرجعي', 'Benchmark metric')}
            value={metricKey}
            onChange={(e) => {
              setMetricKey(e.target.value);
              setResult(null);
            }}
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {tr(m.label_ar, m.label_en)}
              </option>
            ))}
          </select>
          <Badge status={metric?.status} />
          <span className="muted">{metric?.formula}</span>
        </div>
        <div className="historical-comparison">
          {history.map((m) => (
            <div key={m.id}>
              <span>{m.period}</span>
              <strong dir="ltr">{format(m.value, m.unit, false, locale)}</strong>
              <div className="history-bar">
                <i
                  style={{
                    width: `${Math.max(0, Math.min(100, ((m.value || 0) / Math.max(...history.map((x) => Math.abs(x.value || 0)), 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {globalBenchmark.data?.available && globalBenchmark.data.classification && globalBenchmark.data.global_average && (
        <Panel
          title={tr('المتوسط العالمي للقطاع (مجاني)', 'Global sector average (free)')}
          subtitle={tr(globalBenchmark.data.label_ar || '', globalBenchmark.data.label_en || '')}
        >
          <div className="global-benchmark-codes">
            <span>
              <b>ISIC</b> {globalBenchmark.data.classification.isic.code} —{' '}
              {globalBenchmark.data.classification.isic.title}
            </span>
            <span>
              <b>NAICS</b> {globalBenchmark.data.classification.naics.code} —{' '}
              {globalBenchmark.data.classification.naics.title}
            </span>
            <span>
              <b>GICS</b> {globalBenchmark.data.classification.gics.code} —{' '}
              {globalBenchmark.data.classification.gics.title}
            </span>
          </div>
          {typeof globalMetricValue === 'number' && (
            <div className="benchmark-values">
              <div>
                <span>
                  {tr('متوسط', 'Average')} — {globalBenchmark.data.global_average.damodaran_industry}
                </span>
                <strong dir="ltr">{format(globalMetricValue, metric?.unit)}</strong>
              </div>
            </div>
          )}
          <p className="muted">
            {tr(
              `${globalBenchmark.data.global_average.source_name} · ${globalBenchmark.data.global_average.n_firms} شركة · بيانات ${globalBenchmark.data.global_average.data_as_of} · ${globalBenchmark.data.global_average.region}`,
              `${globalBenchmark.data.global_average.source_name} · ${globalBenchmark.data.global_average.n_firms} firms · data as of ${globalBenchmark.data.global_average.data_as_of} · ${globalBenchmark.data.global_average.region}`,
            )}{' '}
            —{' '}
            <a href={globalBenchmark.data.global_average.source_page} target="_blank" rel="noreferrer">
              {globalBenchmark.data.global_average.source_page}
            </a>
          </p>
          <Notice type="warning">{globalBenchmark.data.global_average.average_only_caveat}</Notice>
          {globalBenchmark.data.global_average.industry_match_caveat && (
            <Notice type="warning">{globalBenchmark.data.global_average.industry_match_caveat}</Notice>
          )}
          {globalBenchmark.data.classification_caveat && (
            <Notice type="warning">{globalBenchmark.data.classification_caveat}</Notice>
          )}
        </Panel>
      )}
      <div className="benchmark-layout">
        <Panel
          title={tr('العينة المختارة', 'Selected peer cohort')}
          subtitle={tr(
            'راجع القطاع والفترة والعملة والتعريف وحقوق الاستخدام.',
            'Review sector, period, currency, definition and usage rights.',
          )}
        >
          <div className="peer-list">
            {peers.data?.length ? (
              peers.data.map((p) => (
                <label className="peer-card" key={p.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        e.target.checked ? n.add(p.id) : n.delete(p.id);
                        return n;
                      });
                      setResult(null);
                    }}
                  />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sector} · {p.country} · {p.period} · {p.currency}
                    </small>
                    <span className="muted">{p.definition_notes}</span>
                  </span>
                  <b dir="ltr">{format(p.metrics[metricKey], metric?.unit)}</b>
                </label>
              ))
            ) : (
              <Empty
                icon={<Globe2 size={29} />}
                title={tr('ابنِ عينة يمكن الدفاع عنها', 'Build a defensible cohort')}
                description={tr(
                  'أضف مصدرًا وحقوق استخدام وتعريفًا لكل نظير.',
                  'Add a source, usage rights and metric definition for each peer.',
                )}
              />
            )}
          </div>
          {!!error && <ErrorBox error={error} />}
          <Button
            disabled={!selected.size}
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                setResult(
                  await post<Benchmark>('/benchmarks', {
                    entity_id: entityId,
                    metric_key: metricKey,
                    peer_ids: [...selected],
                  }),
                );
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Scale size={17} />
            {tr('إنشاء مقارنة ثابتة', 'Create comparison snapshot')}
          </Button>
        </Panel>
        <Panel title={tr('قراءة المقارنة', 'Comparison reading')}>
          {result ? (
            <>
              {result.n > 0 && (
                <BenchmarkDistribution
                  companyLabel={dashboard?.entity.name || tr('الشركة', 'Company')}
                  companyValue={result.company_value}
                  peers={result.peers.map((p) => ({
                    id: p.id,
                    name: p.name,
                    value: p.metrics[result.metric_key],
                  }))}
                  median={result.median}
                  q1={result.q1}
                  q3={result.q3}
                  unit={metric?.unit || 'number'}
                  locale={locale}
                  tr={tr}
                  globalReference={
                    typeof globalMetricValue === 'number'
                      ? {
                          value: globalMetricValue,
                          label: tr(
                            `متوسط عالمي (${globalBenchmark.data?.global_average?.damodaran_industry})`,
                            `Global average (${globalBenchmark.data?.global_average?.damodaran_industry})`,
                          ),
                        }
                      : null
                  }
                />
              )}
              <div className="benchmark-values">
                <div>
                  <span>{dashboard?.entity.name}</span>
                  <strong dir="ltr">{format(result.company_value, metric?.unit)}</strong>
                </div>
                <div>
                  <span>{tr('وسيط العينة', 'Cohort median')}</span>
                  <strong dir="ltr">{format(result.median, metric?.unit)}</strong>
                </div>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>{tr('حجم العينة المؤهلة', 'Eligible sample size')}</dt>
                  <dd>{result.n}</dd>
                </div>
                <div>
                  <dt>{tr('نطاق الربيعين', 'Interquartile range')}</dt>
                  <dd dir="ltr">
                    {format(result.q1, metric?.unit)} – {format(result.q3, metric?.unit)}
                  </dd>
                </div>
              </dl>
              {result.warnings?.map((w, i) => (
                <Notice key={i} type="warning">
                  {w}
                </Notice>
              ))}
              {!!result.exclusions?.length && (
                <details>
                  <summary>
                    {tr('نظراء مستبعدون', 'Excluded peers')} ({result.exclusions.length})
                  </summary>
                  <pre>{JSON.stringify(result.exclusions, null, 2)}</pre>
                </details>
              )}
              <Notice>
                {tr(
                  'التقارب في القطاع وحده لا يثبت التجانس المحاسبي. هذه مقارنة وصفية لعينة يحددها المستخدم، وتحتاج مراجعة تعريف المقام والمزيج والاستحواذات.',
                  'Sector similarity does not establish accounting comparability. This is a descriptive user-selected cohort; review denominators, mix and acquisitions.',
                )}
              </Notice>
            </>
          ) : (
            <Empty
              icon={<Scale size={32} />}
              title={tr('التعريف قبل الترتيب', 'Definitions before rankings')}
              description={tr(
                'تُظهر المقارنة العينة المستعملة والاستبعادات وحدود الاستنتاج.',
                'Each comparison shows its cohort, exclusions and interpretation limits.',
              )}
            />
          )}
        </Panel>
      </div>
      <Modal
        open={add}
        onClose={() => setAdd(false)}
        title={tr('إضافة نظير بمصدر واضح', 'Add a sourced peer')}
        description={tr(
          'أدخل قيمة المؤشر بعد مطابقة تعريفه ووحدته. النسب المئوية من 0 إلى 100.',
          'Enter the metric after aligning its definition and unit. Percent values use 0–100.',
        )}
        wide
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            try {
              await post('/peers', {
                entity_id: entityId,
                name: f.get('name'),
                sector: f.get('sector'),
                country: f.get('country'),
                currency: f.get('currency'),
                period: f.get('period'),
                source_url: f.get('source_url'),
                rights_basis: f.get('rights_basis'),
                metrics: { [metricKey]: Number(f.get('value')) },
                definition_notes: f.get('definition_notes'),
              });
              await peers.refetch();
              setAdd(false);
              notify(tr('أُضيف النظير مع مصدره', 'Peer added with its source'));
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label={tr('الشركة', 'Company')}>
              <input name="name" required />
            </Field>
            <Field label={tr('القطاع', 'Sector')}>
              <input name="sector" defaultValue={dashboard?.entity.sector} required />
            </Field>
            <Field label={tr('الدولة', 'Country')}>
              <input name="country" defaultValue="Saudi Arabia" required />
            </Field>
            <Field label={tr('العملة', 'Currency')}>
              <input name="currency" defaultValue="SAR" required pattern="[A-Z]{3}" />
            </Field>
            <Field label={tr('الفترة', 'Period')}>
              <input name="period" defaultValue={period} required />
            </Field>
            <Field
              label={`${tr(metric?.label_ar || 'قيمة المؤشر', metric?.label_en || 'Metric value')} (${metric?.unit})`}
            >
              <input name="value" type="number" step="any" required />
            </Field>
          </div>
          <Field label={tr('رابط المصدر الأصلي', 'Original source URL')}>
            <input name="source_url" type="url" required placeholder="https://" dir="ltr" />
          </Field>
          <Field label={tr('أساس حق الاستخدام', 'Usage rights basis')}>
            <input
              name="rights_basis"
              required
              placeholder={tr(
                'إذن، ترخيص، أو أساس استخدام موثّق',
                'Permission, license or documented usage basis',
              )}
            />
          </Field>
          <Field
            label={tr(
              'التعريف والفروقات المحاسبية والمزيج',
              'Definition, accounting differences and business mix',
            )}
          >
            <textarea name="definition_notes" required defaultValue={metric?.formula} />
          </Field>
          {!!error && <ErrorBox error={error} />}
          <div className="modal-footer">
            <Button type="submit" busy={busy}>
              {tr('حفظ النظير', 'Save peer')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
