import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { format, useApp } from '../context';
import type { Dataset, Fact } from '../types';
import { Badge, Empty, ErrorBox, Notice, Panel } from './ui';
interface Revision extends Dataset {
  reason: string;
  changed_by: string;
  changed_at: string;
  next_version: number;
}
export default function VersionHistory({ dataset }: { dataset: Dataset }) {
  const { tr, locale } = useApp();
  const [selected, setSelected] = useState(0);
  const query = useQuery({
    queryKey: ['revisions', dataset.id, dataset.version],
    queryFn: () => api<Revision[]>(`/datasets/${dataset.id}/revisions`),
  });
  const revision = query.data?.[selected];
  const changes =
    revision?.facts.flatMap((before) => {
      const after = dataset.facts.find((f) => f.id === before.id);
      if (!after) return [{ before, after: null as Fact | null }];
      return before.value !== after.value ||
        before.concept !== after.concept ||
        before.review_status !== after.review_status
        ? [{ before, after }]
        : [];
    }) || [];
  return (
    <Panel
      title={tr('سجل نسخ البيانات', 'Dataset revision history')}
      subtitle={tr(
        'مقارنة النسخة الحالية بنسخة سابقة دون الكتابة فوق الأصل.',
        'Compare the current dataset with a prior revision without overwriting originals.',
      )}
    >
      {query.error && <ErrorBox error={query.error} />}{' '}
      {!query.data?.length ? (
        <Empty
          icon={<History size={30} />}
          title={tr('هذه أول نسخة محفوظة', 'This is the first saved version')}
          description={tr(
            'تظهر هنا النسخ السابقة بعد أول تعديل أو مراجعة.',
            'Prior snapshots appear after an adjustment or review.',
          )}
        />
      ) : (
        <>
          <div className="filter-bar">
            <select
              aria-label={tr('النسخة السابقة', 'Prior revision')}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {query.data.map((r, i) => (
                <option key={`${r.version}-${i}`} value={i}>
                  v{r.version} ·{' '}
                  {new Date(r.changed_at || r.created_at || '').toLocaleString(locale)}
                </option>
              ))}
            </select>
            <span className="muted">
              v{revision?.version} → v{dataset.version}
            </span>
            <Badge>
              {changes.length} {tr('اختلافًا', 'differences')}
            </Badge>
          </div>
          <Notice>
            {revision?.reason || tr('حفظت المراجعة السابقة', 'Prior review preserved')}
          </Notice>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('البند', 'Fact')}</th>
                  <th>{tr('الفترة', 'Period')}</th>
                  <th>{tr('السابق', 'Before')}</th>
                  <th>{tr('الحالي', 'Current')}</th>
                  <th>{tr('المراجعة', 'Review')}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(({ before, after }) => (
                  <tr key={before.id}>
                    <td>
                      {tr(before.label_ar, before.label_en)}
                      {before.concept !== after?.concept && (
                        <small className="block" dir="ltr">
                          {before.concept} → {after?.concept || '—'}
                        </small>
                      )}
                    </td>
                    <td>{before.period}</td>
                    <td className="number">{format(before.value, before.unit)}</td>
                    <td className="number">{format(after?.value, after?.unit)}</td>
                    <td>
                      <Badge status={before.review_status} /> →{' '}
                      <Badge status={after?.review_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!changes.length && (
            <Empty title={tr('لا اختلاف في القيم أو الربط', 'No value or mapping differences')} />
          )}
        </>
      )}
    </Panel>
  );
}
