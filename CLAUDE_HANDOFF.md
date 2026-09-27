# Basira (بصيرة) — product and engineering handoff

**Version:** 0.1.0 local pilot. **Handoff date:** 27 September 2026. **Working name:** Basira / بصيرة, meaning insight. The name is provisional; no trademark clearance is claimed.

This document is written for a new development collaborator with no access to the previous conversation. It describes the idea, business reasoning, work delivered, technical structure, evidence and unfinished work. Read the actual code and implementation matrix before making new completion claims. This package is not a production deployment or a claim of best-in-world quality.

## 1. The idea in one paragraph

Basira turns company financial statements into an evidence-linked financial X-ray: what changed, which risks and opportunities deserve attention, what their potential financial effects might be, how the company compares with appropriate peers, and what management should investigate or do next. It then turns findings into assigned actions, deadlines and evidence-backed closure, with separately verified financial benefits. Reports adapt to their recipient—board, CEO, CFO, sales leader, analyst, sector leader or operations—while using the same underlying financial facts. The intended value is better decisions and accountable follow-through, not simply another ratio dashboard or automatically generated document.

## 2. What the founder requested

The founder originally asked, in Arabic, for deep research on similar products, useful open-source software, the role of AI, the business model, customer journey, services and functions needed for a distinctive product that can be built quickly. A CFO supplied an Elm financial workbook as an example and believes there is substantial demand. This is a market hypothesis, not validated demand evidence.

The founder then explicitly asked to develop the actual product with excellent user experience and quality. A subsequent clarification was essential: let the requester choose who will receive the report, because the board, CEO, CFO, sales manager, analyst and sector manager require different readings. Add links to deeper evidence. The founder described the Excel example as board-oriented and supplied a second PDF as a CEO-oriented example. Neither example must be copied literally.

The current request is to package everything relevant and explain it so Claude can take over. This handoff does not authorize public deployment, paid services or sending company data to an external AI provider.

## 3. Business hypothesis and research already delivered

The research covers 25 market offerings, 20 open-source components, a 35-metric library, ten starting diagnostic rules and 40 functional requirements. It includes source registries, license considerations, positioning, service packages, economics, customer journeys, architecture and a staged pilot plan. It is a broad dated market map, not a claim to have found every competitor. Vendor capabilities, pricing, licenses and terms need fresh checks before procurement.

The proposed initial segment is Saudi contract/service businesses with material working-capital, collections or contract-asset questions. That is a recommended starting hypothesis, not a user-approved exclusivity constraint. The proposed commercial path is a paid diagnostic/onboarding engagement followed by recurring monitoring, with the company/CFO as the buyer and several recipient functions as users. Pricing and unit economics in the research are illustrative assumptions; no pricing experiment or revenue validation has occurred. Billing and subscription management are not implemented.

Potential differentiation to test: Arabic/English financial reasoning with direct source evidence; financially qualified peer comparisons; report content adapted to the management decision; and a traceable path from finding to independently checked outcome. Competitors already offer reporting and action plans, so action tracking alone must not be called unique. More report recipients may improve adoption, but do not automatically prove a larger paying market.

Read:

- `docs/research/01_Product_and_Business_AR.md`
- `docs/research/02_Implementation_Spec_AR.md`
- `docs/research/03_Market_Landscape_AR.md` and its source registries
- `docs/research/04_OSS_Architecture_AR.md` and sources
- `docs/research/05_Elm_Case_Study_AR.md`
- `docs/research/Financial_Xray_Research_AR.html` and `Business_Strategy_AR.docx`

These are mostly Arabic. They describe a broader intended product; the implementation status below is authoritative for delivered functionality.

## 4. Audience-specific experience

The user chooses the report audience, purpose and depth. The seven audience definitions are versioned in `shared/audiences.json`. The same approved facts must support every version; changing the audience changes selected sections, emphasis, management questions and requests for supporting data.

