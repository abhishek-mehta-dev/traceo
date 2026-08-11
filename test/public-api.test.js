const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { TraceoCore, createRequestEvent, createErrorEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('exposes a public timeline query through the core package', async () => {
  const store = new InMemoryTraceStore();
  const core = new TraceoCore(store, { enabled: true, environment: 'test' });

  const requestEvent = createRequestEvent({
    method: 'GET',
    url: '/orders',
    statusCode: 200,
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  const errorEvent = createErrorEvent({
    message: 'boom',
    requestId: requestEvent.payload.requestId,
    timestamp: '2026-01-01T00:00:01.000Z'
  });

  await core.capture(requestEvent);
  await core.capture(errorEvent);

  const timeline = store.getTimeline(requestEvent.payload.requestId);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].type, 'REQUEST_STARTED');
  assert.equal(timeline[1].type, 'error');
});
