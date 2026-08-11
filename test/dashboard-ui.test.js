const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-ui-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('dashboard UI integration: SDK cleanly retrieves overview stats, request lists, and request details', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'ui-evt-1',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T10:00:00.000Z',
    source: 'core',
    payload: {
      traceId: 'ui-trace-1',
      requestId: 'ui-req-1',
      request: { method: 'GET', url: '/api/v1/users' },
      response: { statusCode: 200, durationMs: 25 }
    }
  });

  await store.capture({
    id: 'ui-evt-2',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T10:05:00.000Z',
    source: 'core',
    payload: {
      traceId: 'ui-trace-2',
      requestId: 'ui-req-2',
      request: { method: 'POST', url: '/api/v1/checkout' },
      response: { statusCode: 500, durationMs: 120 }
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
    const list = await client.getRequests({ page: 1, limit: 10 });
    assert.equal(list.data.length, 2);
    assert.equal(list.pagination.total, 2);

    let successCount = 0;
    let errorCount = 0;
    for (const item of list.data) {
      if (item.statusCode && item.statusCode >= 200 && item.statusCode < 300) {
        successCount++;
      } else if (item.statusCode && item.statusCode >= 400) {
        errorCount++;
      }
    }
    assert.equal(successCount, 1);
    assert.equal(errorCount, 1);

    const getFilter = await client.getRequests({ method: 'GET' });
    assert.equal(getFilter.data.length, 1);
    assert.equal(getFilter.data[0].id, 'ui-evt-1');

    const detail = await client.getRequestById('ui-evt-2');
    assert.equal(detail.id, 'ui-evt-2');
    assert.equal(detail.statusCode, 500);

    const timeline = await client.getTraceTimeline('ui-trace-2');
    assert.equal(timeline.events.length, 1);
    assert.equal(timeline.events[0].id, 'ui-evt-2');
  } finally {
    await server.close();
    await store.close();
  }
});
