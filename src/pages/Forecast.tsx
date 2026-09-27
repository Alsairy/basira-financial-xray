import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Save } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, post } from '../api';
import { Button, Empty, ErrorBox, Field, Notice, PageTitle, Panel } from '../components/ui';
import { format, useApp } from '../context';
interface Week {
  week: number;
  inflows: number;
  outflows: number;
  note: string;
  opening_cash?: number;
  closing_cash?: number;
}
interface ForecastModel {
  id: string;
  title: string;
  opening_cash: number;
  weeks: Week[];
  assumptions: string;
  created_at: string;
}
export default function Forecast() {
  const { tr, locale, entityId, notify } = useApp();
  const [opening, setOpening] = useState(''),
    [weeks, setWeeks] = useState<Week[]>(
      Array.from({ length: 13 }, (_, i) => ({ week: i + 1, inflows: 0, outflows: 0, note: '' })),
    ),
    [title, setTitle] = useState(''),
    [assumptions, setAssumptions] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const query = useQuery({
    queryKey: ['forecasts', entityId],
    queryFn: () => api<ForecastModel[]>(`/forecasts?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  let balance = Number(opening) || 0;
  const calculated = weeks.map((w) => {
    const open = balance;
    balance += w.inflows - w.outflows;
    return { ...w, opening_cash: open, closing_cash: balance };
  });
  const min = Math.min(...calculated.map((w) => w.closing_cash));
  const change = (i: number, key: 'inflows' | 'outflows' | 'note', value: string) =>
    setWeeks((ws) =>
      ws.map((w, j) => (j === i ? { ...w, [key]: key === 'note' ? value : Number(value) } : w)),
    );
  return (
    <>
      <PageTitle
        eyebrow={tr('رؤية للأمام، بافتراضات معلنة', 'LOOK FORWARD, WITH EXPLICIT ASSUMPTIONS')}
        title={tr('السيولة خلال 13 أسبوعًا', '13-week cash forecast')}
        description={tr(
          'خطط النقد على بيانات تشغيلية يراجعها الفريق؛ لا نستنتج التدفقات الأسبوعية من قوائم سنوية.',
          'Plan cash from reviewed operating assumptions; weekly flows cannot be inferred from annual statements.',
        )}
      />
      <Notice>
        {tr(
          'هذا نموذج افتراضات يدوي. القيم الأولية الصفرية مدخلات فارغة للتخطيط، وليست توقعًا مبنيًا على قوائم علم. املأ الأسابيع ومصادرها قبل الحفظ.',
          'This is a manual planning model. Initial zeros are planning inputs, not a forecast derived from Elm’s statements. Complete the weeks and sources before saving.',
        )}
      </Notice>
      <div className="scenario-layout">
        <Panel title={tr('المدخلات', 'Inputs')}>
          <Field label={tr('اسم الخطة', 'Plan name')}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr('خطة السيولة للربع القادم', 'Next quarter cash plan')}
            />
          </Field>
          <Field label={tr('النقد المتاح أول المدة · ريال', 'Opening available cash · SAR')}>
            <input
              type="number"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label={tr('مصادر الافتراضات وحدودها', 'Assumption sources and limits')}>
            <textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder={tr(
                'تحصيلات متوقعة، رواتب، تمويل، والتزامات…',
                'Expected collections, payroll, financing and commitments…',
              )}
            />
          </Field>
          {!!error && <ErrorBox error={error} />}
          <Button
            busy={busy}
            disabled={opening === '' || !title.trim() || !assumptions.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await post('/forecasts', {
                  entity_id: entityId,
                  title,
                  opening_cash: Number(opening),
                  weeks: weeks.map(({ inflows, outflows, note }) => ({ inflows, outflows, note })),
                  assumptions,
                });
                await query.refetch();
                notify(tr('حُفظت الخطة بافتراضاتها', 'Forecast saved with its assumptions'));
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={17} />
            {tr('حفظ نسخة الخطة', 'Save forecast version')}
          </Button>
        </Panel>
        <Panel title={tr('مسار الرصيد المتوقع', 'Projected closing cash')}>
          <div className="forecast-kpis">
            <div>
              <span>{tr('أدنى رصيد', 'Lowest balance')}</span>
              <strong className={min < 0 ? 'negative' : ''} dir="ltr">
                {format(min, 'currency', true, locale)}
              </strong>
            </div>
            <div>
              <span>{tr('نهاية الأسبوع 13', 'End of week 13')}</span>
              <strong dir="ltr">{format(balance, 'currency', true, locale)}</strong>
            </div>
          </div>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={245}>
              <AreaChart data={calculated}>
                <defs>
                  <linearGradient id="cashgradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d8079" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0d8079" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => format(v, 'currency', true, locale)}
                  width={70}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v) => format(Number(v), 'currency', false, locale)} />
                <ReferenceLine y={0} stroke="#c87452" />
                <Area
                  type="monotone"
                  dataKey="closing_cash"
                  stroke="#0d8079"
                  fill="url(#cashgradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title={tr('الأسابيع ومصادر التدفق', 'Weekly cash movements')}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr('الأسبوع', 'Week')}</th>
                <th>{tr('رصيد افتتاحي', 'Opening')}</th>
                <th>{tr('مقبوضات', 'Inflows')}</th>
                <th>{tr('مدفوعات', 'Outflows')}</th>
                <th>{tr('رصيد ختامي', 'Closing')}</th>
                <th>{tr('المصدر / ملاحظة', 'Source / note')}</th>
              </tr>
            </thead>
            <tbody>
              {calculated.map((w, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="number">{format(w.opening_cash)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={w.inflows}
                      onChange={(e) => change(i, 'inflows', e.target.value)}
                      aria-label={`${tr('مقبوضات أسبوع', 'Inflows week')} ${i + 1}`}
                      className="table-input"
                      dir="ltr"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={w.outflows}
                      onChange={(e) => change(i, 'outflows', e.target.value)}
                      aria-label={`${tr('مدفوعات أسبوع', 'Outflows week')} ${i + 1}`}
                      className="table-input"
                      dir="ltr"
                    />
                  </td>
                  <td className={`number strong ${w.closing_cash < 0 ? 'negative' : ''}`}>
                    {format(w.closing_cash)}
                  </td>
                  <td>
                    <input
                      value={w.note}
                      onChange={(e) => change(i, 'note', e.target.value)}
                      aria-label={`${tr('مصدر أسبوع', 'Source week')} ${i + 1}`}
                      className="table-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={tr('خطط محفوظة', 'Saved forecasts')}>
        {query.data?.length ? (
          <div className="saved-forecasts">
            {query.data.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setTitle(f.title);
                  setOpening(String(f.opening_cash));
                  setWeeks(f.weeks);
                  setAssumptions(f.assumptions);
                }}
              >
                <CalendarRange size={20} />
                <span>
                  <strong>{f.title}</strong>
                  <small>{new Date(f.created_at).toLocaleDateString(locale)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty title={tr('لم تُحفظ خطة بعد', 'No saved forecast yet')} />
        )}
      </Panel>
    </>
  );
}
