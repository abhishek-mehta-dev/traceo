const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createRequestStartedEvent,
  createRequestCompletedEvent,
  TRACE_HTTP_EVENT_TYPES
} = require(path.resolve(__dirname, '../packages/core/dist/index.js'));

test('creates canonical request started events with identifiers and sanitized metadata', () => {
  const event = createRequestStartedEvent({
    method: 'get',
    url: '/orders?token=abc',
    route: '/orders',
    headers: {
      authorization: 'Bearer secret',
      'user-agent': 'node-test',
      'x-request-id': 'abc'
    },
    query: { token: 'abc', page: '1' },
    cookies: { session: 'secret-cookie' },
    ip: '127.0.0.1',
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  assert.match(event.id, /^evt-/);
  assert.match(event.payload.traceId, /^trace-/);
  assert.equal(event.type, TRACE_HTTP_EVENT_TYPES.requestStarted);
  assert.equal(event.timestamp, '2026-01-01T00:00:00.000Z');
  assert.equal(event.payload.request.method, 'GET');
  assert.equal(event.payload.request.route, '/orders');
  assert.equal(event.payload.request.headers.authorization, '[REDACTED]');
  assert.equal(event.payload.request.query.token, '[REDACTED]');
  assert.equal(event.payload.request.cookies.session, '[REDACTED]');
});

test('creates canonical request completed events with status and duration', () => {
  const event = createRequestCompletedEvent({
    traceId: 'trace-123',
    requestId: 'req-123',
    request: { method: 'POST', url: '/users' },
    response: {
      statusCode: 201,
      durationMs: 12.5,
      completedAt: '2026-01-01T00:00:01.000Z'
    }
  });

  assert.equal(event.type, TRACE_HTTP_EVENT_TYPES.requestCompleted);
  assert.equal(event.payload.traceId, 'trace-123');
  assert.equal(event.payload.requestId, 'req-123');
  assert.equal(event.payload.response.statusCode, 201);
  assert.equal(event.payload.response.durationMs, 12.5);
  assert.equal(event.payload.response.completedAt, '2026-01-01T00:00:01.000Z');
});

test('validates required canonical request fields', () => {
  assert.throws(() => createRequestStartedEvent({ method: '', url: '/missing-method' }), /method is required/);
  assert.throws(() => createRequestStartedEvent({ method: 'GET', url: '' }), /url is required/);
  assert.throws(() => createRequestCompletedEvent({
    traceId: 'trace-1',
    requestId: 'req-1',
    request: { method: 'GET', url: '/bad-duration' },
    response: { statusCode: 200, durationMs: -1 }
  }), /durationMs/);
});
