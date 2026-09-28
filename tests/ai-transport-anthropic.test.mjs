import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTHROPIC_ENDPOINT,
  buildAnthropicRequest,
  adaptAnthropicResponse,
  getAiSelection,
} from '../server/ai-transport-anthropic.mjs';

const catalog = () => [
  {
    citation_id: 'E000',
    kind: 'metric',
    key: 'gross_margin',
    period: '2025',
    status: 'ok',
    unit: 'percent',
    value: 30,
    currency: null,
    label_ar: 'الهامش الإجمالي',
    label_en: 'Gross margin',
    explanation_key: 'source_value',
  },
];

const toolUseResponse = (input, extra = {}) => ({
  type: 'message',
  role: 'assistant',
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'toolu_1', name: 'select_evidence', input }],
  usage: { input_tokens: 120, output_tokens: 18 },
  ...extra,
});

function withEnv(vars, fn) {
  const prior = {};
  for (const k of Object.keys(vars)) prior[k] = process.env[k];
  Object.assign(process.env, vars);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const k of Object.keys(vars)) {
        if (prior[k] === undefined) delete process.env[k];
        else process.env[k] = prior[k];
      }
    });
}

test('buildAnthropicRequest never includes financial values, only opaque catalog entries', () => {
  const req = buildAnthropicRequest({
    catalog: catalog(),
    question: 'What does gross margin show?',
    language: 'en',
    model: 'claude-haiku-4-5-20251001',
  });
  assert.equal(req.model, 'claude-haiku-4-5-20251001');
  assert.equal(req.temperature, 0, 'bounded classification task should be deterministic');
  assert.equal(req.tool_choice.type, 'tool');
  assert.equal(req.tool_choice.name, 'select_evidence');
  assert.equal(req.tools.length, 1);
  assert.equal(req.tools[0].input_schema.additionalProperties, false);
  const sent = JSON.parse(req.messages[0].content);
  assert.equal(sent.question, 'What does gross margin show?');
  assert.deepEqual(Object.keys(sent.authorized_evidence_catalog[0]).sort(), [
    'citation_id',
    'explanation_key',
    'key',
    'label_ar',
    'label_en',
    'period',
    'status',
    'unit',
  ]);
  // The full local catalog carries the actual stored value/currency/kind/report_id so the
  // server can render exact amounts after the model only picks citation IDs — none of that
  // may reach the model itself.
  assert.doesNotMatch(JSON.stringify(req), /"value":30/);
  assert.doesNotMatch(JSON.stringify(req), /currency/);
  assert.doesNotMatch(JSON.stringify(req), /report_id/);
});

test('adaptAnthropicResponse accepts a clean forced tool call', () => {
  const adapted = adaptAnthropicResponse(
    toolUseResponse({
      answer_kind: 'evidence',
      selections: [{ citation_id: 'E000', explanation_key: 'source_value' }],
    }),
  );
  assert.equal(adapted.status, 'completed');
  const parsed = JSON.parse(adapted.output[0].content[0].text);
  assert.equal(parsed.answer_kind, 'evidence');
});

test('adaptAnthropicResponse rejects non-tool_use stop reasons (refusal, max_tokens, etc.)', () => {
  for (const stop_reason of ['end_turn', 'max_tokens', 'refusal', 'pause_turn']) {
    assert.throws(() => adaptAnthropicResponse(toolUseResponse({}, { stop_reason })));
  }
});

test('adaptAnthropicResponse rejects a response with extra or wrong-named tool calls', () => {
  assert.throws(() =>
    adaptAnthropicResponse(
      toolUseResponse({}, { content: [{ type: 'tool_use', name: 'other_tool', input: {} }] }),
    ),
  );
  assert.throws(() =>
    adaptAnthropicResponse(
      toolUseResponse(
        {},
        {
          content: [
            { type: 'tool_use', name: 'select_evidence', input: {} },
            { type: 'tool_use', name: 'select_evidence', input: {} },
          ],
        },
      ),
    ),
  );
});

test('getAiSelection returns null when the feature is not fully configured', async () => {
  await withEnv(
    { BASIRA_AI_ENABLED: undefined, ANTHROPIC_API_KEY: undefined, ANTHROPIC_MODEL: undefined },
    async () => {
      const called = { count: 0 };
      const result = await getAiSelection({
        catalog: catalog(),
        question: 'x',
        language: 'en',
        fetchImpl: async () => {
          called.count += 1;
          throw new Error('must not be called');
        },
      });
      assert.equal(result, null);
      assert.equal(called.count, 0, 'must never call the network when not fully configured');
    },
  );
});

