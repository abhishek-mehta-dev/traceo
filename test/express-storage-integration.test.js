const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const fs = require('node:fs');
const os = require('node:os');

const { createTraceoMiddleware } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { FileTraceStore, InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('HTTP request flows through Express middleware into storage as canonical events', async () => {
  const store = new InMemoryTraceStore();
  const middleware = createTraceoMiddleware({ sink: store, captureHeaders: true, captureCookies: true });

  const req = {
    method: 'GET',
    originalUrl: '/users/42?token=secret&page=1',
    url: '/users/42?token=secret&page=1',
    headers: {
      authorization: 'Bearer secret',
      'user-agent': 'traceo-test',
      'x-safe': 'visible'
    },
    query: { token: 'secret', page: '1' },
    cookies: { session: 'secret-cookie' },
    ip: '127.0.0.1',
    route: { path: '/users/:id' }
  };
  const res = new EventEmitter();
  res.statusCode = 204;
  res.getHeaders = () => ({ 'x-response': 'ok' });

  middleware(req, res, () => res.emit('finish'));
  await new Promise((resolve) => setImmediate(resolve));

  const events = await store.list();
  assert.equal(events.length, 2);
  const [started, completed] = events;
  assert.equal(started.type, 'REQUEST_STARTED');
  assert.equal(completed.type, 'REQUEST_COMPLETED');
  assert.equal(started.payload.requestId, completed.payload.requestId);
  assert.equal(started.payload.traceId, completed.payload.traceId);
  assert.equal(started.payload.request.url, '/users/42?token=[REDACTED]&page=1');
  assert.equal(started.payload.request.route, '/users/:id');
  assert.equal(started.payload.request.headers.authorization, '[REDACTED]');
  assert.equal(started.payload.request.headers['x-safe'], 'visible');
  assert.equal(started.payload.request.query.token, '[REDACTED]');
  assert.equal(started.payload.request.cookies.session, '[REDACTED]');
  assert.equal(completed.payload.response.statusCode, 204);
  assert.ok(completed.payload.response.durationMs >= 0);

  const timeline = await store.getTimeline(started.payload.requestId);
  assert.equal(timeline.length, 2);
});

test('HTTP request flows through Express middleware into JSON file storage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-express-json-'));
  const store = new FileTraceStore(path.join(dir, 'events.json'));
  const middleware = createTraceoMiddleware({ sink: store });

  const req = { method: 'GET', url: '/health', headers: {} };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.getHeaders = () => ({});

  middleware(req, res, () => res.emit('finish'));
  await new Promise((resolve) => setImmediate(resolve));

  try {
    const timeline = await store.getTimeline(req.traceoRequestId);
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].type, 'REQUEST_STARTED');
    assert.equal(timeline[1].type, 'REQUEST_COMPLETED');
  } finally {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
