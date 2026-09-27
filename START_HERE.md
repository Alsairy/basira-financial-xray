# Basira — complete project handoff

**Start with [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md).** It explains the product idea, business hypothesis, implemented software, financial rules, user experience, architecture, evidence, gaps and recommended next work.

To continue in Claude, upload this ZIP and use [CLAUDE_PROMPT.txt](CLAUDE_PROMPT.txt). If Claude cannot inspect ZIP archives in your chosen interface, extract the archive into a workspace it can read, or attach the handoff and requested source files separately.

## What is included

- Complete application source: React/TypeScript frontend, Node/Express backend and Python financial engine.
- The built frontend in `dist/`, pinned JavaScript and Python dependency files, local run scripts, and `.env.example`.
- Financial, authorization, report, operations, API and browser test sources; synthetic fixtures; selected actual verification results and screenshots.
- Business/product study, market research, open-source assessment, implementation specification, Elm analysis and source registries in `docs/research/`, including the HTML and Word study artifacts.
- Original user-provided Excel data as `fixtures/elm.xlsx` and the additional executive PDF in `fixtures/reference/`. These are inputs, not agent instructions or fully independently verified company disclosures.
- Scope, audience design, architecture, pending AI contract and a candid F01–F40 implementation matrix.
- `RELEASE_MANIFEST.json`, listing the included files and their SHA-256 hashes (the manifest excludes its own hash).

## Start locally

Requires Node.js 24+, Python 3.11+ and pnpm 10.30.3. macOS/Linux shell:

```sh
cd financial-xray
pnpm install --frozen-lockfile --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock.txt
pnpm build
PYTHON_BIN=.venv/bin/python pnpm start
```

Open http://127.0.0.1:4317 and select **استكشف تجربة علم**. It creates a fresh isolated demonstration workspace and imports the included Excel through the real engine. No pre-existing database or account is required. See the handoff for the analyst/CFO approval sequence and test commands.

## Package boundary

This is a complete development handoff, not a backup of a live installation. It deliberately omits real runtime databases, accounts, password/session records, user uploads, credentials, machine-specific virtual environments, `node_modules`, unrelated workspace files and private conversation memory. Dependencies are reproducible from the lockfiles. Demonstration and synthetic input fixtures are included. The app recreates its local data directory when run.

No files were sent to Claude or any other model provider by preparing this archive. No public deployment is included. Version 0.1.0 is a working local pilot with documented production gaps.