| Audience | First reading | Useful detail |
|---|---|---|
| Board | Requested decisions, material risks, capital allocation and execution assurance | Approved report metrics, assumptions and supported evidence |
| CEO | Performance story, supported strengths, watchpoints and next priorities | Management questions, explanations, owners and near-term actions |
| CFO | Liquidity, reconciliation, funding and measurement | Formulas, sources, scenario assumptions and benefit verification |
| Sales | Growth quality, margin and collections context | Customer/channel/price-volume data requests where aggregate statements are insufficient |
| Analyst | Data completeness, analytical definitions and uncertainty | Cells, formulas, source versions, reconciliation and exceptions |
| Sector leader | Business-unit performance questions | Segment data, allocation methods and comparisons against the plan |
| Operations | Responsibilities, due dates, delivery evidence and follow-through | Assigned actions and independent verification requests |

Four purposes are available: periodic review, investment/financing decision, performance improvement and initiative monitoring. Three depths are available: brief, standard and detailed. Reports use readable numbers, concise opening KPIs and expandable evidence; fragment links reveal collapsed evidence. Detailed snapshots keep exact stored values. All 21 audience/depth combinations were checked for internal link integrity.

**Audience is not an authorization role.** There are four implemented account roles: CFO, analyst, operator and board. CEO/sales/sector are report perspectives, not seven separate permissions profiles. The board sees approved snapshots, and operators see assigned execution work. Selecting a board audience must never grant board privileges or raw-document access.

Aggregate financial statements do not establish individual customer, region or segment profitability. When the necessary operational data is missing, the report asks for it instead of inventing details. The PDF's additional 2026 guidance and peer claims were used as design context, not silently added as approved facts.

## 5. What has actually been implemented

| Area | Working behavior | Important boundary |
|---|---|---|
| Workspace and access | Registration/login, persistent tenants, entities, local member provisioning, four server-enforced roles, demo-only role switching | No SSO/MFA, invitation email or expiring advisor mandates |
| Import | XLSX, validated UTF-8 CSV and text PDF; bounded upload/jobs, source fingerprint, duplicate protection, originals and extraction previews | No OCR; arbitrary financial layouts are not universally supported |
| Financial facts | Original and normalized amounts, currency/scale/sign, formulas/cache state, cell/page references, review, manual mapping/override with reasons | A limited safe formula interpreter, not full Excel; PDF bounding boxes unavailable |
| Review and versions | Reconciliation, independent approval, optimistic revisions, historical snapshots/differences and invalidation after source/policy changes | Local workflow controls do not establish real organizational independence |
| Analysis | 35 metric definitions, eligibility/null states, ten diagnostic rules, linked findings and review decisions | Rules are conditional; no claim that every metric/rule applies to every business |
| Benchmarks | Historical comparison plus manually entered peers with source/rights/sector/year/currency metadata and eligibility/sample-size controls | No licensed global feed; accounting-definition comparability needs human review |
| Scenarios | Five scenario types with low/base/high cases, saved assumptions and implementation cost | Cash timing, recurring profit and financing effects are distinct; projections are not achieved savings |
| Forecast | Persisted 13-week cash plan from explicit user inputs | No fabricated weekly forecast from annual statements |
| Actions | Owner, due date, baseline, target, dependency group, workflow, evidence attachments, history, independent closure and benefit measurement | Monetary verification requires a monetary baseline; days do not become currency automatically |
| Reports | Seven audience templates, purpose/depth variations, frozen report snapshots, independent approval, HTML preview/export and JSON export | PDF is browser print, not a certified server PDF generator |
| Assistant | Local evidence retrieval with citations, role restrictions and abstention | No external LLM transport or provider call is implemented |
| Operations | In-app overdue reminders, read state, audit entries, engine/job timings and user-declared review costs | Reminders evaluated on reads; no always-running scheduler/email delivery; compute cost unmetered |
| UI | Arabic-first RTL, English UI toggle, responsive layout, accessible dialogs/focus, source inspector and drill-downs | Automated access checks do not constitute complete WCAG certification or field usability validation |

The ten main routes are `#overview`, `#data`, `#analysis`, `#benchmarks`, `#scenarios`, `#forecast`, `#actions`, `#reports`, `#assistant`, and `#settings`.

## 6. Financial invariants to preserve

