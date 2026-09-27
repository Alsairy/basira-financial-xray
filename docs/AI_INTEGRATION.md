# Anthropic adapter: implemented, verified live, disabled by default

Status: **implemented, unit-tested against a mocked transport, and verified end-to-end against a real funded Anthropic account on 2026-09-27; still disabled unless explicitly turned on.** Following an explicit authorization to build this (the founder chose the Anthropic Claude API specifically, using their own personal `ANTHROPIC_API_KEY` — never the company Azure account, which this project must never use), the local evidence contract in `server/ai-contract.mjs` — previously validated only with synthetic fixtures and never wired into a live endpoint — is now connected to a real, bounded external transport in `server/ai-transport-anthropic.mjs`, and the `/api/assistant` route actually calls it before falling back to the pre-existing local keyword-evidence behavior.

**Live verification found and fixed three real bugs that the mocked tests alone could not catch:**
1. `renderSelection()` (pre-existing, untouched) hardcodes `mode: 'evidence'` in its return value, since it was written to describe "the answer text is deterministic," never having been exercised through an actual live model path before. The `/api/assistant` wiring now explicitly overrides this to `mode: 'llm'` when the AI path produced the selection, matching the documented `{mode:"evidence"|"llm"}` contract.
2. The hardcoded `limitations` text ("no external language model is connected") is only true for the local-evidence path; the AI-success path now returns accurate limitations text instead of a false claim.
3. **The most significant find:** `authorizedCatalog()` caps at 80 entries, and `analysis.metrics` holds every period's metrics in chronological order (up to 35 metrics × 3+ periods ≈ 105 for the Elm reference case). An unfiltered pass therefore silently dropped the *latest*, most relevant period once the cap was hit — the model was receiving 2023 data but never 2025, and correctly (if confusingly) responded "insufficient evidence" or picked a stale year, not because of any model quality issue but because the current year was never in what it saw. Fixed by filtering to the latest period before building the catalog, matching what the pre-existing local keyword fallback already does.

A fourth change, `temperature: 0`, was added after observing genuine run-to-run non-determinism in which evidence (if any) got selected for an identical question — reasonable for open-ended generation, not acceptable for a bounded classification task with one defensible answer. After all four fixes, three different real questions against the live Elm demo case behaved correctly and consistently: a margin question, a multi-metric receivables question (correctly surfacing both the receivables-days proxy and the contract-assets ratio together — real synthesis, not keyword matching), and an out-of-scope customer-churn question that safely abstained rather than inventing data.

## What is and is not sent

Activation requires all three of `BASIRA_AI_ENABLED=true`, `ANTHROPIC_API_KEY`, and an explicit `ANTHROPIC_MODEL` (no default model is hardcoded). With any of the three absent, `getAiSelection()` returns `null` immediately without ever calling `fetch` — verified by a test that injects a `fetchImpl` which throws if invoked, so this is not just documentation, it's enforced.

When enabled, one request is sent to the fixed destination `https://api.anthropic.com/v1/messages` (redirects hard-blocked via `redirect: 'error'`) containing:
- the user's bounded question (already capped at 2000 characters upstream), and
- an authorized evidence catalog projected down, per record, to exactly: `citation_id, key, label_ar, label_en, period, status, unit, explanation_key` (see `toModelCatalog()`).

**Never sent:** financial amounts, original documents, formulas, source paths/cell coordinates, tenant IDs, company name or user identity. This is not just a policy statement — the full local catalog from `authorizedCatalog()` carries `value`, `currency`, `group` and `report_id` (needed later to render the real answer), and `toModelCatalog()` strips all of it before the payload is serialized. A test (`buildAnthropicRequest never includes financial values...`) asserts the literal built request JSON contains neither the metric's actual value nor the words `currency`/`report_id`.

## How the model is constrained

The model may only respond by being forced to call one tool, `select_evidence` (`tool_choice: {type: "tool", name: "select_evidence"}`), whose `input_schema` is exactly `selectionSchema(catalog)` from the existing local contract — the same strict schema already covered by `tests/ai-contract.test.mjs`. This is stronger than the originally-reviewed OpenAI proposal's "ask nicely for structured JSON text": Anthropic's forced tool-use makes an off-schema reply a request-level impossibility rather than an output to be caught after the fact, though the server still re-validates every selected `citation_id` against the authoritative catalog via the unmodified `validateSelection()` — the model's own JSON is never trusted directly, and no model-generated prose is ever inserted into the rendered answer (`renderSelection()` builds the final text from locally stored values only, exactly as before).

Any of the following causes `getAiSelection()` to return a usage-only result (no `selected`), which the `/api/assistant` handler treats identically to "not attempted" and falls straight through, unchanged, to the pre-existing local keyword-evidence path: missing configuration, request timeout (15s), network failure, a non-2xx response, a `stop_reason` other than `tool_use`, more than one tool call or the wrong tool name, or any selected `citation_id`/`explanation_key` that fails `validateSelection` against the real catalog. The route never surfaces a provider error to the browser.

## Usage logging

Every attempt (success or failure) is audit-logged via the existing `audit()` call as `assistant.ai_attempt` with `{model, status, elapsed_ms, input_tokens, output_tokens}` only — no prompt, response, key or company content, matching the original design intent exactly. A separate `assistant.llm` audit entry records only the `report_id` and the chosen `citation_ids` when a selection is actually used in the response.

## What is still open

- The automated test suite (`tests/ai-transport-anthropic.test.mjs`) still uses an injected mock `fetchImpl` by design — it must stay offline/deterministic and must not incur real API cost on every `pnpm test` run. Live verification was done manually, separately, against the running dev server; it is not part of the repeatable test suite and does not re-run itself.
- Estimated monetary cost per call is not computed or logged yet; only token counts are captured (a real call during verification cost 3,270 input + 69 output tokens on `claude-haiku-4-5-20251001` for one question).
- `dataset.facts` (as opposed to `analysis.metrics`) is passed to the catalog builder unfiltered by period — the same 80-entry truncation risk that hit metrics could in principle affect facts on a dataset large enough to exceed the cap. Not yet hit in practice (the Elm reference case's facts stayed under the cap), but worth the same latest-period filter if a larger real dataset surfaces it.
- Grounded-answer quality has now been spot-checked on three real questions (a direct metric question, a multi-metric synthesis question, and an out-of-scope abstention case) and behaved well, but has not been evaluated against a larger labeled question set.
- `docs/IMPLEMENTATION_STATUS.md` F22/F34 have been updated to reflect this; re-read them alongside this file for the authoritative current state.

Run local tests with `node --test tests/ai-contract.test.mjs tests/ai-transport-anthropic.test.mjs`.
