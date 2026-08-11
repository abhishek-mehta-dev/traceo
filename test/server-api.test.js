const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-server-api-'));
  return path.join(dir, 'traceo.sqlite');
}

function requestJson(serverInstance, pathName, options = {}) {
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
          resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null });
        });
      }
    );
    req.on('error', reject);
    req.end(options.body ? JSON.stringify(options.body) : undefined);
  });
}

test('server exposes health, request list, detail, timeline, and pagination through the storage abstraction', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'evt-1',
    type: 'REQUEST_STARTED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: {
      traceId: 'trace-1',
      requestId: 'req-1',
      request: { method: 'GET', url: '/users', route: '/users' }
    }
  });

  await store.capture({
    id: 'evt-2',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T00:00:01.000Z',
    source: 'core',
    payload: {
      traceId: 'trace-1',
      requestId: 'req-1',
      request: { method: 'GET', url: '/users', route: '/users' },
      response: { statusCode: 200, durationMs: 42, completedAt: '2026-01-01T00:00:01.000Z' }
    }
  });

  await store.capture({
    id: 'evt-3',
    type: 'REQUEST_STARTED',
    timestamp: '2026-01-01T00:00:02.000Z',
    source: 'core',
    payload: {
      traceId: 'trace-2',
      requestId: 'req-2',
      request: { method: 'POST', url: '/orders', route: '/orders' }
    }
  });

  const server = createTraceoServer({ storage: store, port: 0 });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const health = await requestJson(server, '/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.body, { status: 'ok' });

    const list = await requestJson(server, '/requests?page=1&limit=1');
    assert.equal(list.statusCode, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.pagination.page, 1);
    assert.equal(list.body.pagination.limit, 1);
    assert.equal(list.body.pagination.total, 3);
    assert.equal(list.body.pagination.totalPages, 3);

    const filtered = await requestJson(server, '/requests?method=GET&status=200&traceId=trace-1&requestId=req-1&eventType=REQUEST_COMPLETED');
    assert.equal(filtered.statusCode, 200);
    assert.equal(filtered.body.data.length, 1);
    assert.equal(filtered.body.data[0].requestId, 'req-1');

    const detail = await requestJson(server, '/requests/evt-2');
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.body.id, 'evt-2');
    assert.equal(detail.body.statusCode, 200);

    const notFound = await requestJson(server, '/requests/non-existent-id');
    assert.equal(notFound.statusCode, 404);
    assert.equal(notFound.body.error, 'Request not found');

    const timeline = await requestJson(server, '/requests/trace-1/timeline');
    assert.equal(timeline.statusCode, 200);
    assert.equal(timeline.body.traceId, 'trace-1');
    assert.equal(timeline.body.events.length, 2);

    const invalidSort = await requestJson(server, '/requests?sort=bad');
    assert.equal(invalidSort.statusCode, 400);

    const invalidPage = await requestJson(server, '/requests?page=0');
    assert.equal(invalidPage.statusCode, 400);

    const excessiveLimit = await requestJson(server, '/requests?limit=999999');
    assert.equal(excessiveLimit.statusCode, 400);

    const sortedByDuration = await requestJson(server, '/requests?sort=duration&order=DESC');
    assert.equal(sortedByDuration.statusCode, 200);
    assert.equal(sortedByDuration.body.data[0].id, 'evt-2');
  } finally {
    await server.close();
    await store.close();
  }
});

test('server handles storage failures gracefully with 500 status without leaking internals', async () => {
  const faultyStore = {
    query() {
      throw new Error('Database disk image is malformed');
    },
    getById() {
      throw new Error('Database disk image is malformed');
    },
    getTimeline() {
      throw new Error('Database disk image is malformed');
    }
  };

  const server = createTraceoServer({ storage: faultyStore, port: 0 });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const listResponse = await requestJson(server, '/requests');
    assert.equal(listResponse.statusCode, 500);
    assert.equal(listResponse.body.error, 'Invalid request');

    const detailResponse = await requestJson(server, '/requests/evt-1');
    assert.equal(detailResponse.statusCode, 500);
    assert.equal(detailResponse.body.error, 'Storage failure');
    assert.equal(detailResponse.body.details, 'Database disk image is malformed');
  } finally {
    await server.close();
  }
});