1. Missing, unavailable, zero and invalid-denominator values are different states. Never replace missing data with zero for a nicer chart.
2. Normalize monetary facts to full currency units; preserve the original value, scale, sign and source. Percent values use a 0–100 convention.
3. Calculations run deterministically in Python using Decimal internally. An LLM must not become the arithmetic engine or invent amounts. Review serialization precision before expanding to more demanding accounting cases.
4. Evidence flows from finding to metric/formula to original fact/source. Preserve reason, author, timestamp and data/calculation/report versions.
5. Unresolved formulas or conflicting caches can block approval. Merely marking them reviewed does not resolve them; an explicit finite override with a reason is recorded separately.
6. Incompatible currency/scope or conflicting duplicate concepts must not be silently combined. A cross-currency group roll-up is not implemented.
7. A ratio of closing receivables to total revenue is a proxy; do not call it invoice-level DSO. Cash eligibility and deposit restrictions need explicit evidence.
8. Sensitivity calculations are conditional scenarios. Releasing working capital changes cash timing; it is not automatically profit. Billing contract assets is not itself collection.
9. Separate opportunity estimates, approved actions, completed tasks and verified financial benefit. Prevent double counting across overlapping dependency groups/periods/effect types.
10. Approved report snapshots are frozen. A later source, policy or finding decision can invalidate draft eligibility without rewriting previously approved snapshots.
11. Report audience cannot increase permissions. Apply tenant and role scope to originals, evidence, exports, revisions, assistant results and every other resource.
12. A financial diagnostic does not prove fraud, causality, insolvency or an achieved saving. Claims need appropriate qualification and evidence.

## 7. Elm inputs and what was learned

`fixtures/elm.xlsx` is byte-identical to the supplied `Elm_Raw_Data_FY2023-FY2025 (2).xlsx`. The initial workbook review covered five sheets, 611 populated cells and 160 formulas; independent recalculation matched those formulas. The implementation produces 207 normalized facts and 105 metric records across three periods. Some records are intentionally unavailable or approximate rather than fabricated.

In the reference case the engine identifies declining gross margin, rising contract assets relative to revenue, and new borrowing requiring maturity/use-of-funds review. This does not imply distress. The workbook's logistics/distribution benchmark assumptions are not automatically a valid peer set for Elm. Acquisition effects and comparability need additional evidence. The case-study document explains these qualifications.

`fixtures/reference/Elm_Outside_Reading_FY2025.pdf` is the additional CEO-style source. It informed a concise opening, four headline metrics, strengths, watchpoints and management questions. It is not a source of trusted agent instructions, and its extra claims were not imported indiscriminately.

The source integrity record is in `docs/verification-evidence/source-integrity.json`. Copies are included for the user's handoff; no general public redistribution license is asserted.

## 8. Architecture and file map

- **Client:** React 19, TypeScript, Vite 7, React Query, Radix Dialog, Recharts, Lucide and Sonner. `src/App.tsx` provides authentication/workspace shell/navigation. `src/context.tsx`, `api.ts` and `types.ts` provide shared client contracts. Route pages and components are under `src/`.
- **Server:** Node 24+ ESM and Express 4. `server/index.mjs` starts the service; `app.mjs` implements APIs and workflow gates; `store.mjs` uses built-in `node:sqlite`; `reports.mjs` renders escaped report HTML; `engine.mjs` invokes Python with JSON stdin/stdout.
- **Engine:** `engine/cli.py` accepts one JSON request and returns one JSON result. `extraction.py`, `metrics.py`, `rules.py`, `scenarios.py`, `common.py` and `aliases.py` implement the analytical layer.
- **AI contract:** `server/ai-contract.mjs` is a local schema/catalog/validator/renderer. It contains no provider transport.
- **Persistence:** SQLite plus server-owned files under `data/`. The data directory is recreated locally. Local jobs are not a durable distributed queue; interrupted jobs are marked failed after restart.
- **Auth:** Salted scrypt password hashes; hashed session tokens; HttpOnly, SameSite Strict cookies with 12-hour expiry; CSRF/origin checks; process-local rate limits. Secure cookies in production require HTTPS. This is not an independent security certification or encrypted-at-rest deployment.
- **Shared templates:** `shared/audiences.json`.
- **Tests:** Node contract/backend/report/operations tests, Python engine tests, API runner and Playwright journeys/layout checks with synthetic inputs.
- **Docs:** `CONTRACT.md` is the integration contract; `BACKEND.md` and `ENGINE.md` describe implementation details; `IMPLEMENTATION_STATUS.md` maps F01–F40; `VERIFICATION.md` and `QA_REPORT_AR.md` explain the evidence and its limits.

