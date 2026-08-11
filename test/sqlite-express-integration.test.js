const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const { createTraceoMiddleware } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('express middleware writes canonical lifecycle events into sqlite storage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-express-sqlite-'));
  const dbPath = path.join(dir, 'traceo.sqlite');
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const middleware = createTraceoMiddleware({
    sink: store,
    captureResponseBody: true
  });

  const req = { method: 'POST', url: '/users', headers: {}, originalUrl: '/users' };
  const res = new EventEmitter();
  res.statusCode = 201;
  res.send = (body) => body;
  res.getHeaders = () => ({ 'content-type': 'application/json' });

  middleware(req, res, () => {
    res.send(JSON.stringify({ ok: true }));
    res.emit('finish');
  });

  await new Promise((resolve) => setImmediate(resolve));

  const events = store.query({ requestId: req.traceoRequestId });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.type).sort(), ['REQUEST_COMPLETED', 'REQUEST_STARTED']);
  const completed = events.find((event) => event.type === 'REQUEST_COMPLETED');
  assert.ok(completed);
  assert.equal(completed.payload.response.statusCode, 201);

  await store.close();
});
