# Basira deterministic financial engine

Python 3.11+; install `requirements.lock.txt` for the tested pinned versions (`requirements.txt` gives broader compatibility requirements). Run `python engine/cli.py` with one JSON request on stdin. One JSON response is written to stdout; expected validation errors exit 2, unexpected errors exit 1. Diagnostics go to stderr. No network or spreadsheet macro execution is used.

## Operations and units

- `extract`: `{ "op":"extract", "path":"/absolute/server/owned/input.xlsx", "filename":"input.xlsx", "currency":"SAR", "scale":1 }`. XLSX, UTF-8 CSV/TSV and text PDF are supported. Prefer an explicit scale. Every extracted value is provisional (`needs_review`). Source cells, original signed amounts, formulas, cache status and cached values are retained. Cash amounts normalize to full currency units; percent metrics use 0–100.
- `analyze`: `{ "op":"analyze", "facts":[...], "settings":{"days":365,"include_leases":true,"materiality_pct":1} }`. Returns 35 defined metric records per year, reconciliation checks and findings from 10 diagnostic rules plus data-quality findings. Unsupported metrics remain present with null value and an explanation; missing values never become zero. Source conflicts and incompatible currency/scope prevent calculations.
- `scenario`: `{ "op":"scenario", "facts":[...], "scenario":{"type":"collection_days","low":5,"base":10,"high":15,"implementation_cost":0} }`. Inputs must be finite JSON numbers in ascending order. `collection_days` is in days (max 365); `gross_margin` is in percentage points (0.5 means 0.5pp); `opex_reduction` and `contract_assets` are percentages (3 means 3%); scenario type `financing_rate` uses basis points (50 means 50bp). Optional property `financing_rate` on a cash scenario is an annual percent rate (5 means 5%).

Scenario results are conditional, never verified benefits. One-off cash release, recurring annual profit, conditional financing savings and implementation costs remain separate. Results with the same dependency group may overlap and must not be summed automatically. No portfolio aggregator claims de-duplication.

## Extraction and review

Use a table with `Line Item,2023,2024,2025` header and English or Arabic financial labels; canonical concept names are also accepted. CSV additionally accepts `concept,period,value`. Exact label aliases avoid speculative fuzzy mappings. Unrecognized rows are retained as `unmapped` for manual mapping. Analysis/assumption/benchmark sheets are previewed but excluded from source facts. Text PDFs require human page review; image-only PDFs require manual entry or an external OCR implementation, which is not enabled here.

Formula processing is a small, deterministic arithmetic interpreter, not Excel. It supports numeric cell references, arithmetic, SUM, ROUND, ABS, AVERAGE, MIN and MAX within bounded workbooks. Unsupported functions, external references, cycles and missing precedents produce unavailable values; saved caches remain evidence only. Supported formulas are recalculated independently and compared with caches. No `eval`, shell or arbitrary formula execution is used. Input limit is 10MB, expanded XLSX limit 150MB, 250,000 table cells and 300 PDF pages. Source preview and source-cell matrices are bounded.

Unresolved formulas and cache mismatches produce an approval-blocking failed check even when a fact is marked reviewed. To resolve one, explicitly enter a finite replacement value with a nonempty reason; the trusted server records `manual_override={reason,by,at}`, and the value must then be reviewed. Original formula, saved cache and original value remain intact. Merely marking reviewed cannot create an override. Extraction identifies its engine version and formula interpreter. PDF source references include page/text row and explicitly declare bounding boxes unavailable; blank or unreadable pages fall back to manual mapping with OCR-disabled warnings.

## Financial definitions

Average balances require the immediately previous year. DSO needs credit sales; receivables divided by total revenue is explicitly a closing-balance proxy. DPO requires trade payables and purchases, never broad other payables. A zero-inventory business can omit the inventory leg from CCC only if the other required inputs are available. ROE uses parent earnings with parent equity when present. EBITDA is labeled a proxy because the inclusion of depreciation and amortization in EBIT needs review.

Cash/net debt uses cash equivalents less explicitly restricted cash. Deposits enter eligible liquidity only with an `eligible_deposits` amount or explicit `deposits_eligible=1` fact. If all deposits are unverified, a separate `including_all_deposits_value` is available as a sensitivity; the principal result stays a proxy. This definition does not assert financial distress. Borrowing/lease components require explicit values, including zero. Financial ratios alone do not establish loss, fraud or realized savings. Reconciliation uses source precision; failed checks must be assessed before approval.

## Validation

`.venv/bin/python -m unittest discover -s tests/engine -v`

Tests cover independent numeric expectations for all 35 metrics, financial identities, activation of all 10 diagnostic rules, direct-rule currency/scope abstention, cache match/mismatch, reviewed-formula blocking and documented overrides, blank/text PDF handling, malicious/unsupported Excel content, missing/zero/negative/nonfinite input, currency and unit mismatches, source conflicts, scenario units/bounds and overlapping effect groups. The engine was also exercised on the supplied Elm FY2023–2025 workbook. Uploaded reports are not independently authenticated against public filings by this software. This is not exhaustive coverage of every financial definition, PDF layout or rule boundary.
