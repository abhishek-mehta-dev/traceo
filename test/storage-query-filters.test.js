const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('filters events by search, method, status, date range, and limit', async () => {
  const store = new InMemoryTraceStore();
  await store.capture({ id: '1', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', source: 'express', payload: { requestId: 'req-1', method: 'GET', url: '/orders', statusCode: 200 } });
  await store.capture({ id: '2', type: 'response', timestamp: '2026-01-01T00:00:01.000Z', source: 'express', payload: { requestId: 'req-1', method: 'GET', url: '/orders', statusCode: 200 } });
  await store.capture({ id: '3', type: 'request', timestamp: '2026-01-02T00:00:00.000Z', source: 'express', payload: { requestId: 'req-2', method: 'POST', url: '/billing', statusCode: 500 } });

  const results = store.query({ search: 'orders', method: 'GET', statusCode: 200, from: '2026-01-01T00:00:00.500Z', limit: 1 });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, '2');
});
