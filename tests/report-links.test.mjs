import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  audienceConfig,
  buildSections,
  renderReport,
  completeEvidenceReferences,
} from '../server/reports.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = audienceConfig(root);
const facts = Array.from({ length: 14 }, (_, i) => ({
  id: `fact${i}`,
  concept: `fact_${i}`,
  label_en: `Financial source ${i}`,
  period: '2025',
  value: 100 + i,
  currency: 'SAR',
  source: { sheet: 'Private statement', cell: `B${i + 1}` },
  review_status: 'reviewed',
}));
const metrics = Array.from({ length: 10 }, (_, i) => ({
  id: `metric${i}:2025`,
  key: `metric${i}`,
  period: '2025',
  label_en: `Financial metric ${i}`,
  value: i + 1,
  unit: 'multiple',
  status: 'ok',
  group: ['profitability', 'cash', 'growth', 'funding', 'returns'][i % 5],
  inputs: [facts[i + 4].id],
  formula: 'verified source',
}));
const analysis = {
  engine_version: 'test',
  periods: ['2025'],
  metrics,
  findings: [
    {
      id: 'R1',
      title_en: 'Referenced metric outside selected view',
      summary_en: 'Trace the supplied metric.',
      severity: 'high',
      metric_ids: ['metric9:2025'],
      source_refs: [],
    },
    {
      id: 'R10',
      title_en: 'Source-only measured effect',
      summary_en: 'Trace source without inventing a calculated metric.',
      severity: 'medium',
      metric_ids: [],
      source_refs: ['Private statement!B14'],
    },
  ],
  checks: [],
};
const snapshot = (audience) => ({
  audience,
  purpose: 'performance_improvement',
  dataset: { id: 'd', version: 1, status: 'approved', facts },
  analysis,
  actions: [],
  scenarios: [],
  benchmarks: [],
  settings: { days: 365, include_leases: true, materiality_pct: 1 },
});
function assertLinks(html) {
  const ids = [...html.matchAll(/\bid="([^"]*)"/g)].map((m) => m[1]),
    links = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
  assert.equal(new Set(ids).size, ids.length, 'duplicate HTML IDs');
  for (const link of links)
    assert.equal(ids.filter((id) => id === link).length, 1, `missing or ambiguous ${link}`);
}
test('all seven audiences and three depths retain exactly one destination per evidence link', () => {
  for (const audience of config.audiences)
    for (const detail of ['brief', 'standard', 'detailed']) {
      const s = snapshot(audience.id);
      s.sections = buildSections(s, config, 'en', detail);
      const html = renderReport({
        id: 'r',
        title: 'Traceability test',
        language: 'en',
        snapshot: s,
      });
      assertLinks(html);
      for (const finding of s.sections
        .flatMap((s) => s.items)
        .filter((i) => i.finding_id === 'R10')) {
        assert.ok(finding.evidence_refs.some((r) => r.fact_id === 'fact13'));
        assert.equal(finding.missing_references.length, 0);
      }
    }
});
test('board rendering retains authorized frozen evidence without restoring removed raw sources', () => {
  const s = snapshot('board');
  s.sections = buildSections(s, config, 'en', 'brief');
  s.sections = completeEvidenceReferences(s, s.sections, 'en');
  delete s.dataset.facts;
  // Mirror the server board projection: references remain, raw source metadata does not.
  for (const section of s.sections)
    for (const item of section.items) {
      delete item.source;
      delete item.source_refs;
      delete item.missing_references;
    }
  s.analysis = structuredClone(s.analysis);
  for (const item of [...s.analysis.metrics, ...s.analysis.findings]) delete item.source_refs;
  const html = renderReport({
    id: 'board',
    title: 'Approved board report',
    language: 'en',
    snapshot: s,
  });
  assertLinks(html);
  assert.ok(!html.includes('Private statement'));
  assert.ok(html.includes('fact:fact13'));
});
test('unknown source references are declared unavailable and never emitted as broken links', () => {
  const s = snapshot('ceo');
  s.analysis = {
    ...analysis,
    findings: [
      {
        id: 'unknown',
        title_en: 'Unresolved source',
        severity: 'high',
        metric_ids: [],
        source_refs: ['missing-document!Z99'],
      },
    ],
  };
  s.sections = buildSections(s, config, 'en', 'standard');
  const html = renderReport({ id: 'r', title: 'Missing proof', language: 'en', snapshot: s });
  assertLinks(html);
  assert.ok(html.includes('Reference unavailable'));
  assert.ok(!html.includes('href="#missing-document'));
});
