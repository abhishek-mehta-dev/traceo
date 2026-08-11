const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAuthEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-auth-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('auth-events: createAuthEvent creates canonical event and redacts sensitive metadata', () => {
  const event = createAuthEvent({
    action: 'login_failed',
    userId: 'user_404',
    error: 'Invalid password',
    metadata: {
      passwordAttempt: 'SecretPass123!',
      ipAddress: '192.168.1.50',
      authToken: 'eyJhbGciOi...'
    },
    requestId: 'req-auth-1',
    traceId: 'trace-auth-1'
  });

  assert.equal(event.type, 'AUTH');
  assert.equal(event.payload.action, 'login_failed');
  assert.equal(event.payload.userId, 'user_404');
  assert.equal(event.payload.success, false);
  assert.equal(event.payload.error, 'Invalid password');
  assert.equal(event.payload.metadata.passwordAttempt, '[REDACTED]');
  assert.equal(event.payload.metadata.authToken, '[REDACTED]');
  assert.equal(event.payload.metadata.ipAddress, '192.168.1.50');
});

test('auth-events: Server API and Dashboard SDK list and retrieve auth events', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const authEvent = createAuthEvent({
    action: 'login',
    userId: 'user_777',
    success: true,
    metadata: { provider: 'github' },
    requestId: 'req-auth-ok',
    traceId: 'trace-auth-ok'
  });

  await store.capture(authEvent);

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'auth-test-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'auth-test-key' });

  try {
    const list = await client.getAuthEvents();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].action, 'login');
    assert.equal(list.data[0].userId, 'user_777');
    assert.equal(list.data[0].success, true);

    const detail = await client.getAuthEventById(list.data[0].id);
    assert.equal(detail.id, list.data[0].id);
    assert.equal(detail.metadata.provider, 'github');
  } finally {
    await server.close();
    await store.close();
  }
});
