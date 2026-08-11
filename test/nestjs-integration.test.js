const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { TraceoInterceptor, createTraceoNestMiddleware, TraceoModule } = require(path.resolve(__dirname, '../packages/nestjs/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-nestjs-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('nestjs integration: TraceoInterceptor captures HTTP request/response lifecycle into storage', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const interceptor = new TraceoInterceptor({
    sink: store,
    captureHeaders: true
  });

  const mockReq = {
    method: 'GET',
    url: '/users/42',
    originalUrl: '/users/42',
    headers: { 'user-agent': 'nestjs-test-agent' },
    query: { verbose: 'true' }
  };

  const mockRes = {
    statusCode: 200,
    getHeaders: () => ({ 'content-type': 'application/json' }),
    listeners: {},
    on(event, callback) {
      this.listeners[event] = callback;
    }
  };

  const mockContext = {
    getType: () => 'http',
    getClass: () => ({ name: 'UsersController' }),
    getHandler: () => ({ name: 'findOne' }),
    switchToHttp: () => ({
      getRequest: () => mockReq,
      getResponse: () => mockRes
    })
  };

  const mockNext = {
    handle: () => ({
      pipe: () => {}
    })
  };

  interceptor.intercept(mockContext, mockNext);

  // Trigger response finish event
  if (mockRes.listeners['finish']) {
    mockRes.listeners['finish']();
  }

  await new Promise((resolve) => setImmediate(resolve));

  const events = store.query({ requestId: mockReq.traceoRequestId });
  assert.equal(events.length, 2);
  const types = events.map((e) => e.type).sort();
  assert.deepEqual(types, ['REQUEST_COMPLETED', 'REQUEST_STARTED']);

  const started = events.find((e) => e.type === 'REQUEST_STARTED');
  assert.equal(started.payload.request.route, 'UsersController.findOne');
  assert.equal(started.payload.request.method, 'GET');

  const completed = events.find((e) => e.type === 'REQUEST_COMPLETED');
  assert.equal(completed.payload.response.statusCode, 200);

  await store.close();
});

test('nestjs integration: createTraceoNestMiddleware captures functional requests', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const middleware = createTraceoNestMiddleware({ sink: store });

  const mockReq = { method: 'POST', url: '/orders', headers: {} };
  const mockRes = {
    statusCode: 201,
    listeners: {},
    on(event, callback) {
      this.listeners[event] = callback;
    }
  };

  middleware(mockReq, mockRes, () => {
    if (mockRes.listeners['finish']) {
      mockRes.listeners['finish']();
    }
  });

  await new Promise((resolve) => setImmediate(resolve));

  const events = store.query({ requestId: mockReq.traceoRequestId });
  assert.equal(events.length, 2);

  await store.close();
});

test('nestjs integration: TraceoModule.forRoot returns a dynamic module definition', () => {
  const dummySink = { async capture() {} };
  const moduleDef = TraceoModule.forRoot({ sink: dummySink });
  assert.ok(moduleDef.module);
  assert.equal(moduleDef.global, true);
  assert.equal(moduleDef.providers.length, 2);
});
