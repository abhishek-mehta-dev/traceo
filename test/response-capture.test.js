const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { TraceoCore, createResponseEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('captures response events with timing and payload metadata', async () => {
  const store = new InMemoryTraceStore();
  const core = new TraceoCore(store, { enabled: true, environment: 'test' });

  await core.capture(createResponseEvent({
    requestId: 'req-123',
    method: 'GET',
    url: '/orders',
    statusCode: 201,
    durationMs: 12.345,
    payloadSizeBytes: 27,
    timestamp: '2026-01-01T00:00:01.000Z'
  }));

  const responses = store.listByType('response');
  const timeline = store.getTimeline('req-123');

  assert.equal(responses.length, 1);
  assert.equal(responses[0].payload.statusCode, 201);
  assert.equal(responses[0].payload.durationMs, 12.345);
  assert.equal(responses[0].payload.payloadSizeBytes, 27);
  assert.equal(timeline[0].type, 'response');
});
