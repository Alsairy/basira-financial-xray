import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

test('overdue dedupe, source revisions, measured usage, declared review costs and approval race', async () => {
  let blockNext = false,
    release,
    enteredResolve;
  const entered = new Promise((r) => {
    enteredResolve = r;
  });
  const engine = async (request) => {
    await new Promise((r) => setTimeout(r, 5));
    if (request.op === 'extract')
      return {
        facts: [
          {
            id: 'revenue-2025',
            concept: 'revenue',
            label_en: 'Revenue',
            label_ar: 'Revenue',
            period: '2025',
            value: 1000,
            currency: 'SAR',
            unit: 'currency',
            source: { sheet: 'CSV', cell: 'B2' },
            original_value: 1000,
          },
        ],
        periods: ['2025'],
        warnings: [],
        source_preview: [],
      };
    if (blockNext && request.op === 'analyze') {
      blockNext = false;
      enteredResolve();
      await new Promise((r) => {
        release = r;
      });
    }
    return {
      engine_version: 'explicit-test-fixture',
      periods: ['2025'],
      metrics: [],
      findings: [],
      checks: [{ id: 'balanced-test', status: 'pass' }],
    };
  };
  const { app, close } = createApp({
    dataDir: mkdtempSync(join(tmpdir(), 'basira-operations-')),
    engine,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = () => ({
    cookie: '',
    csrf: '',
    async req(path, method = 'GET', body) {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.headers.get('set-cookie'))
        this.cookie = response.headers.get('set-cookie').split(';')[0];
      const data = await response.json();
      if (data.csrfToken) this.csrf = data.csrfToken;
      return { status: response.status, data };
    },
  });
  const cfo = client(),
    analyst = client(),
    board = client(),
    outsider = client(),
    password = 'Test-only-password-2026';
  const ok = (r) => {
    assert.ok([200, 201, 202].includes(r.status), JSON.stringify(r));
    return r.data;
  };
  try {
    const own = ok(
      await cfo.req('/auth/register', 'POST', {
        name: 'CFO',
        email: 'cfo@operations.test',
        password,
        company: 'Operations test',
      }),
    );
    const analystUser = ok(
      await cfo.req('/members', 'POST', {
        name: 'Analyst',
        email: 'analyst@operations.test',
        password,
        role: 'analyst',
      }),
    );
    await cfo.req('/members', 'POST', {
      name: 'Board',
      email: 'board@operations.test',
      password,
      role: 'board',
    });
    ok(await analyst.req('/auth/login', 'POST', { email: 'analyst@operations.test', password }));
    ok(await board.req('/auth/login', 'POST', { email: 'board@operations.test', password }));
    ok(
      await outsider.req('/auth/register', 'POST', {
        name: 'Outside',
        email: 'outside@operations.test',
        password,
        company: 'Other tenant',
      }),
    );
    const entity = ok(await cfo.req('/entities'))[0];
    const upload = ok(
      await analyst.req('/documents', 'POST', {
        entity_id: entity.id,
        filename: 'test.csv',
        rights_confirmed: true,
        content_base64: Buffer.from('Concept,2025\nRevenue,1000\n').toString('base64'),
      }),
    );
    let job;
    for (let i = 0; i < 100; i++) {
      job = ok(await analyst.req('/jobs/' + upload.job_id));
      if (job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(job.status, 'completed');
    assert.ok(job.duration_ms >= 5);
    let dataset = ok(await analyst.req('/datasets/' + job.dataset_id));
    dataset = ok(
      await analyst.req(`/datasets/${dataset.id}/facts`, 'PATCH', {
        version: dataset.version,
        reason: 'Source corrected after independent reconciliation',
        updates: [{ id: 'revenue-2025', value: 1200, review_status: 'reviewed' }],
      }),
    );
    const history = ok(await analyst.req(`/datasets/${dataset.id}/revisions`));
    assert.equal(history.length, 1);
    assert.equal(history[0].version, 1);
    assert.equal(history[0].facts[0].value, 1000);
    assert.equal(history[0].reason, 'Source corrected after independent reconciliation');
    assert.equal(history[0].changed_by, analystUser.id);
    assert.equal((await outsider.req(`/datasets/${dataset.id}/revisions`)).status, 404);
    assert.equal((await board.req(`/datasets/${dataset.id}/revisions`)).status, 403);
    blockNext = true;
    const pendingAnalysis = analyst.req(`/datasets/${dataset.id}/analyze`, 'POST', {});
    await entered;
    dataset = ok(
      await cfo.req(`/datasets/${dataset.id}/approve`, 'POST', { version: dataset.version }),
    );
    assert.equal(dataset.status, 'approved');
    release();
    ok(await pendingAnalysis);
    dataset = ok(await analyst.req(`/datasets/${dataset.id}`));
    assert.equal(dataset.status, 'approved', 'parallel analysis must preserve fresh approval');
    assert.equal(dataset.approved_by, own.user.id);
    const action = ok(
      await cfo.req('/actions', 'POST', {
        entity_id: entity.id,
        title: 'Overdue test',
        description: 'In-app only',
        owner_id: analystUser.id,
        due_date: '2000-01-01',
        baseline: 1000,
        target: 900,
        unit: 'SAR',
        effect_type: 'cash_release',
      }),
    );
    const first = ok(await cfo.req('/notifications')).filter(
      (n) => n.kind === 'action_overdue' && n.action_id === action.id,
    );
    assert.equal(first.length, 1);
    assert.equal(first[0].user_id, own.user.id);
    ok(await cfo.req('/dashboard?entity_id=' + entity.id));
    const second = ok(await cfo.req('/notifications')).filter(
      (n) => n.kind === 'action_overdue' && n.action_id === action.id,
    );
    assert.equal(second.length, 1);
    assert.equal(second[0].id, first[0].id);
    const owners = ok(await analyst.req('/notifications')).filter(
      (n) => n.kind === 'action_overdue' && n.action_id === action.id,
    );
    assert.equal(owners.length, 1);
    assert.equal(owners[0].user_id, analystUser.id);
    assert.equal(ok(await outsider.req('/notifications')).length, 0);
    const usage = ok(await cfo.req('/usage?entity_id=' + entity.id));
    assert.equal(usage.jobs.completed, 1);
    assert.ok(usage.jobs.total_duration_ms >= 5);
    assert.equal(usage.engine.total_calls, 4);
    assert.equal(usage.engine.by_operation.extract.calls, 1);
    assert.equal(usage.engine.by_operation.analyze.calls, 3);
    assert.ok(usage.engine.total_duration_ms > 0);
    assert.equal(usage.costs.external_ai.amount, 0);
    assert.equal(usage.costs.ocr.provider, 'none');
    assert.equal(usage.costs.local_compute.amount, null);
    const review = ok(
      await analyst.req('/usage/review', 'POST', {
        entity_id: entity.id,
        dataset_id: dataset.id,
        minutes: 90,
        hourly_rate: 200,
        currency: 'SAR',
      }),
    );
    assert.equal(review.amount, 300);
    assert.equal(review.source, 'self_reported');
    assert.equal(review.created_by, analystUser.id);
    const cost = ok(await cfo.req('/usage?entity_id=' + entity.id)).costs.review;
    assert.deepEqual(cost.totals, [{ currency: 'SAR', minutes: 90, amount: 300 }]);
    assert.equal(cost.records.length, 1);
    assert.equal((await outsider.req('/usage?entity_id=' + entity.id)).status, 404);
    assert.equal((await board.req('/usage?entity_id=' + entity.id)).status, 403);
    assert.equal(
      (
        await analyst.req('/usage/review', 'POST', {
          entity_id: entity.id,
          dataset_id: dataset.id,
          minutes: -1,
          hourly_rate: 200,
          currency: 'SAR',
        })
      ).status,
      422,
    );
    assert.ok(ok(await cfo.req('/audit')).some((e) => e.action === 'usage.review_cost'));
  } finally {
    release?.();
    await new Promise((r) => server.close(r));
    close();
  }
});
