const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { TraceoCore, createRequestEvent, createErrorEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('captures error events and correlates them by request id', async () => {
  const store = new InMemoryTraceStore();
  const core = new TraceoCore(store, { enabled: true, environment: 'test' });

  await core.capture(createRequestEvent({
    method: 'GET',
    url: '/orders',
    statusCode: 500,
    timestamp: '2026-01-01T00:00:00.000Z'
  }));

  await core.captureError({
    message: 'database unavailable',
    stack: 'Error: database unavailable',
    requestId: 'req-123',
    timestamp: '2026-01-01T00:00:01.000Z'
  });

  const errors = store.listByType('error');
  const correlated = store.listByRequestId('req-123');

  assert.equal(errors.length, 1);
  assert.equal(errors[0].payload.message, 'database unavailable');
  assert.equal(correlated.length, 1);
  assert.equal(correlated[0].type, 'error');
  assert.equal(correlated[0].payload.requestId, 'req-123');
});
