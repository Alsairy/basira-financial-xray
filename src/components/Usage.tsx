import { useQuery } from '@tanstack/react-query';
import { Calculator, Clock3, Plus } from 'lucide-react';
import { useState } from 'react';
import { api, post } from '../api';
import { format, useApp } from '../context';
import { Button, Empty, ErrorBox, Field, Notice, Panel } from './ui';
interface UsageData {
  as_of: string;
  jobs: {
    total: number;
    completed: number;
    failed: number;
    total_duration_ms: number;
    average_duration_ms: number;
  };
  engine: {
    total_calls: number;
    completed_calls: number;
    failed_calls: number;
    total_duration_ms: number;
    by_operation: Record<string, { calls: number; failed_calls: number; duration_ms: number }>;
    metering_note: string;
  };
  costs: {
    external_ai: { amount: number; currency: string; provider: string; status: string };
    ocr: { amount: number; currency: string; status: string };
    local_compute: { amount: null; status: string };
    review: {
      source: string;
      totals: { currency: string; minutes: number; amount: number }[];
      records: {
        id: string;
        minutes: number;
        hourly_rate: number;
        currency: string;
        amount: number;
        created_at: string;
        source: string;
      }[];
    };
  };
}
export default function Usage() {
  const { tr, locale, entityId, dashboard, notify } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['usage', entityId],
    queryFn: () => api<UsageData>(`/usage?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const u = q.data;
  return (
    <>
      {q.error && <ErrorBox error={q.error} />}
      <Notice>
        {tr(
          'نقيس زمن العمل المنفذ فعلًا. تكلفة الحوسبة المحلية غير مسعرة؛ وقت المراجع يدخل بإقرار المستخدم، ولا يستنتج من مدة فتح الشاشة.',
          'Executed processing time is measured. Local compute is not priced; reviewer time is self-reported, not inferred from how long a screen stays open.',
        )}
      </Notice>
      {u && (
        <>
          <div className="action-summary">
            <Panel>
              <Clock3 size={21} />
              <strong>{format(u.jobs.average_duration_ms / 1000)}</strong>
              <span>{tr('ثانية · متوسط المهمة', 'seconds · average job')}</span>
            </Panel>
            <Panel>
              <Calculator size={21} />
              <strong>{u.engine.total_calls}</strong>
              <span>{tr('عملية محرك مسجلة', 'metered engine calls')}</span>
            </Panel>
            <Panel>
              <strong>{u.jobs.failed}</strong>
              <span>{tr('مهام لم تكتمل', 'failed jobs')}</span>
            </Panel>
          </div>
          <div className="settings-layout">
            <Panel title={tr('الاستخدام الفعلي للخدمات', 'Actual service usage')}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tr('الخدمة', 'Service')}</th>
                      <th>{tr('العمليات', 'Calls')}</th>
                      <th>{tr('الزمن · ثانية', 'Duration · seconds')}</th>
                      <th>{tr('إخفاقات', 'Failures')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(u.engine.by_operation).map(([key, v]) => (
                      <tr key={key}>
                        <td>
                          {{
                            extract: tr('استخراج', 'Extraction'),
                            analyze: tr('تحليل', 'Analysis'),
                            scenario: tr('سيناريو', 'Scenario'),
                          }[key] || key}
                        </td>
                        <td>{v.calls}</td>
                        <td>{format(v.duration_ms / 1000)}</td>
                        <td>{v.failed_calls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cost-cards">
                <div>
                  <span>{tr('مزود AI خارجي', 'External AI provider')}</span>
                  <strong>
                    {format(u.costs.external_ai.amount)} {u.costs.external_ai.currency}
                  </strong>
                  <small>
                    {u.costs.external_ai.provider === 'none'
                      ? tr('غير مفعّل؛ لا طلبات مدفوعة', 'Disabled; no paid requests')
                      : u.costs.external_ai.provider}
                  </small>
                </div>
                <div>
                  <span>OCR</span>
                  <strong>
                    {format(u.costs.ocr.amount)} {u.costs.ocr.currency}
                  </strong>
                  <small>{tr('غير مفعّل', 'Not configured')}</small>
                </div>
              </div>
              <Notice>
                {tr(
                  'الزمن ليس تكلفة نقدية. لا نعلن هامش ربح المنتج قبل إدخال تكلفة البنية والدعم ومراجعة الجودة.',
                  'Duration is not a monetary cost. Product margins require infrastructure, support and quality review costs.',
                )}
              </Notice>
            </Panel>
            <Panel title={tr('تسجيل وقت مراجعة بشرية', 'Record human review time')}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  setError(null);
                  try {
                    await post('/usage/review', {
                      entity_id: entityId,
                      dataset_id: dashboard?.dataset?.id,
                      minutes: Number(f.get('minutes')),
                      hourly_rate: Number(f.get('rate')),
                      currency: dashboard?.entity.currency || 'SAR',
                    });
                    await q.refetch();
                    notify(
                      tr(
                        'حُفظ الوقت كتقدير مدخل من المستخدم',
                        'Time saved as a self-reported record',
                      ),
                    );
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="form-grid">
                  <Field label={tr('دقائق المراجعة الفعلية', 'Actual review minutes')}>
                    <input type="number" min="1" max="1440" name="minutes" required />
                  </Field>
                  <Field label={tr('تكلفة الساعة', 'Hourly cost')}>
                    <input type="number" min="0" step="0.01" name="rate" required />
                  </Field>
                </div>
                <p className="muted">
                  {tr(
                    'سيسجل اسم المستخدم ونسخة البيانات مع هذا الإقرار.',
                    'The user and dataset are recorded with this declaration.',
                  )}
                </p>
                {!!error && <ErrorBox error={error} />}
                <div className="modal-footer">
                  <Button type="submit" busy={busy} disabled={!dashboard?.dataset}>
                    <Plus size={16} />
                    {tr('تسجيل وقت المراجعة', 'Record review time')}
                  </Button>
                </div>
              </form>
            </Panel>
          </div>
          <Panel title={tr('تكلفة المراجعة المسجلة', 'Recorded review cost')}>
            {u.costs.review.records.length ? (
              <>
                <div className="cost-cards">
                  {u.costs.review.totals.map((t) => (
                    <div key={t.currency}>
                      <span>
                        {format(t.minutes)} {tr('دقيقة بإقرار المستخدم', 'self-reported minutes')}
                      </span>
                      <strong>
                        {format(t.amount)} {t.currency}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr('التاريخ', 'Date')}</th>
                        <th>{tr('دقائق', 'Minutes')}</th>
                        <th>{tr('تكلفة الساعة', 'Hourly cost')}</th>
                        <th>{tr('المبلغ', 'Amount')}</th>
                        <th>{tr('المصدر', 'Basis')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.costs.review.records.map((r) => (
                        <tr key={r.id}>
                          <td>{new Date(r.created_at).toLocaleString(locale)}</td>
                          <td>{r.minutes}</td>
                          <td>{format(r.hourly_rate)}</td>
                          <td>
                            {format(r.amount)} {r.currency}
                          </td>
                          <td>{tr('إقرار مستخدم', 'Self-reported')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Empty title={tr('لم يسجل وقت مراجعة بعد', 'No review time recorded')} />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
