import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

function startApp() {
  const { app, close } = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'basira-global-benchmark-')) });
  return { app, close };
}

function makeClient(base) {
  return {
    cookie: '',
    csrf: '',
    async req(path, method = 'GET', body) {
      const r = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.headers.get('set-cookie')) this.cookie = r.headers.get('set-cookie').split(';')[0];
      const data = await r.json();
      if (data.csrfToken) this.csrf = data.csrfToken;
      return { status: r.status, data };
    },
  };
}

async function withApp(fn) {
  const { app, close } = startApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const client = makeClient(base);
    await client.req('/auth/register', 'POST', {
      name: 'A',
      email: 'a@test.local',
      password: 'Strong-password-123',
      company: 'Tenant A',
    });
    await fn(client);
  } finally {
    server.close();
    close();
  }
}

test('GET /api/global-benchmark returns real classification + Damodaran data for a covered sector', async () => {
  await withApp(async (client) => {
    const res = await client.req('/global-benchmark?sector_code=it_services');
    assert.equal(res.status, 200);
    assert.equal(res.data.available, true);
    assert.equal(res.data.sector_code, 'it_services');
    assert.equal(res.data.classification.naics.code, '541512');
    assert.equal(res.data.classification.isic.code, '6202');
    assert.equal(res.data.classification.gics.code, '451020');
    assert.equal(res.data.global_average.damodaran_industry, 'Computer Services');
    assert.equal(res.data.global_average.n_firms, 693);
    assert.ok(Number.isFinite(res.data.global_average.metrics.gross_margin));
    assert.ok(Number.isFinite(res.data.global_average.metrics.ebit_margin));
    assert.ok(Number.isFinite(res.data.global_average.metrics.net_margin));
    assert.ok(Number.isFinite(res.data.global_average.metrics.receivables_days));
    assert.ok(Number.isFinite(res.data.global_average.metrics.roe));
    assert.ok(res.data.global_average.source_page.startsWith('https://pages.stern.nyu.edu/'));
  });
});

test('GET /api/global-benchmark covers all three sector_code values Basira actually uses', async () => {
  await withApp(async (client) => {
    for (const code of ['it_services', 'commercial_services', 'transport_logistics']) {
      const res = await client.req('/global-benchmark?sector_code=' + code);
      assert.equal(res.status, 200);
      assert.equal(res.data.available, true, `${code} should have real data, not a fabricated placeholder`);
      assert.equal(res.data.sector_code, code);
    }
  });
});

test('GET /api/global-benchmark reports honestly when a sector has no mapping, never fabricates one', async () => {
  await withApp(async (client) => {
    const res = await client.req('/global-benchmark?sector_code=other');
    assert.equal(res.status, 200);
    assert.equal(res.data.available, false);
    assert.equal(res.data.sector_code, 'other');
  });
});

test('GET /api/global-benchmark rejects an unknown sector_code rather than returning silently', async () => {
  await withApp(async (client) => {
    const res = await client.req('/global-benchmark?sector_code=not_a_real_sector');
    assert.equal(res.status, 422);
  });
});

test('GET /api/global-benchmark with no sector_code reports unavailable, not an error', async () => {
  await withApp(async (client) => {
    const res = await client.req('/global-benchmark');
    assert.equal(res.status, 200);
    assert.equal(res.data.available, false);
    assert.equal(res.data.sector_code, null);
  });
});

test('GET /api/global-benchmark requires authentication like other endpoints', async () => {
  const { app, close } = startApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const r = await fetch(base + '/global-benchmark?sector_code=it_services');
    assert.equal(r.status, 401);
  } finally {
    server.close();
    close();
  }
});
