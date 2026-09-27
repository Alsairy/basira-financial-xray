import { useQuery } from '@tanstack/react-query';
import { Calculator, Save, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { api, post } from '../api';
import { Badge, Button, Empty, ErrorBox, Field, Notice, PageTitle, Panel } from '../components/ui';
import { format, useApp } from '../context';
import type { Scenario } from '../types';
const models = [
  {
    id: 'collection_days',
    ar: 'تسريع التحصيل',
    en: 'Faster collection',
    unit_ar: 'أيام أقل',
    unit_en: 'days reduced',
    values: [5, 10, 15],
    effect: 'cash_release',
    description_ar: 'نقد يتحرر بتقليل مدة الذمم. يمثل توقيتًا للنقد وليس ربحًا إضافيًا.',
    description_en: 'Cash released by reducing receivable days. This changes timing, not profit.',
  },
  {
    id: 'gross_margin',
    ar: 'تحسين الهامش الإجمالي',
    en: 'Gross margin improvement',
    unit_ar: 'نقطة مئوية',
    unit_en: 'percentage points',
    values: [0.25, 0.5, 1],
    effect: 'annual_profit',
    description_ar: 'أثر سنوي على الربح الإجمالي عند ثبات حجم النشاط.',
    description_en: 'Annual gross profit effect at a constant revenue base.',
  },
  {
    id: 'contract_assets',
    ar: 'تحويل أصول العقود',
    en: 'Contract asset conversion',
    unit_ar: '% من الرصيد',
    unit_en: '% of balance',
    values: [5, 10, 15],
    effect: 'cash_release',
    description_ar: 'الفوترة وحدها ليست تحصيلًا. الأثر النقدي مشروط بالتحصيل اللاحق.',
    description_en: 'Billing is not collection. Cash effect requires subsequent collection.',
  },
  {
    id: 'opex_reduction',
    ar: 'ترشيد المصروفات',
    en: 'Operating expense efficiency',
    unit_ar: '% انخفاض',
    unit_en: '% reduction',
    values: [2, 5, 8],
    effect: 'annual_profit',
    description_ar: 'خفض مصروفات مؤهلة دون افتراض تأثر الإيراد أو جودة الخدمة.',
    description_en:
      'Reduction in eligible expenses; revenue and service effects require separate review.',
  },
  {
    id: 'financing_rate',
    ar: 'خفض تكلفة التمويل',
    en: 'Financing cost reduction',
    unit_ar: 'نقطة أساس',
    unit_en: 'basis points',
    values: [25, 50, 75],
    effect: 'financing_saving',
    description_ar: 'وفر تمويل تقديري على قاعدة الدين، قبل تكلفة إعادة التمويل.',
    description_en: 'Indicative financing savings on debt, before refinancing costs.',
  },
];
export default function Scenarios() {
  const { tr, locale, dashboard, entityId, notify } = useApp();
  const [type, setType] = useState('collection_days'),
    [values, setValues] = useState([5, 10, 15]),
    [result, setResult] = useState<Scenario | null>(null),
    [title, setTitle] = useState(''),
    [cost, setCost] = useState('0'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState<unknown>(null);
  const model = models.find((m) => m.id === type)!;
  const saved = useQuery({
    queryKey: ['scenarios', entityId],
    queryFn: () => api<Scenario[]>(`/scenarios?entity_id=${entityId}`),
    enabled: !!entityId,
  });
  const body = {
    dataset_id: dashboard?.dataset?.id,
    type,
    low: values[0],
    base: values[1],
    high: values[2],
    implementation_cost: Number(cost),
  };
  async function evaluate(save = false) {
    setBusy(save ? 'save' : 'evaluate');
    setError(null);
    try {
      const r = await post<Scenario>(save ? '/scenarios/save' : '/scenarios/evaluate', {
        ...body,
        title: title || tr(model.ar, model.en),
      });
      setResult(r);
      if (save) {
        await saved.refetch();
        notify(tr('حُفظ السيناريو مع افتراضاته', 'Scenario saved with its assumptions'));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={tr('قبل القرار، اختبر الفرضية', 'TEST THE ASSUMPTION BEFORE THE DECISION')}
        title={tr('مختبر الأثر', 'Impact lab')}
        description={tr(
          'غيّر فرضية واحدة، وافهم المبلغ ونوع الأثر وشروط تحقيقه.',
          'Change an assumption and understand the value, effect type, and conditions.',
        )}
      />
      <div className="scenario-layout">
        <Panel className="scenario-input" title={tr('صمّم السيناريو', 'Design your scenario')}>
          <Field label={tr('مسار التحسين', 'Improvement lever')}>
            <select
              value={type}
              onChange={(e) => {
                const m = models.find((m) => m.id === e.target.value)!;
                setType(m.id);
                setValues(m.values);
                setResult(null);
                setError(null);
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {tr(m.ar, m.en)}
                </option>
              ))}
            </select>
          </Field>
          <p className="muted">{tr(model.description_ar, model.description_en)}</p>
          <Badge status={model.effect} />
          <div className="form-grid three">
            {values.map((v, i) => (
              <Field
                key={`${type}-${i}`}
                label={`${[tr('متحفظ', 'Low'), tr('أساسي', 'Base'), tr('متفائل', 'High')][i]}`}
                hint={tr(model.unit_ar, model.unit_en)}
              >
                <input
                  type="number"
                  min="0"
                  step={type === 'gross_margin' ? '0.1' : '1'}
                  value={v}
                  onChange={(e) => {
                    setValues((prev) => prev.map((x, j) => (j === i ? Number(e.target.value) : x)));
                    setResult(null);
                  }}
                  dir="ltr"
                />
              </Field>
            ))}
          </div>
          <Field label={tr('تكلفة التنفيذ · ريال', 'Implementation cost · SAR')}>
            <input
              type="number"
              min="0"
              value={cost}
              onChange={(e) => {
                setCost(e.target.value);
                setResult(null);
              }}
              dir="ltr"
            />
          </Field>
          <Field label={tr('اسم السيناريو', 'Scenario name')}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr(model.ar, model.en)}
            />
          </Field>
          {!!error && <ErrorBox error={error} />}
          <Button
            busy={busy === 'evaluate'}
            disabled={!dashboard?.dataset || values[0] > values[1] || values[1] > values[2]}
            onClick={() => evaluate()}
          >
            <Calculator size={17} />
            {tr('حساب الأثر', 'Calculate impact')}
          </Button>
        </Panel>
        <Panel
          className="scenario-result"
          title={tr('الأثر المحتمل', 'Potential impact')}
          subtitle={tr(
            'تقدير مشروط بالافتراضات. لا يعد أثرًا محققًا.',
            'Conditional estimate, not a realized benefit.',
          )}
        >
          {result ? (
            <>
              <div className="impact-main">
                <span>{tr('الحالة الأساسية', 'BASE CASE')}</span>
                <strong dir="ltr">{format(result.base, 'currency', true, locale)}</strong>
                <small>{tr('ريال سعودي', 'Saudi riyal')}</small>
                <Badge status={result.effect_type} />
              </div>
              <div className="impact-range">
                {[result.low, result.base, result.high].map((v, i) => (
                  <div key={i} className={i === 1 ? 'active' : ''}>
                    <span>
                      {[tr('متحفظ', 'Low'), tr('أساسي', 'Base'), tr('متفائل', 'High')][i]}
                    </span>
                    <strong dir="ltr">{format(v, 'currency', true, locale)}</strong>
                  </div>
                ))}
              </div>
              <div className="formula">
                <Calculator size={17} />
                <code dir="ltr">{result.formula}</code>
              </div>
              <ul className="assumptions">
                {(locale === 'ar' ? result.assumptions_ar : result.assumptions_en)?.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              {Number(cost) > 0 && (
                <Notice>
                  {tr('تكلفة التنفيذ تعرض منفصلة', 'Implementation cost shown separately')}:{' '}
                  {format(Number(cost), 'currency', true, locale)} {tr('ريال', 'SAR')}
                </Notice>
              )}
              <Button variant="secondary" busy={busy === 'save'} onClick={() => evaluate(true)}>
                <Save size={17} />
                {tr('حفظ السيناريو والافتراضات', 'Save scenario & assumptions')}
              </Button>
            </>
          ) : (
            <Empty
              icon={<SlidersHorizontal size={34} />}
              title={tr(
                'القرار يبدأ بفرضية واضحة',
                'Every decision starts with a clear assumption',
              )}
              description={tr(
                'اختر مسار التحسين ثم احسب أثره على بيانات الشركة الحالية.',
                'Choose an improvement lever, then calculate its impact on the current dataset.',
              )}
            />
          )}
        </Panel>
      </div>
      <Notice>
        {tr(
          'لا تجمع تحرير النقد مع الربح السنوي كوفر واحد. السيناريوهات المتداخلة تشترك في مجموعة اعتماد وتحتاج إزالة التداخل قبل اعتماد أثرها.',
          'Do not combine cash release and annual profit into one savings total. Overlapping scenarios require deduplication before benefit approval.',
        )}
      </Notice>
      <Panel title={tr('سيناريوهات محفوظة', 'Saved scenarios')}>
        {saved.data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr('السيناريو', 'Scenario')}</th>
                  <th>{tr('نوع الأثر', 'Effect type')}</th>
                  <th>{tr('أساسي', 'Base')}</th>
                  <th>{tr('متحفظ — متفائل', 'Low — high')}</th>
                </tr>
              </thead>
              <tbody>
                {saved.data.map((s, i) => (
                  <tr key={s.id || i}>
                    <td>{s.title || s.type}</td>
                    <td>
                      <Badge status={s.effect_type} />
                    </td>
                    <td className="number">{format(s.base, 'currency', true, locale)}</td>
                    <td className="number">
                      {format(s.low, 'currency', true, locale)} –{' '}
                      {format(s.high, 'currency', true, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={tr('لم يُحفظ سيناريو بعد', 'No saved scenarios yet')}
            description={tr(
              'احفظ الافتراضات التي تريد مناقشتها مع الإدارة.',
              'Save the assumptions you want to discuss with management.',
            )}
          />
        )}
      </Panel>
    </>
  );
}
