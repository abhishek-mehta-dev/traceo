const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { createTraceoMiddleware } = require(path.resolve(__dirname, '../dist/index.js'));

test('express middleware captures correlated request and response events', async () => {
  const captured = [];
  const middleware = createTraceoMiddleware({
    sink: { async capture(event) { captured.push(event); } },
    captureResponseBody: true
  });

  const req = { method: 'POST', url: '/users', headers: {} };
  const res = new EventEmitter();
  res.statusCode = 202;
  res.send = (body) => body;
  res.getHeaders = () => ({ 'content-type': 'application/json' });

  middleware(req, res, () => {
    res.send(JSON.stringify({ ok: true }));
    res.emit('finish');
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(captured.length, 2);
  assert.equal(captured[0].type, 'REQUEST_STARTED');
  assert.equal(captured[1].type, 'REQUEST_COMPLETED');
  assert.equal(captured[0].payload.requestId, captured[1].payload.requestId);
  assert.equal(captured[0].payload.request.method, 'POST');
  assert.equal(captured[0].payload.request.url, '/users');
  assert.equal(captured[1].payload.response.statusCode, 202);
  assert.equal(captured[1].payload.response.payloadSizeBytes, 11);
  assert.ok(captured[1].payload.response.durationMs >= 0);
});
