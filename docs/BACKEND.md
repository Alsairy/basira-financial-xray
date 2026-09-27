# Basira backend — local pilot

Copy `server/`, `tests/backend.test.mjs` and retain the shared `shared/audiences.json` in the project root. Requires Node 24 (built-in `node:sqlite`) and `express` 4.22+. Python extraction/calculation is a separate real worker at `engine/cli.py`; use `PYTHON_BIN` to select a Python environment with the engine requirements installed.

Run `node server/index.mjs`. Defaults to `127.0.0.1:4317`. `PORT`, `HOST`, `BASIRA_DATA_DIR`, `ENGINE_PATH`, `PYTHON_BIN` configure the process. `dist/` is served by the same Express process if built before startup. Vite development should proxy `/api` to this server. `NODE_ENV=production` makes cookies Secure and disables demo unless `ENABLE_DEMO=true`; HTTPS termination is then required. The local pilot is not a complete production deployment.

SQLite persists tenants, password hashes, session hashes, revisions, entities, jobs, facts, analyses, audience-specific immutable report snapshots, actions, evidence metadata, peer snapshots, forecasts, notifications and audit events. Original files and evidence are server-owned UUID filenames under `data/documents/`. Protect and back up the entire data directory. Files are not encrypted at rest by the application. No production PostgreSQL adapter, object store, SSO/MFA, durable distributed queue, antivirus/OCR service, vendor benchmarks, email or external LLM is claimed. Interrupted local jobs are marked failed after restart. Retention settings are recorded policy; delete archives original documents, and physical deletion is not implemented.

Authentication uses scrypt with random salts; session cookies are HttpOnly, SameSite Strict, 12-hour expiry, with hashed tokens in storage. Mutations require CSRF and matching-origin validation; APIs apply tenant scope and server-side roles. IP limits are in memory for a single-process pilot. Reports escape all source text; source documents are served as attachments with nosniff. Python receives server-owned file paths through JSON stdin. No shell invocation or untrusted document execution is used. Third-party parsing is not an operating-system sandbox and remains a production hardening task.

## Additions to the HTTP contract

- `POST /api/members {name,email,password,role}`: CFO-only local member provisioning; no invitation email. Password minimum 12 characters. Roles cfo/analyst/operator/board. Email unique across server.
- `PATCH /api/datasets/:id/facts {version, updates:[{id,value?,concept?,review_status?}], reason}`: explicitly selected facts, one atomic revision. No automatic approval. Normalized numeric values are full currency units.
- `POST /api/datasets/:id/facts {version,concept,label_ar,label_en,period,value,currency,source,reason}`: manual provenance-backed fact. Source requires sheet, page or note. Existing concept+period is edited, not duplicated.
- `GET /api/actions/:id/evidence/:evidenceId/content`: authorized evidence attachment download.
- `GET /api/benchmarks?entity_id=...`: saved immutable cohort snapshots.
- `GET/POST /api/forecasts`: 13 manually supplied weekly operating assumptions, not fabricated from annual statements. POST requires entity_id,title,opening_cash,weeks[{inflows,outflows,note?}],assumptions.
- Report creation accepts `audience`, `purpose`, `detail_level` (brief/standard/detailed), `focus_questions:string[]`. Top-level metadata and `snapshot.sections:[{id,title,items}]` freeze audience content. Audience does not change authorization. Financial values remain the same; shared templates select/order actual evidence, required data, questions and actions. Sales/customer and sector details abstain when only aggregate statements exist.
- `GET /reports/:id/export?format=html` is inline and printable in a same-origin frame. JSON export is an attachment. Both require authenticated permissions and are audited.

## Integrity gates

Fact edits require a numeric revision, preserve original_value/source, store earlier revisions and invalidate dataset approval. Approval requires CFO other than the uploader and most recent editor, explicit review of every fact and no failed reconciliation check. Analysis captures dataset and settings revisions and rejects concurrent changes. Reports cannot be created from stale analyses or approved after data/policy revision changes. Approved report snapshots and audience sections remain immutable even when source facts change.

Action closure requires evidence and a CFO other than owner/submitting verifier. Benefit verification additionally excludes the action creator. Baseline and effect classification lock at approval. Current pilot verifies monetary benefit amounts only for currency-baseline actions, requires amount no greater than absolute observed change, independent reviewer, measurement period, method and confounders. Noncurrency actions can close operationally; monetary benefits need a separate linked currency-baseline action with evidence. The reviewer must validate causal attribution. Dependency group + effect type + overlapping period blocks double counting; distinct groups still require human review. Effects: cash_release, annual_profit, financing_saving, risk_exposure, implementation_cost. The app does not sum distinct effect types into an undifferentiated savings claim.

Peer intake requires provenance URL, declared rights and definitions. Sector, currency and period mismatches are excluded. A cohort below 5 is ineligible; 5–9 is descriptive only; rank appears only at 10+. Input definitions/rights are user declarations, not independently licensed or verified by the app. No network fetch is performed for URLs. Ratios requiring special comparability remain a human review responsibility.

## Tests

`node --test tests/backend.test.mjs` verifies real loopback HTTP sessions, CSRF, tenant boundaries, board authorization and optimistic policy revision. The independent QA runner exercises actual engine extraction/calculation and workflow gates. Use separate temporary test data; QA fixtures are synthetic, clearly labeled and never canonical company records.

## Operational additions

`GET /datasets/:id/revisions` returns prior snapshots, newest revision first, with facts, reason, changed_by, changed_at and next_version. It uses the same tenant and financial-role boundary as current datasets. Older revision reasons are recovered from existing edit audit events where available; unknown legacy metadata remains null.

Overdue action reminders are in-app notifications generated during dashboard/notification reads. An open action past its due date creates at most one notification per action, Asia/Riyadh calendar date and recipient. Recipients are the assigned owner and tenant CFO members. Closed and benefit-verified actions generate no new overdue notifications. No email or background scheduler is claimed.

`GET /usage?entity_id=...` reports actual persisted job timing, locally measured engine call counts/durations/status by operation, and declared review costs. Metering begins when enabled and never invents historical calls. External AI and OCR costs are zero with provider none; local compute cost is null/unmetered. `POST /usage/review {entity_id,dataset_id,minutes,hourly_rate,currency}` records the authenticated analyst/CFO's explicit self-report, calculates minutes/60 × hourly_rate rounded to two decimals, and audits it. Totals group by currency without conversion. These records do not claim automatically measured human working time.

CSV originals now accept UTF-8 text with a header and delimited data row, reject binary/control-byte and malformed quoting inputs, and pass to the real bounded Python CSV extractor. Explicit edits of formula values stamp a server-owned manual_override reason, actor and time; merely marking a formula fact reviewed does not supply an override.

Report traceability closes all metric/fact references into the frozen evidence appendix after presentation truncation. Each emitted fragment has exactly one target. Source-only findings receive links to actual supplied facts; unavailable references are stated as unavailable without creating phantom evidence. The board projection retains approved evidence values while removing raw source metadata before export.
