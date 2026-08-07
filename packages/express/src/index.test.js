const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createTraceoMiddleware } = require(path.resolve(__dirname, '../dist/index.js'));

test('express middleware captures request metadata', async () => {
  const captured = [];
  const middleware = createTraceoMiddleware({
    sink: {
      async capture(event) {
        captured.push(event);
      }
    }
  });

  let nextCalled = false;
  const req = { method: 'GET', url: '/ping' };
  const res = { statusCode: 200 };

  middleware(req, res, () => {
    nextCalled = true;
  });

  await Promise.resolve();

  assert.equal(nextCalled, true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].payload.method, 'GET');
  assert.equal(captured[0].payload.url, '/ping');
});
