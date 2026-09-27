/** Local-only contract. No transport, environment/key access, files or network. */
const roles = new Set(['cfo', 'analyst', 'board']);
const statuses = new Set([
  'ok',
  'proxy',
  'not_applicable',
  'insufficient_data',
  'invalid_denominator',
]);
const units = new Set(['currency', 'percent', 'days', 'multiple', 'number']);
const text = (v, n = 180) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : '';
const isFiniteAmount = (v) =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e24);

export function authorizedCatalog({
  allowedMetrics = [],
  allowedFacts = [],
  userRole,
  approvedReport = false,
  reportId = null,
}) {
  if (!roles.has(userRole) || (userRole === 'board' && approvedReport !== true)) return [];
  if (!Array.isArray(allowedMetrics) || !Array.isArray(allowedFacts)) return [];
  const source = [
    ...allowedMetrics.map((r) => ({ r, kind: 'metric' })),
    ...(userRole === 'board' ? [] : allowedFacts.map((r) => ({ r, kind: 'fact' }))),
  ];
  const accepted = [],
    groups = new Map();
  for (const { r, kind } of source) {
    if (
      !r ||
      typeof r.id !== 'string' ||
      r.id.length > 180 ||
      !units.has(r.unit) ||
      !isFiniteAmount(r.value)
    )
      continue;
    if (
      (kind === 'metric' && !statuses.has(r.status)) ||
      (kind === 'fact' && (r.review_status !== 'reviewed' || r.concept === 'unmapped'))
    )
      continue;
    const key = kind === 'metric' ? r.key : r.concept,
      period = String(r.period ?? '');
    if (
      typeof key !== 'string' ||
      !/^[a-z][a-z0-9_]{0,79}$/.test(key) ||
      !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(period)
    )
      continue;
    const status = kind === 'metric' ? r.status : r.value === null ? 'insufficient_data' : 'ok';
    const group = `${kind}:${key}:${period}`,
      signature = JSON.stringify([r.value, r.currency, r.unit, r.scope, status]);
    if (groups.has(group)) {
      if (groups.get(group) !== signature)
        for (const item of accepted) if (item.group === group) item.conflict = true;
      continue;
    }
    groups.set(group, signature);
    accepted.push({
      group,
      id: r.id,
      kind,
      key,
      period,
      status,
      unit: r.unit,
      value: r.value,
      currency: /^[A-Z]{3}$/.test(r.currency || '') ? r.currency : null,
      label_ar: text(r.label_ar || key),
      label_en: text(r.label_en || key),
      report_id: reportId,
      explanation_key:
        r.value === null || !['ok', 'proxy'].includes(status)
          ? 'unavailable'
          : status === 'proxy'
            ? 'proxy'
            : 'source_value',
    });
  }
  return accepted
    .filter((r) => !r.conflict)
    .slice(0, 80)
    .map((r, i) => ({ ...r, citation_id: `E${String(i).padStart(3, '0')}` }));
}

export function selectionSchema(catalog) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      answer_kind: { type: 'string', enum: ['evidence', 'insufficient'] },
      selections: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            citation_id: { type: 'string', enum: catalog.map((r) => r.citation_id) },
            explanation_key: { type: 'string', enum: ['source_value', 'proxy', 'unavailable'] },
          },
          required: ['citation_id', 'explanation_key'],
        },
      },
    },
    required: ['answer_kind', 'selections'],
  };
}

export function validateSelection(response, catalog) {
  const fail = () => {
    throw new Error('Invalid evidence selection');
  };
  if (
    !response ||
    response.status !== 'completed' ||
    response.error ||
    !Array.isArray(response.output)
  )
    fail();
  const parts = [];
  for (const item of response.output) {
    if (item.type === 'reasoning') continue;
    if (
      item.type !== 'message' ||
      item.role !== 'assistant' ||
      item.status !== 'completed' ||
      !Array.isArray(item.content)
    )
      fail();
    for (const part of item.content) {
      if (part.type !== 'output_text' || typeof part.text !== 'string') fail();
      parts.push(part.text);
    }
  }
  if (parts.length !== 1 || parts[0].length > 8000) fail();
  let result;
  try {
    result = JSON.parse(parts[0]);
  } catch {
    fail();
  }
  if (
    !result ||
    Object.keys(result).sort().join(',') !== 'answer_kind,selections' ||
    !['evidence', 'insufficient'].includes(result.answer_kind) ||
    !Array.isArray(result.selections) ||
    result.selections.length > 5
  )
    fail();
  if (result.answer_kind === 'insufficient') {
    if (result.selections.length) fail();
    return [];
  }
  if (!result.selections.length) fail();
  const byId = new Map(catalog.map((r) => [r.citation_id, r])),
    seen = new Set();
  return result.selections.map((item) => {
    if (
      !item ||
      Object.keys(item).sort().join(',') !== 'citation_id,explanation_key' ||
      typeof item.citation_id !== 'string' ||
      seen.has(item.citation_id)
    )
      fail();
    const record = byId.get(item.citation_id);
    if (!record || record.explanation_key !== item.explanation_key) fail();
    seen.add(item.citation_id);
    return record;
  });
}

/** Returned text is deterministic. This function does not claim an LLM was used. */
export function renderSelection(selected, language = 'ar') {
  const ar = language !== 'en',
    word = (a, e) => (ar ? a : e);
  return {
    answer: selected
      .map((r) => {
        const label = ar ? r.label_ar : r.label_en;
        const unit = {
          currency: r.currency || word('وحدة العملة الأصلية', 'source currency units'),
          percent: '%',
          days: word('يوم', 'days'),
          multiple: '×',
          number: '',
        }[r.unit];
        const value = r.value === null ? word('غير متاح', 'unavailable') : String(r.value);
        const explanation =
          r.explanation_key === 'proxy'
            ? word(
                'مؤشر تقريبي؛ راجع تعريف مدخلاته.',
                'Proxy measure; review its input definitions.',
              )
            : r.explanation_key === 'unavailable'
              ? word(
                  'لا تتوفر مدخلات أو تعريف صالح للحساب.',
                  'Inputs or a valid calculation definition are unavailable.',
                )
              : word(
                  'قيمة موثقة لا تثبت السبب أو تحقق منفعة بمفردها.',
                  'An evidence value alone does not establish a cause or realized benefit.',
                );
        return `${label} (${r.period}): ${value}${r.value === null ? '' : ` ${unit}`}. ${explanation}`;
      })
      .join('\n'),
    mode: 'evidence',
    citations: selected.map((r) => ({
      label: ar ? r.label_ar : r.label_en,
      [r.kind === 'metric' ? 'metric_id' : 'fact_id']: r.id,
      ...(r.report_id ? { report_id: r.report_id } : {}),
    })),
  };
}
