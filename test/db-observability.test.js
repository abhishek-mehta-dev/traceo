const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createDbQueryEvent, TraceoDbInstrumentor } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-db-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('db-observability: createDbQueryEvent extracts operation and masks parameters', () => {
  const event = createDbQueryEvent({
    query: 'SELECT * FROM users WHERE email = ? AND password = ?',
    databaseSystem: 'sqlite',
    durationMs: 12.5,
    parameters: ['test@example.com', 'secret-pass-123'],
    rowCount: 1,
    requestId: 'req-db-10',
    traceId: 'trace-db-10'
  });

  assert.equal(event.type, 'DB_QUERY');
  assert.equal(event.payload.operation, 'SELECT');
  assert.equal(event.payload.databaseSystem, 'sqlite');
  assert.equal(event.payload.durationMs, 12.5);
  assert.equal(event.payload.rowCount, 1);
  assert.equal(event.payload.requestId, 'req-db-10');
  assert.deepEqual(event.payload.parameters, ['[REDACTED]', '[REDACTED]']);
});

test('db-observability: TraceoDbInstrumentor wraps execution and records success and duration', async () => {
  const captured = [];
  const dummySink = {
    async capture(evt) {
      captured.push(evt);
    }
  };

  const instrumentor = new TraceoDbInstrumentor(dummySink);

  const result = await instrumentor.recordQuery(
    { query: 'INSERT INTO orders (id, total) VALUES (?, ?)', requestId: 'r-1' },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [{ id: 1 }, { id: 2 }];
    }
  );

  assert.equal(result.length, 2);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'DB_QUERY');
  assert.equal(captured[0].payload.operation, 'INSERT');
  assert.equal(captured[0].payload.rowCount, 2);
  assert.equal(captured[0].payload.success, true);
  assert.ok(captured[0].payload.durationMs >= 4);
});

test('db-observability: Server API and Dashboard SDK query database events', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const queryEvent = createDbQueryEvent({
    query: 'UPDATE users SET status = ? WHERE id = ?',
    databaseSystem: 'sqlite',
    operation: 'UPDATE',
    durationMs: 8.2,
    rowCount: 1,
    requestId: 'req-upd-1',
    traceId: 'trace-upd-1'
  });

  await store.capture(queryEvent);

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'db-test-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'db-test-key' });

  try {
    const list = await client.getQueries();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].operation, 'UPDATE');
    assert.equal(list.data[0].query, 'UPDATE users SET status = ? WHERE id = ?');

    const detail = await client.getQueryById(list.data[0].id);
    assert.equal(detail.id, list.data[0].id);
    assert.equal(detail.durationMs, 8.2);
  } finally {
    await server.close();
    await store.close();
  }
});
