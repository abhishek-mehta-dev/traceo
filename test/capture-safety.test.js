const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const {
  createRequestCompletedEvent,
  createRequestStartedEvent,
  DEFAULT_MAX_BODY_BYTES,
  summarizeCapturedBody
} = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { createTraceoMiddleware } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

test('redacts api keys, custom mask keys, and URL query secrets', () => {
  const event = createRequestStartedEvent({
    method: 'POST',
    url: '/checkout?token=abc&page=2#frag',
    headers: {
      'x-api-key': 'secret-key',
      email: 'user@example.com',
      'x-safe': 'ok'
    },
    query: { token: 'abc', email: 'user@example.com', page: '2' }
  }, { additionalMaskKeys: ['email'] });

  assert.equal(event.payload.request.url, '/checkout?token=[REDACTED]&page=2#frag');
  assert.equal(event.payload.request.headers['x-api-key'], '[REDACTED]');
  assert.equal(event.payload.request.headers.email, '[REDACTED]');
  assert.equal(event.payload.request.headers['x-safe'], 'ok');
  assert.equal(event.payload.request.query.email, '[REDACTED]');
  assert.equal(event.payload.request.query.page, '2');
});

test('summarizes request and response bodies with redaction and size limits', () => {
  const started = createRequestStartedEvent({
    method: 'POST',
    url: '/users',
    body: { password: 'hunter2', name: 'ada', card: '4111-1111-1111-1111' }
  });

  assert.equal(started.payload.request.body.includes('hunter2'), false);
  assert.match(started.payload.request.body, /"password":"\[REDACTED\]"/);
  assert.match(started.payload.request.body, /"name":"ada"/);
  assert.match(started.payload.request.body, /\[REDACTED\]/);
  assert.equal(started.payload.request.bodyTruncated, undefined);

  const completed = createRequestCompletedEvent({
    traceId: 'trace-1',
    requestId: 'req-1',
    request: { method: 'POST', url: '/users' },
    response: {
      statusCode: 201,
      durationMs: 1,
      body: 'x'.repeat(DEFAULT_MAX_BODY_BYTES + 25)
    }
  }, { maxBodyBytes: 32 });

  assert.equal(completed.payload.response.body.length, 32);
  assert.equal(completed.payload.response.bodyTruncated, true);
  assert.equal(completed.payload.response.payloadSizeBytes, DEFAULT_MAX_BODY_BYTES + 25);
});

test('does not capture bodies, cookies, or headers unless enabled', async () => {
  const store = new InMemoryTraceStore();
  const middleware = createTraceoMiddleware({ sink: store });
  const req = {
    method: 'POST',
    url: '/login',
    headers: { authorization: 'Bearer secret', 'user-agent': 'traceo-test' },
    cookies: { session: 'secret-cookie' },
    body: { password: 'hunter2' }
  };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.send = (body) => body;
  res.getHeaders = () => ({ 'set-cookie': 'session=secret' });

  middleware(req, res, () => {
    res.send({ ok: true, token: 'secret-token' });
    res.emit('finish');
  });
  await new Promise((resolve) => setImmediate(resolve));

  const [started, completed] = await store.list();
  assert.equal(started.payload.request.body, undefined);
  assert.equal(started.payload.request.cookies, undefined);
  assert.equal(started.payload.request.headers, undefined);
  assert.equal(started.payload.request.userAgent, 'traceo-test');
  assert.equal(completed.payload.response.body, undefined);
  assert.equal(completed.payload.response.headers, undefined);
});

test('captures truncated redacted bodies when explicitly enabled', async () => {
  const store = new InMemoryTraceStore();
  const middleware = createTraceoMiddleware({
    sink: store,
    captureRequestBody: true,
    captureResponseBody: true,
    captureHeaders: true,
    captureCookies: true,
    maxBodyBytes: 40,
    maskKeys: ['email']
  });

  const req = {
    method: 'POST',
    url: '/signup?token=abc',
    headers: { 'x-api-key': 'secret', email: 'a@b.c' },
    query: { token: 'abc' },
    cookies: { session: 'cookie' },
    body: { password: 'hunter2', email: 'a@b.c', bio: 'x'.repeat(80) }
  };
  const res = new EventEmitter();
  res.statusCode = 201;
  res.send = (body) => body;
  res.getHeaders = () => ({ 'content-type': 'application/json' });

  middleware(req, res, () => {
    res.send({ ok: true, token: 'secret-token' });
    res.emit('finish');
  });
  await new Promise((resolve) => setImmediate(resolve));

  const [started, completed] = await store.list();
  assert.equal(started.payload.request.url, '/signup?token=[REDACTED]');
  assert.equal(started.payload.request.headers['x-api-key'], '[REDACTED]');
  assert.equal(started.payload.request.headers.email, '[REDACTED]');
  assert.equal(started.payload.request.cookies.session, '[REDACTED]');
  assert.equal(started.payload.request.bodyTruncated, true);
  assert.equal(started.payload.request.body.includes('hunter2'), false);
  assert.equal(started.payload.request.body.length, 40);
  assert.equal(completed.payload.response.body.includes('secret-token'), false);
  assert.match(completed.payload.response.body, /\[REDACTED\]/);
});

test('summarizeCapturedBody omits binary content and reports size', () => {
  const summary = summarizeCapturedBody(Buffer.from('hello-world'), { maxBodyBytes: 4 });
  assert.equal(summary.payloadSizeBytes, 11);
  assert.equal(summary.body, undefined);
  assert.equal(summary.bodyTruncated, true);
});