test('getAiSelection succeeds end to end with a mocked fetch, never a real network call', async () => {
  await withEnv(
    {
      BASIRA_AI_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
    },
    async () => {
      let requestSeen;
      const result = await getAiSelection({
        catalog: catalog(),
        question: 'What does gross margin show?',
        language: 'en',
        fetchImpl: async (url, init) => {
          requestSeen = { url, init };
          return {
            ok: true,
            json: async () =>
              toolUseResponse({
                answer_kind: 'evidence',
                selections: [{ citation_id: 'E000', explanation_key: 'source_value' }],
              }),
          };
        },
      });
      assert.equal(requestSeen.url, ANTHROPIC_ENDPOINT);
      assert.equal(requestSeen.init.headers['x-api-key'], 'test-key');
      assert.equal(requestSeen.init.redirect, 'error');
      assert.equal(result.selected.length, 1);
      assert.equal(result.selected[0].citation_id, 'E000');
      assert.equal(result.usage.status, 'ok');
      assert.equal(result.usage.model, 'claude-haiku-4-5-20251001');
      assert.equal(result.usage.input_tokens, 120);
    },
  );
});

test('getAiSelection sends anthropic-workspace-id only when ANTHROPIC_WORKSPACE_ID is set', async () => {
  await withEnv(
    {
      BASIRA_AI_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
      ANTHROPIC_WORKSPACE_ID: 'wrkspc-abc123',
    },
    async () => {
      let requestSeen;
      await getAiSelection({
        catalog: catalog(),
        question: 'What does gross margin show?',
        language: 'en',
        fetchImpl: async (url, init) => {
          requestSeen = init;
          return {
            ok: true,
            json: async () =>
              toolUseResponse({
                answer_kind: 'evidence',
                selections: [{ citation_id: 'E000', explanation_key: 'source_value' }],
              }),
          };
        },
      });
      assert.equal(requestSeen.headers['anthropic-workspace-id'], 'wrkspc-abc123');
    },
  );
  await withEnv(
    {
      BASIRA_AI_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
    },
    async () => {
      // withEnv stores process.env values as strings and can't represent "unset" via
      // `undefined` (Node coerces it to the string "undefined", which is truthy) — deleting
      // outright is the only way to assert the true no-workspace-id default here.
      delete process.env.ANTHROPIC_WORKSPACE_ID;
      let requestSeen;
      await getAiSelection({
        catalog: catalog(),
        question: 'What does gross margin show?',
        language: 'en',
        fetchImpl: async (url, init) => {
          requestSeen = init;
          return {
            ok: true,
            json: async () =>
              toolUseResponse({
                answer_kind: 'evidence',
                selections: [{ citation_id: 'E000', explanation_key: 'source_value' }],
              }),
          };
        },
      });
      assert.equal('anthropic-workspace-id' in requestSeen.headers, false);
    },
  );
});

test('getAiSelection reports an "insufficient" model answer as no selection, not an error', async () => {
  await withEnv(
    { BASIRA_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001' },
    async () => {
      const result = await getAiSelection({
        catalog: catalog(),
        question: 'unrelated question',
        language: 'en',
        fetchImpl: async () => ({
          ok: true,
          json: async () => toolUseResponse({ answer_kind: 'insufficient', selections: [] }),
        }),
      });
      assert.deepEqual(result.selected, []);
      assert.equal(result.usage.status, 'ok');
    },
  );
});

test('getAiSelection falls back to null on http error, network throw, and malformed output', async () => {
  await withEnv(
    { BASIRA_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001' },
    async () => {
      const httpError = await getAiSelection({
        catalog: catalog(),
        question: 'q',
        language: 'en',
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          json: async () => ({}),
          text: async () => '{"type":"error","error":{"type":"rate_limit_error"}}',
        }),
      });
      assert.equal(httpError.usage.status, 'http_error');
      assert.equal(httpError.selected, undefined);

      const thrown = await getAiSelection({
        catalog: catalog(),
        question: 'q',
        language: 'en',
        fetchImpl: async () => {
          throw new Error('network down');
        },
      });
      assert.equal(thrown.usage.status, 'error');

      const malformed = await getAiSelection({
        catalog: catalog(),
        question: 'q',
        language: 'en',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [] }),
        }),
      });
      assert.equal(malformed.usage.status, 'error');

      const invalidCitation = await getAiSelection({
        catalog: catalog(),
        question: 'q',
        language: 'en',
        fetchImpl: async () => ({
          ok: true,
          json: async () =>
            toolUseResponse({
              answer_kind: 'evidence',
              selections: [{ citation_id: 'E999', explanation_key: 'source_value' }],
            }),
        }),
      });
      assert.equal(invalidCitation.usage.status, 'error');
    },
  );
});

test('getAiSelection returns null for an empty or missing catalog without calling fetch', async () => {
  await withEnv(
    { BASIRA_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001' },
    async () => {
      let called = false;
      const result = await getAiSelection({
        catalog: [],
        question: 'q',
        language: 'en',
        fetchImpl: async () => {
          called = true;
          return { ok: true, json: async () => ({}) };
        },
      });
      assert.equal(result, null);
      assert.equal(called, false);
    },
  );
});
