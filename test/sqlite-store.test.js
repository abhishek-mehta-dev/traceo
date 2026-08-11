const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-sqlite-'));
  return path.join(dir, 'traceo.sqlite');
}

test('sqlite store initializes schema, persists events, and survives reopen', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);

  await store.initialize();
  await store.initialize();

  const event = {
    id: 'evt-1',
    type: 'REQUEST_STARTED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: {
      traceId: 'trace-1',
      requestId: 'req-1',
      request: {
        method: 'GET',
        url: '/orders',
        headers: { authorization: 'secret' },
        query: { page: '1' }
      }
    }
  };

  await store.capture(event);

  const saved = store.getById(event.id);
  assert.ok(saved);
  assert.equal(saved.type, 'REQUEST_STARTED');
  assert.equal(saved.payload.traceId, 'trace-1');
  assert.equal(saved.payload.request.method, 'GET');
  assert.equal(saved.payload.request.headers.authorization, '[REDACTED]');

  const byTrace = store.query({ traceId: 'trace-1' });
  assert.equal(byTrace.length, 1);

  const byRequest = store.query({ requestId: 'req-1' });
  assert.equal(byRequest.length, 1);

  await store.close();

  const reopened = new SQLiteTraceStore(dbPath);
  await reopened.initialize();
  const persisted = reopened.getById(event.id);
  assert.ok(persisted);
  assert.equal(persisted.payload.requestId, 'req-1');

  await reopened.close();
});

test('sqlite store orders events and removes expired rows', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  await store.capture({
    id: 'evt-old',
    type: 'REQUEST_COMPLETED',
    timestamp: '2025-01-01T00:00:00.000Z',
    source: 'core',
    payload: { traceId: 'trace-old', requestId: 'req-old', request: { method: 'GET', url: '/old' }, response: { statusCode: 200, durationMs: 1, completedAt: '2025-01-01T00:00:00.000Z' } }
  });

  await store.capture({
    id: 'evt-new',
    type: 'REQUEST_STARTED',
    timestamp: '2026-02-01T00:00:00.000Z',
    source: 'core',
    payload: { traceId: 'trace-new', requestId: 'req-new', request: { method: 'POST', url: '/new' } }
  });

  const allEvents = store.query({});
  assert.equal(allEvents[0].id, 'evt-new');
  assert.equal(allEvents[1].id, 'evt-old');

  const removed = store.cleanup('2025-12-31T23:59:59.000Z');
  assert.equal(removed, 1);

  const remaining = store.query({});
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'evt-new');

  await store.close();
});
