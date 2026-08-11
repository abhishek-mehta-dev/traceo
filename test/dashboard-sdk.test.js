const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-sdk-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('dashboard-sdk client interacts cleanly with traceo server API', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'sdk-evt-1',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T12:00:00.000Z',
    source: 'core',
    payload: {
      traceId: 'sdk-trace-1',
      requestId: 'sdk-req-1',
      request: { method: 'GET', url: '/api/data' },
      response: { statusCode: 200, durationMs: 15 }
    }
  });

  const server = createTraceoServer({ storage: store, port: 0 });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}` });

  try {
    const health = await client.getHealth();
    assert.deepEqual(health, { status: 'ok' });

    const list = await client.getRequests({ page: 1, limit: 10 });
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].id, 'sdk-evt-1');
    assert.equal(list.pagination.total, 1);

    const detail = await client.getRequestById('sdk-evt-1');
    assert.equal(detail.id, 'sdk-evt-1');
    assert.equal(detail.statusCode, 200);

    const timeline = await client.getTraceTimeline('sdk-trace-1');
    assert.equal(timeline.traceId, 'sdk-trace-1');
    assert.equal(timeline.events.length, 1);
  } finally {
    await server.close();
    await store.close();
  }
});