The current runtime is SQLite even though `pg` is present in the package manifest. An installed package is not proof of a working integration. Recharts 2 is pinned and carries a deprecation warning; dependency lifecycle/security review and a tested migration are pre-production work.

## 9. Running on a fresh machine

Use Node 24+, Python 3.11+ and pnpm 10.30.3. The JavaScript lock and Python `requirements.lock.txt` are the reproducibility references. `node_modules`, virtual environments and the previous local database are intentionally absent.

macOS/Linux, from the extracted `financial-xray` directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt
pnpm build
PYTHON_BIN=.venv/bin/python pnpm start
```

Open http://127.0.0.1:4317. `scripts/start-local.mjs` can discover a local virtual environment and check dependencies. The normal startup does not need Codex or the original developer's machine. Do not depend on any historic developer paths shown in archived research evidence.

For Windows PowerShell, use `python -m venv .venv`, `.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt`, and `$env:PYTHON_BIN = (Resolve-Path .\.venv\Scripts\python.exe).Path` before `pnpm start`. Windows execution has not been independently tested in this handoff.

`.env.example` is illustrative; the server does not automatically load `.env`. Export environment variables, use the inline POSIX assignment above, or explicitly start Node 24 with `--env-file=.env server/index.mjs` after creating a suitable local file. Never commit credentials. For an isolated local database, set `BASIRA_DATA_DIR` to a dedicated writable path.

Development UI: start the backend, then `pnpm dev` at http://127.0.0.1:5178; its `/api` proxy targets 4317. `dist/` is included for convenience, but rebuilding from source is authoritative. Do not replace build assets while running a browser verification journey; lazy-loaded chunks can become unavailable mid-session.

The optional archived research helper `docs/research/evidence/extract.py` has a historical machine-specific default. If reproducing that research, pass `fixtures/elm.xlsx` explicitly; it writes extraction artifacts beside itself. It is not needed for normal application startup.

## 10. First-use demonstration

1. Choose **استكشف تجربة علم** (Explore Elm demo). This creates an isolated demo workspace and uses the real extraction engine on the included fixture.
2. Choose a recipient perspective. This is distinct from the demo role selector.
3. Select the analyst role to inspect source facts and explicitly mark the selected reviewed items.
4. Switch to a separate demo CFO identity for dataset approval. The preparer cannot self-approve. Reanalyse when required.
5. As an analyst, create a recipient-specific report draft. As a separate CFO, approve it. As board, read the approved snapshot only.
6. Create an action with an owner, due date, baseline and target. The owner submits evidence; an independent reviewer closes/verifies. Financial benefit also needs the measurement period, method and confounding factors.

Demo-only role switching is explicitly isolated. Do not add that capability to real registered tenants. Demo data and synthetic QA benefits are not achieved business results for Elm.

## 11. Verification already recorded

These are prior execution results from 27 September 2026. Packaging this handoff does not mean the full suite was rerun again. Evidence is included under `docs/verification-evidence/`.

| Check | Recorded result |
|---|---|
| Python financial engine | 28/28 tests passed |
| Node tests | 26/26 passed; 20 concern the local AI contract |
| Actual HTTP API with real Python engine | 36/36 grouped checks passed |
| Upload/review/independent report approval/board journey | 7/7 steps passed |
| Source/scenario/action/evidence/independent closure/benefit journey | 7/7 steps passed |
| Report audience/depth anchors | 21/21 combinations without broken internal links or duplicate IDs |
| Responsive layout | Ten routes at 1440/390/720 pixels; 30 states without body overflow or recorded runtime errors |
| Automated access checks | Zero detected violations in ten opened populated route states; final benefit-dialog check also clear |
| Mobile keyboard behavior | Visible focus, menu focus containment, Escape and restoration checked |
| Clean dependency installation/build | Frozen install, TypeScript and Vite build passed in an independent directory |

Read the detailed reports for the limits: incomplete automated accessibility judgments, untested hidden states, no certified PDF pagination, no broad load/security/restore certification, and no real customer usability or accounting acceptance yet. The figures above count different kinds of checks; do not sum them into an inflated test-coverage percentage.

Re-run from an isolated local development environment:

```sh
pnpm check
pnpm test
.venv/bin/python -m unittest discover -s tests/engine -v
pnpm build
# Start the backend with the intended Python interpreter in another terminal.
pnpm test:e2e
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:layout
```

Use `BASE_URL` for the API runner and `UI_URL` for browser runners if required. Optional `QA_AXE=1` on the functional browser runner records axe checks using the pinned devDependency. Full suites create synthetic accounts, companies, reports and actions; never target a customer production environment. Rapid repeated demo role changes can correctly hit the 15-minute authentication throttle. Serialize tests on a fresh isolated service rather than disabling controls. Some tests require permission to bind loopback ports in sandboxed execution environments.

## 12. AI status and permission boundary

The implemented assistant uses local evidence retrieval. No OpenAI, Anthropic or other external model transport is installed or activated. No provider keys were searched or read, and no company data was sent to a provider during development.

An attempted optional OpenAI adapter was rejected by automatic approval review because explicit authorization for the destination and data payload was absent. Work continued safely on a reviewable local contract with 20 tests, documented in `docs/AI_INTEGRATION.md` and `docs/AI_PAYLOAD_EXAMPLE.json`.

The proposal would send the user's question plus a limited authorized catalog of opaque evidence IDs, metric keys/labels, periods, units and quality states to the fixed OpenAI Responses endpoint. It would not attach financial values, originals, formulas, source coordinates or company/user identity. The free-text question can itself contain sensitive material, so this distinction is not a promise that arbitrary user text contains no sensitive information. The model would select authorized evidence/template IDs; the server would validate those selections and render exact local values. This remains a proposal, not an enabled feature.

Changing the model provider or implementing transport requires explicit approval of the exact destination and payload. Do not infer that sharing this project with Claude approves an API data transfer, and do not treat adding an API key as sufficient when the transport itself has not been implemented.

## 13. Remaining work before commercial production

- Validate the initial customer segment, willingness to pay, recurring decision workflow and report usefulness with real CFO/CEO/board recipients. Define pilot acceptance criteria and obtain independent accounting review across varied companies.
- Improve import robustness, Arabic/multicolumn PDF extraction and OCR; evaluate confidence, exception handling and source localization on a representative corpus. Add file scanning/resource isolation before broader untrusted uploads.
- Build governed operational data imports for customer/channel/sector insight. Preserve the explicit abstention when only consolidated statements are available.
- Contract for or build appropriately licensed peer data with precise accounting definitions, cohort rules, lineage, freshness and review. Do not fake a global benchmark connection.
- Add the explicitly authorized AI transport, if approved, with bounded payloads, validated output, refusal/failure handling, monitoring and grounded-answer evaluation.
- Establish production storage/database/queue architecture, encryption, secrets management, backup/restore testing, tenant boundaries, SSO/MFA and membership lifecycle. Current SQLite/file persistence is a local implementation, not the completed production platform.
- Implement durable scheduled reminders and authorized outbound channels. Existing overdue reminders are evaluated during reads and rendered in-app.
- Complete retention/physical purge of sources and derivatives, including backup policy. Archive is not deletion.
- Add genuine ERP/bank connectors, expiring advisory mandates and portfolio/consolidation rules only with complete end-to-end coverage. Multiple entities alone do not equal consolidated accounting.
- Finish reliable production report/PDF output, audit durability, monitoring, migrations, deployment/rollback, security/load/concurrency testing and dependency maintenance.
- Build commercial onboarding, billing and subscription operations once the business model is validated.

The precise gaps and limited evidence for each original requirement are recorded in `docs/IMPLEMENTATION_STATUS.md`. All 40 requirements are tracked; that is not a claim that all 40 are fully implemented.

## 14. Recommended next approach for Claude

First reproduce the existing application and inspect its source and real UI. Establish a fresh baseline and report any environment limitations. Preserve the current architecture and working flows unless a concrete defect or production requirement justifies a change. Prioritize one coherent gap at a time, with acceptance criteria, financial/authorization invariants and browser verification. Update documentation and the implementation matrix with evidence after each meaningful change.

Do not rebuild a static dashboard, invent successful external integrations, weaken independent approvals to make a demo easier, promote research assumptions to validated financial facts, or claim production/quality certification from passing a bounded test suite. The desired ambition is high; progress must remain measurable and candid.
