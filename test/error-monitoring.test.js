const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createErrorEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { createTraceoErrorHandler } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { TraceoExceptionFilter } = require(path.resolve(__dirname, '../packages/nestjs/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-error-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('error-monitoring: core createErrorEvent creates canonical event with sanitized metadata', () => {
  const event = createErrorEvent({
    name: 'TypeError',
    message: 'Cannot read property of undefined',
    stack: 'Error: Cannot read property...\n  at Object.<anonymous>',
    requestId: 'req-123',
    traceId: 'trace-456',
    route: '/api/users',
    method: 'POST',
    statusCode: 500,
    metadata: {
      password: 'secret-password-123',
      component: 'user-agent-string'
    }
  });

  assert.equal(event.type, 'ERROR');
  assert.equal(event.payload.name, 'TypeError');
  assert.equal(event.payload.message, 'Cannot read property of undefined');
  assert.equal(event.payload.requestId, 'req-123');
  assert.equal(event.payload.traceId, 'trace-456');
  assert.equal(event.payload.statusCode, 500);
  assert.equal(event.payload.metadata.password, '[REDACTED]');
  assert.equal(event.payload.metadata.component, 'user-agent-string');
});

test('error-monitoring: Express error handler captures ERROR event into storage', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const errorHandler = createTraceoErrorHandler({ sink: store });

  const mockErr = new Error('Database connection failed');
  mockErr.name = 'DatabaseError';

  const mockReq = {
    method: 'GET',
    url: '/db-check',
    traceoRequestId: 'req-db-1',
    traceoTraceId: 'trace-db-1'
  };

  const mockRes = { statusCode: 500 };

  let nextCalled = false;
  errorHandler(mockErr, mockReq, mockRes, (err) => {
    nextCalled = true;
    assert.equal(err, mockErr);
  });

  assert.equal(nextCalled, true);
  await new Promise((resolve) => setImmediate(resolve));

  const events = store.query({ requestId: 'req-db-1' });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'ERROR');
  assert.equal(events[0].payload.name, 'DatabaseError');
  assert.equal(events[0].payload.message, 'Database connection failed');

  await store.close();
});

test('error-monitoring: NestJS exception filter captures ERROR event', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const filter = new TraceoExceptionFilter({ sink: store });
  const mockException = new Error('Uncaught NestJS Exception');

  const mockHost = {
    getClass: () => ({ name: 'PaymentController' }),
    getHandler: () => ({ name: 'processPayment' }),
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        url: '/payment',
        traceoRequestId: 'nest-req-1',
        traceoTraceId: 'nest-trace-1'
      }),
      getResponse: () => ({ statusCode: 402 })
    })
  };

  filter.catch(mockException, mockHost);
  await new Promise((resolve) => setImmediate(resolve));

  const events = store.query({ requestId: 'nest-req-1' });
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.route, 'PaymentController.processPayment');
  assert.equal(events[0].payload.statusCode, 402);

  await store.close();
});

test('error-monitoring: Server API and Dashboard SDK list and retrieve error details', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const errEvent = createErrorEvent({
    name: 'ValidationError',
    message: 'Invalid payload field',
    stack: 'ValidationError: Invalid payload field\n  at validate (app.js:10)',
    requestId: 'req-val-1',
    traceId: 'trace-val-1',
    route: '/api/submit',
    method: 'POST',
    statusCode: 400
  });

  await store.capture(errEvent);

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'test-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'test-key' });

  try {
    const errorList = await client.getErrors();
    assert.equal(errorList.data.length, 1);
    assert.equal(errorList.data[0].name, 'ValidationError');
    assert.equal(errorList.data[0].statusCode, 400);

    const detail = await client.getErrorById(errorList.data[0].id);
    assert.equal(detail.id, errorList.data[0].id);
    assert.equal(detail.message, 'Invalid payload field');
    assert.ok(detail.stack.includes('app.js:10'));
  } finally {
    await server.close();
    await store.close();
  }
});
