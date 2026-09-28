import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

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
  const { app, close } = createApp({
    dataDir: mkdtempSync(join(tmpdir(), 'basira-demo-peer-seed-')),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await fn(makeClient(base));
  } finally {
    server.close();
    close();
  }
}

test('demo tenant auto-seeds real named peers matching its own sector_code', async () => {
  await withApp(async (client) => {
    const login = await client.req('/auth/demo', 'POST', { role: 'cfo' });
    assert.equal(login.status, 200);
    assert.equal(login.data.tenant.demo, true);

    const entities = (await client.req('/entities')).data;
    assert.equal(entities.length, 1);
    assert.equal(entities[0].sector_code, 'it_services');

    const peers = (await client.req('/peers?entity_id=' + entities[0].id)).data;
    // docs/research/peer_benchmarks_seed.json has 8 it_services peers as of this writing;
    // assert "at least one, all correctly scoped" rather than an exact count so this test
    // does not silently start failing every time the curated peer set legitimately grows.
    assert.ok(peers.length > 0, 'demo entity should have at least one seeded peer');
    for (const p of peers) {
      assert.equal(p.sector_code, 'it_services', 'seeded peer must match the demo entity sector');
      assert.equal(p.entity_id, entities[0].id);
      assert.ok(p.name, 'peer must carry a real company name');
      assert.ok(p.source_url, 'peer must carry a real source_url');
      assert.ok(p.metrics && Object.keys(p.metrics).length > 0, 'peer must carry real metrics');
    }
    // No sector other than it_services should ever appear for this demo entity.
    assert.ok(peers.every((p) => p.sector_code === 'it_services'));
  });
});

test('demo peer seeding never mixes sectors even if seed data covers several', async () => {
  await withApp(async (client) => {
    await client.req('/auth/demo', 'POST', { role: 'cfo' });
    const entities = (await client.req('/entities')).data;
    const peers = (await client.req('/peers?entity_id=' + entities[0].id)).data;
    const sectorCodes = new Set(peers.map((p) => p.sector_code));
    assert.equal(sectorCodes.size, 1, 'demo peers must all share exactly one sector_code');
  });
});

test('re-entering an existing demo session (role switch) does not duplicate seeded peers', async () => {
  await withApp(async (client) => {
    await client.req('/auth/demo', 'POST', { role: 'cfo' });
    const entities = (await client.req('/entities')).data;
    const firstCount = (await client.req('/peers?entity_id=' + entities[0].id)).data.length;

    // Switching role within the same demo tenant reuses the existing tenant (see
    // /api/auth/demo: `let tenant = req.auth?.demo ? req.auth.tenant_id : null`), so peer
    // seeding — which only runs inside the fresh-tenant branch — must not run again.
    await client.req('/auth/demo', 'POST', { role: 'analyst' });
    const secondCount = (await client.req('/peers?entity_id=' + entities[0].id)).data.length;
    assert.equal(secondCount, firstCount, 'switching demo role must not re-seed or duplicate peers');
  });
});

test('the demo peer cohort accepted by POST /api/benchmarks (peer-selection layer, not analysis)', async () => {
  await withApp(async (client) => {
    await client.req('/auth/demo', 'POST', { role: 'cfo' });
    const entities = (await client.req('/entities')).data;
    const peers = (await client.req('/peers?entity_id=' + entities[0].id)).data;
    const res = await client.req('/benchmarks', 'POST', {
      entity_id: entities[0].id,
      metric_key: 'gross_margin',
      peer_ids: peers.map((p) => p.id),
    });
    // No dataset/analysis exists in this bare test, so the peer-selection layer must pass
    // and the request must fail one step later at the analysis gate, not at peer validation
    // (a VALIDATION_ERROR here would mean the seeded peer objects are malformed).
    assert.equal(res.status, 422);
    assert.equal(res.data.error.code, 'ANALYSIS_REQUIRED');
  });
});
