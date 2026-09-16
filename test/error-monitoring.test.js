const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { createTraceoErrorHandler, createTraceoMiddleware } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('Express error handler captures correlated error events', async () => {
  const store = new InMemoryTraceStore();
  const middleware = createTraceoMiddleware({ sink: store });
  const errorHandler = createTraceoErrorHandler({ sink: store });

  const req = { method: 'GET', url: '/fail', headers: {} };
  const res = new EventEmitter();
  res.statusCode = 500;
  res.getHeaders = () => ({});

  middleware(req, res, () => {});
  errorHandler(new Error('payment provider unavailable'), req, res, () => {});
  res.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));

  const timeline = await store.getTimeline(req.traceoRequestId);
  assert.equal(timeline.some((event) => event.type === 'REQUEST_STARTED'), true);
  assert.equal(timeline.some((event) => event.type === 'error'), true);
  const error = timeline.find((event) => event.type === 'error');
  assert.equal(error.payload.message, 'payment provider unavailable');
  assert.equal(error.payload.requestId, req.traceoRequestId);
  assert.equal(error.payload.method, 'GET');
});
