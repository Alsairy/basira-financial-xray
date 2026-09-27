import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

test('sessions, CSRF, tenant isolation, role checks and optimistic revisions', async () => {
  const { app, close } = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'basira-security-')) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => ({
    cookie: '',
    csrf: '',
    async req(path, method = 'GET', body, csrf = true) {
      const r = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(csrf && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get('set-cookie')) this.cookie = r.headers.get('set-cookie').split(';')[0];
      const data = await r.json();
      if (data.csrfToken) this.csrf = data.csrfToken;
      return { status: r.status, data };
    },
  });
  try {
    const a = client(),
      b = client();
    assert.equal((await a.req('/session')).status, 401);
    assert.equal(
      (
        await a.req('/auth/register', 'POST', {
          name: 'A',
          email: 'a@test.local',
          password: 'Strong-password-123',
          company: 'Tenant A',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await b.req('/auth/register', 'POST', {
          name: 'B',
          email: 'b@test.local',
          password: 'Strong-password-123',
          company: 'Tenant B',
        })
      ).status,
      201,
    );
    const entity = (await a.req('/entities')).data[0];
    assert.equal((await b.req('/dashboard?entity_id=' + entity.id)).status, 404);
    assert.equal(
      (
        await a.req(
          '/entities',
          'POST',
          { name: 'X', sector: 'technology', currency: 'SAR' },
          false,
        )
      ).status,
      403,
    );
    const settings = (await a.req('/settings')).data;
    assert.equal(
      (await a.req('/settings', 'PATCH', { version: settings.version, days: 360 })).status,
      200,
    );
    assert.equal(
      (await a.req('/settings', 'PATCH', { version: settings.version, days: 365 })).status,
      409,
    );
    assert.equal((await b.req('/settings')).data.days, 365);
    assert.equal(
      (
        await a.req('/members', 'POST', {
          name: 'Board',
          email: 'board@test.local',
          password: 'Strong-password-123',
          role: 'board',
        })
      ).status,
      201,
    );
    const board = client();
    assert.equal(
      (
        await board.req('/auth/login', 'POST', {
          email: 'board@test.local',
          password: 'Strong-password-123',
        })
      ).status,
      200,
    );
    assert.equal((await board.req('/documents')).status, 403);
    assert.equal(
      (
        await board.req('/members', 'POST', {
          name: 'No',
          email: 'no@test.local',
          password: 'Strong-password-123',
          role: 'cfo',
        })
      ).status,
      403,
    );
    assert.equal((await a.req('/auth/logout', 'POST', {})).status, 200);
    assert.equal((await a.req('/session')).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    close();
  }
});

import { audienceConfig, buildSections, renderReport } from '../server/reports.mjs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

test('audience, purpose and depth change presentation without recalculating facts', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..'),
    config = audienceConfig(root);
  const metrics = [
    {
      id: 'gross_margin:2025',
      key: 'gross_margin',
      period: '2025',
      label_en: 'Gross margin',
      label_ar: 'Gross margin',
      value: 30,
      unit: 'percent',
      status: 'ok',
      group: 'profitability',
      formula: 'gross profit / revenue * 100',
      inputs: ['fact1'],
    },
    {
      id: 'net_debt:2025',
      key: 'net_debt',
      period: '2025',
      label_en: 'Net debt',
      value: 200000,
      unit: 'currency',
      status: 'ok',
      group: 'funding',
      formula: 'debt - cash',
      inputs: ['fact1'],
    },
  ];
  const snapshot = {
    audience: 'sales',
    purpose: 'periodic_review',
    analysis: {
      metrics,
      periods: ['2025'],
      findings: [
        {
          id: 'reject',
          title_en: 'Rejected finding',
          summary_en: 'Rejected conclusion',
          severity: 'high',
        },
      ],
      finding_reviews: { reject: { status: 'rejected' } },
      checks: [],
      engine_version: 'test',
    },
    dataset: {
      id: 'd1',
      version: 1,
      status: 'approved',
      facts: [
        {
          id: 'fact1',
          label_en: 'Revenue <script>alert(1)</script>',
          period: '2025',
          value: 1000000,
          currency: 'SAR',
          source: { sheet: 'Financials', cell: 'B2' },
          review_status: 'reviewed',
        },
      ],
    },
    actions: [],
    scenarios: [],
    benchmarks: [],
    settings: { days: 365, include_leases: true, materiality_pct: 1 },
  };
  const before = structuredClone(snapshot.analysis.metrics),
    sales = buildSections(snapshot, config, 'en');
  assert.ok(
    sales
      .find((s) => s.id === 'customer_economics')
      .items.some((i) => i.text?.includes('Unavailable')),
  );
  assert.ok(sales.find((s) => s.id === 'missing_data').items.length);
  const cfo = buildSections({ ...snapshot, audience: 'cfo' }, config, 'en', 'detailed');
  assert.ok(cfo.find((s) => s.id === 'reconciliation'));
  assert.ok(cfo.find((s) => s.id === 'methodology'));
  const capital = buildSections({ ...snapshot, purpose: 'capital_decision' }, config, 'en');
  assert.notDeepEqual(capital[0], sales[0]);
  assert.deepEqual(snapshot.analysis.metrics, before);
  assert.equal(JSON.stringify(sales).includes('Rejected conclusion'), false);
  const html = renderReport({
    id: 'r',
    title: '<img src=x onerror=alert(1)>',
    language: 'en',
    audience: 'sales',
    template_version: '1',
    status: 'draft',
    purpose: 'periodic_review',
    created_at: '2026-09-27',
    snapshot: { ...snapshot, sections: sales },
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});
