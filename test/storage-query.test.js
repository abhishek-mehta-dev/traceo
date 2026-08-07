const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('returns correlated events for a request id', async () => {
  const store = new InMemoryTraceStore();

  await store.capture({
    id: '1',
    type: 'request',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'express',
    payload: { requestId: 'req-123', method: 'GET', url: '/orders' }
  });

  await store.capture({
    id: '2',
    type: 'error',
    timestamp: '2026-01-01T00:00:01.000Z',
    source: 'core',
    payload: { requestId: 'req-123', message: 'boom' }
  });

  const timeline = store.getTimeline('req-123');

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].type, 'request');
  assert.equal(timeline[1].type, 'error');
});
