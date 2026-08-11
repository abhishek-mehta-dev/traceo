const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer, ApiKeyAuthProvider, BruteForceProtector } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-security-test-'));
  return path.join(dir, 'traceo.sqlite');
}

function requestHttp(serverInstance, pathName, options = {}) {
  const server = serverInstance.server || serverInstance;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathName,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? (data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data) : null
          });
        });
      }
    );
    req.on('error', reject);
    req.end(options.body ? JSON.stringify(options.body) : undefined);
  });
}

test('security: unauthenticated requests are rejected with 401 Unauthorized', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'secret-key-123' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const health = await requestHttp(server, '/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.body, { status: 'ok' });

    const unauthRequests = await requestHttp(server, '/requests');
    assert.equal(unauthRequests.statusCode, 401);
    assert.equal(unauthRequests.body.error, 'Invalid API key');

    const unauthDetail = await requestHttp(server, '/requests/some-id');
    assert.equal(unauthDetail.statusCode, 401);

    const unauthTimeline = await requestHttp(server, '/requests/some-trace/timeline');
    assert.equal(unauthTimeline.statusCode, 401);
  } finally {
    await server.close();
    await store.close();
  }
});

test('security: valid API key via Authorization header or x-traceo-api-key grants access', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'sec-evt-1',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: { traceId: 't-1', requestId: 'r-1', request: { method: 'GET', url: '/api' } }
  });

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'secret-key-123' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const bearerAccess = await requestHttp(server, '/requests', {
      headers: { Authorization: 'Bearer secret-key-123' }
    });
    assert.equal(bearerAccess.statusCode, 200);
    assert.equal(bearerAccess.body.data.length, 1);

    const headerAccess = await requestHttp(server, '/requests', {
      headers: { 'x-traceo-api-key': 'secret-key-123' }
    });
    assert.equal(headerAccess.statusCode, 200);

    const verifyResp = await requestHttp(server, '/auth/verify', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-key-123' }
    });
    assert.equal(verifyResp.statusCode, 200);
    assert.equal(verifyResp.body.authenticated, true);
  } finally {
    await server.close();
    await store.close();
  }
});

test('security: brute-force rate limiter locks out repeated invalid attempts', async () => {
  const protector = new BruteForceProtector(3, 60000);
  const provider = new ApiKeyAuthProvider('valid-key', protector);

  const mockReq = {
    headers: { 'x-traceo-api-key': 'wrong-key' },
    socket: { remoteAddress: '192.168.1.100' }
  };

  assert.equal(provider.authenticate(mockReq).statusCode, 401);
  assert.equal(provider.authenticate(mockReq).statusCode, 401);
  assert.equal(provider.authenticate(mockReq).statusCode, 401);

  // 4th attempt should be blocked with 429 Too Many Requests
  const blocked = provider.authenticate(mockReq);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.authenticated, false);
});

test('security: production disabled posture returns 403 Forbidden', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const server = createTraceoServer({ storage: store, port: 0, enabled: false });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const response = await requestHttp(server, '/requests');
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, 'Traceo dashboard API is disabled in this environment.');
  } finally {
    await server.close();
    await store.close();
  }
});

test('security: security headers and CORS origins are strictly set', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const server = createTraceoServer({
    storage: store,
    port: 0,
    corsOrigin: 'http://localhost:3000'
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const res = await requestHttp(server, '/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');

    const optionsRes = await requestHttp(server, '/requests', { method: 'OPTIONS' });
    assert.equal(optionsRes.statusCode, 204);
  } finally {
    await server.close();
    await store.close();
  }
});

test('security: SDK integration works with authenticated server', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'sdk-sec-1',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: { traceId: 't-1', requestId: 'r-1', request: { method: 'GET', url: '/secure' } }
  });

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'my-app-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'my-app-key' });

  try {
    const authStatus = await client.verifyAuth();
    assert.equal(authStatus.authenticated, true);

    const list = await client.getRequests();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].id, 'sdk-sec-1');
  } finally {
    await server.close();
    await store.close();
  }
});
