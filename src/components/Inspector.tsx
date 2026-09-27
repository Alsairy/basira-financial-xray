import { ArrowUpLeft, Calculator, FileText, GitBranch, ShieldCheck } from 'lucide-react';
import { format, useApp } from '../context';
import type { Fact, Finding, Metric } from '../types';
import { Badge, Button, Modal, Notice, Panel } from './ui';
import { MetricTrend } from './MetricTrend';
export function Inspector({
  item,
  onClose,
}: {
  item: Fact | Metric | Finding | null;
  onClose: () => void;
}) {
  const { tr, locale, dashboard, navigate, inspect, session } = useApp();
  if (!item) return null;
  const finding = 'rule_id' in item ? item : null;
  const metric = 'key' in item ? item : null;
  const fact = 'concept' in item ? item : null;
  const label = finding
    ? tr(finding.title_ar, finding.title_en)
    : metric
      ? tr(metric.label_ar, metric.label_en)
      : tr(fact!.label_ar, fact!.label_en);
  const ids = finding?.source_refs || metric?.inputs || [];
  const evidencePeriod = metric?.period || dashboard?.analysis?.periods.at(-1);
  const facts =
    dashboard?.dataset?.facts?.filter(
      (f) => ids.includes(f.id) || (ids.includes(f.concept) && f.period === evidencePeriod),
    ) || [];
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={label}
      description={tr(
        'مسار الدليل · من الاستنتاج إلى الرقم الأصلي',
        'Evidence trail · from conclusion to original fact',
      )}
      wide
    >
      {finding && (
        <>
          <div className="row gap">
            <Badge status={finding.severity} />
            <Badge status={finding.evidence_status} />
            <code>{finding.rule_id}</code>
          </div>
          <p className="lead">{tr(finding.summary_ar, finding.summary_en)}</p>
          <Panel title={tr('ما نحتاج التحقق منه', 'Questions to resolve')}>
            <ul className="question-list">
              {(locale === 'ar' ? finding.questions_ar : finding.questions_en).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </Panel>
          <div className="metric-evidence">
            {dashboard?.analysis?.metrics
              .filter((m) => finding.metric_ids.includes(m.id))
              .map((m) => (
                <button key={m.id} onClick={() => inspect(m)}>
                  <Calculator size={18} />
                  <span>
                    {tr(m.label_ar, m.label_en)} <small>{m.period}</small>
                  </span>
                  <strong dir="ltr">{format(m.value, m.unit, true, locale)}</strong>
                  <ArrowUpLeft size={16} />
                </button>
              ))}
          </div>
          <Notice>{tr(finding.action_ar, finding.action_en)}</Notice>
          <div className="modal-footer">
            <Button
              onClick={() => {
                onClose();
                navigate(
                  session.user.role === 'board' ? 'reports' : `actions?finding=${finding.id}`,
                );
              }}
            >
              {tr(
                session.user.role === 'board' ? 'قراءة التقرير المعتمد' : 'تحويل إلى إجراء',
                session.user.role === 'board' ? 'Read approved report' : 'Create action',
              )}
            </Button>
          </div>
        </>
      )}
      {metric && (
        <>
          <div className="source-value">
            <span>{metric.period}</span>
            <strong dir="ltr">{format(metric.value, metric.unit, false, locale)}</strong>
            <Badge status={metric.status} />
          </div>
          {(() => {
            const periods = [...(dashboard?.analysis?.periods || [])].sort();
            if (periods.length < 2) return null;
            const points = periods.map((p) => {
              const m = dashboard?.analysis?.metrics.find(
                (x) => x.key === metric.key && x.period === p,
              );
              return { period: p, value: m?.value ?? null, status: m?.status };
            });
            return (
              <div className="inspector-trend">
                <MetricTrend
                  points={points}
                  unit={metric.unit}
                  locale={locale}
                  tr={tr}
                  size="detailed"
                />
              </div>
            );
          })()}
          <p>{tr(metric.explanation_ar, metric.explanation_en)}</p>
          <div className="formula">
            <Calculator size={18} />
            <code dir="ltr">{metric.formula}</code>
          </div>
        </>
      )}
      {fact && (
        <>
          <div className="source-value">
            <span>
              {fact.period} · {fact.currency}
            </span>
            <strong dir="ltr">{format(fact.value, fact.unit)}</strong>
            <Badge status={fact.review_status} />
          </div>
          <dl className="detail-grid">
            <div>
              <dt>{tr('القيمة في المستند', 'Value in document')}</dt>
              <dd dir="ltr">
                {format(fact.original_value)} × {fact.scale}
              </dd>
            </div>
            <div>
              <dt>{tr('المفهوم المالي', 'Financial concept')}</dt>
              <dd dir="ltr">{fact.concept}</dd>
            </div>
            <div>
              <dt>{tr('المصدر', 'Source')}</dt>
              <dd dir="ltr">
                {fact.source.sheet} {fact.source.cell}
                {fact.source.page && ` · p.${fact.source.page}`}
              </dd>
            </div>
            <div>
              <dt>{tr('نطاق التقرير', 'Scope')}</dt>
              <dd>{fact.scope}</dd>
            </div>
          </dl>
          {fact.formula && (
            <div className="formula">
              <code dir="ltr">{fact.formula}</code>
              <Badge>{fact.cache_status}</Badge>
            </div>
          )}
          <Notice>
            {tr(
              'القيمة الأصلية محفوظة. أي تعديل يسجل سببه وإصداره في سجل التدقيق.',
              'The original value is preserved. Every adjustment records its reason and version in the audit log.',
            )}
          </Notice>
        </>
      )}
      {!!facts.length && (
        <section className="evidence-section">
          <h3>
            <GitBranch size={18} />
            {tr('الحقائق المستخدمة', 'Underlying facts')}
          </h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('البند', 'Fact')}</th>
                  <th>{tr('الفترة', 'Period')}</th>
                  <th>{tr('القيمة', 'Value')}</th>
                  <th>{tr('المرجع', 'Reference')}</th>
                </tr>
              </thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <button className="cell-link" onClick={() => inspect(f)}>
                        {tr(f.label_ar, f.label_en)}
                      </button>
                    </td>
                    <td>{f.period}</td>
                    <td className="number">{format(f.value)}</td>
                    <td dir="ltr">
                      {f.source.sheet} {f.source.cell}
                      {f.source.page && `p.${f.source.page}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {dashboard?.dataset?.document_id && (
        <a
          className="btn btn-secondary"
          href={`/api/documents/${dashboard.dataset.document_id}/content`}
          target="_blank"
          rel="noreferrer"
        >
          <FileText size={17} />
          {tr('فتح المستند الأصلي', 'Open original document')}
        </a>
      )}
      <p className="fine-print">
        <ShieldCheck size={14} />
        {tr(
          'الحسابات حتمية. التفسير يخضع للمراجعة المالية.',
          'Calculations are deterministic. Interpretation requires financial review.',
        )}
      </p>
    </Modal>
  );
}
