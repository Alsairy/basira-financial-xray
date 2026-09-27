/**
 * Optional, disabled-by-default Anthropic transport for the local evidence contract in
 * `ai-contract.mjs`. This module never invents financial values: it sends the model only
 * an opaque, pre-authorized evidence catalog (citation IDs, canonical metric/fact keys,
 * labels, periods, units and quality statuses) and a bounded question; the model may only
 * respond by calling the `select_evidence` tool with citation IDs drawn from that catalog.
 * The server then re-validates every selection against the same catalog (`validateSelection`)
 * and renders the answer from locally stored values (`renderSelection`) — the model's own
 * text is never inserted into the answer.
 *
 * Excluded from every request: financial amounts, original documents, formulas, source
 * paths/cell coordinates, tenant IDs, company name and user identity.
 *
 * Activation requires all three of BASIRA_AI_ENABLED=true, ANTHROPIC_API_KEY and an explicit
 * ANTHROPIC_MODEL. Any missing variable, network failure, non-2xx response, timeout, refusal,
 * or output that fails validation causes this module to return null so the caller falls back
 * to the existing local `mode: "evidence"` behavior — it never throws out to the request
 * handler and never surfaces provider errors to the browser.
 */
import { selectionSchema, validateSelection } from './ai-contract.mjs';

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TIMEOUT_MS = 15000;
const MAX_TOKENS = 1024;
const TOOL_NAME = 'select_evidence';

const SYSTEM_PROMPT_AR = [
  'أنت مساعد أدلة مقيّد صارم. تتلقى سؤالًا وقائمة أدلة مالية معتمدة مسبقًا (معرفات مبهمة فقط، لا قيم).',
  'ردك الوحيد المسموح هو استدعاء أداة select_evidence باختيار حتى خمس معرفات (citation_id) من القائمة المعطاة فقط، مع explanation_key المطابق تمامًا لما ورد في تلك القائمة لكل معرف.',
  'إن لم يحدد السؤال فترة معينة، فضّل أحدث فترة (period) متاحة في الفهرس لكل مفهوم، لا فترة عشوائية أو قديمة.',
  'إن لم تكن الأدلة المتاحة كافية للإجابة بدقة عن السؤال، أرسل answer_kind بقيمة insufficient دون أي اختيارات.',
  'لا تخترع أرقامًا أو أسماء شركات أو تفسيرات نصية جديدة. لا تخرج عن استدعاء الأداة بأي شكل.',
].join(' ');
const SYSTEM_PROMPT_EN = [
  'You are a strictly bounded evidence assistant. You receive a question and a pre-authorized catalog of financial evidence (opaque IDs only, no values).',
  'Your only permitted response is to call the select_evidence tool, choosing up to five citation_id values from the given catalog, each with the explanation_key exactly as listed for that id.',
  "If the question does not name a specific period, prefer the most recent period available in the catalog for each concept, not an arbitrary or older one.",
  'If the available evidence cannot answer the question precisely, send answer_kind "insufficient" with no selections.',
  'Never invent numbers, company names or new narrative explanations. Never respond other than by calling the tool.',
].join(' ');

function envConfig() {
  const enabled = process.env.BASIRA_AI_ENABLED === 'true';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!enabled || !apiKey || !model) return null;
  return { apiKey, model };
}

/**
 * Pure: the full local catalog (from `authorizedCatalog`) carries the actual stored `value`,
 * `currency`, `group` and `report_id` so the server can render exact amounts after the model
 * has only chosen citation IDs — but none of that may ever leave the process. This strips
 * every entry down to exactly the fields the model is allowed to see: opaque id, canonical
 * key, labels, period, quality status, unit and the explanation template code. No amount,
 * currency, original text, source or company/tenant identity is included.
 */
export function toModelCatalog(catalog) {
  return catalog.map(({ citation_id, key, label_ar, label_en, period, status, unit, explanation_key }) => ({
    citation_id,
    key,
    label_ar,
    label_en,
    period,
    status,
    unit,
    explanation_key,
  }));
}

/** Pure: builds the exact request body sent to Anthropic. No network, no env access. */
export function buildAnthropicRequest({ catalog, question, language, model }) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    // This is a bounded classification task (pick from an authorized list) with exactly
    // one defensible answer per question, not open-ended generation — temperature 0
    // minimizes run-to-run variance in whether/what evidence gets selected.
    temperature: 0,
    system: language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_AR,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          question,
          authorized_evidence_catalog: toModelCatalog(catalog),
        }),
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description:
          'Select authorized evidence to answer the question, or report insufficient evidence.',
        input_schema: selectionSchema(catalog),
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
  };
}

/**
 * Pure: adapts an Anthropic Messages response into the OpenAI-Responses-shaped object
 * `validateSelection` already validates and parses, so the one strict validator in
 * `ai-contract.mjs` stays the single source of truth for output safety. Throws on any
 * shape that is not a clean, forced tool call — callers must catch and fall back.
 */
export function adaptAnthropicResponse(body) {
  if (!body || body.type !== 'message' || body.role !== 'assistant') throw new Error('shape');
  if (body.stop_reason !== 'tool_use') throw new Error(`stop_reason:${body.stop_reason}`);
  if (!Array.isArray(body.content)) throw new Error('content');
  const calls = body.content.filter((c) => c && c.type === 'tool_use');
  if (calls.length !== 1 || calls[0].name !== TOOL_NAME) throw new Error('tool_use');
  return {
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(calls[0].input) }],
      },
    ],
  };
}

/**
 * Orchestrates one bounded call. Returns `{ selected, usage }` on success (selected is the
 * validated evidence array from `validateSelection`, ready for `renderSelection`), or `null`
 * on anything that should fall back to local evidence mode. `fetchImpl` is injectable for
 * tests; production callers should omit it and use the global `fetch`.
 */
export async function getAiSelection({ catalog, question, language, fetchImpl = fetch }) {
  const config = envConfig();
  if (!config || !Array.isArray(catalog) || !catalog.length) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetchImpl(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(
        buildAnthropicRequest({ catalog, question, language, model: config.model }),
      ),
    });
    const elapsed_ms = Date.now() - started;
    if (!res.ok) return { usage: { model: config.model, status: 'http_error', elapsed_ms } };
    const body = await res.json();
    const usage = {
      model: config.model,
      status: 'ok',
      elapsed_ms,
      input_tokens: Number.isFinite(body?.usage?.input_tokens) ? body.usage.input_tokens : null,
      output_tokens: Number.isFinite(body?.usage?.output_tokens)
        ? body.usage.output_tokens
        : null,
    };
    const adapted = adaptAnthropicResponse(body);
    const selected = validateSelection(adapted, catalog);
    return { selected, usage };
  } catch {
    return { usage: { model: config.model, status: 'error', elapsed_ms: Date.now() - started } };
  } finally {
    clearTimeout(timer);
  }
}
