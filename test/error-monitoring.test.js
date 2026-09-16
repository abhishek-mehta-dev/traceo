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

test('request summaries keep the completed HTTP status when an error event also exists', () => {
  const {
    summarizeRequests
  } = require(path.resolve(__dirname, '../packages/server/dist/create-server.js'));

  const summaries = summarizeRequests([
    {
      id: '1',
      type: 'REQUEST_COMPLETED',
      timestamp: '2026-01-01T00:00:01.000Z',
      source: 'core',
      payload: {
        requestId: 'req-422',
        request: { method: 'POST', url: '/api/auth/login' },
        response: { statusCode: 422, durationMs: 8 }
      }
    },
    {
      id: '2',
      type: 'error',
      timestamp: '2026-01-01T00:00:01.100Z',
      source: 'core',
      payload: {
        requestId: 'req-422',
        message: '"email" must be a valid email',
        statusCode: 500
      }
    }
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].statusCode, 422);
  assert.equal(summaries[0].errorCount, 1);
});
