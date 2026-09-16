const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  FileTraceStore,
  InMemoryTraceStore,
  JsonFileTraceStore,
  SqliteTraceStore,
  TraceoStorageError
} = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function createEvent(overrides = {}) {
  return {
    id: overrides.id ?? 'evt-1',
    type: overrides.type ?? 'request',
    timestamp: overrides.timestamp ?? '2026-01-01T00:00:00.000Z',
    source: overrides.source ?? 'express',
    payload: overrides.payload ?? { requestId: 'req-123', method: 'GET', url: '/orders', statusCode: 200 }
  };
}

function runStorageContractTests(name, createStore) {
  test(`${name} persists captured events and returns them by id`, async (t) => {
    const store = await createStore(t);
    const event = createEvent();
    await store.capture(event);

    const stored = await store.getById(event.id);
    assert.deepEqual(stored, event);
  });

  test(`${name} query supports type, requestId, method, status, source, search, date, and limit`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({ id: '1', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', payload: { requestId: 'req-1', method: 'GET', url: '/orders', statusCode: 200 } }));
    await store.capture(createEvent({ id: '2', type: 'response', timestamp: '2026-01-01T00:00:01.000Z', payload: { requestId: 'req-1', method: 'GET', url: '/orders', statusCode: 200 } }));
    await store.capture(createEvent({
      id: '3',
      type: 'request',
      timestamp: '2026-01-02T00:00:00.000Z',
      source: 'core',
      payload: { requestId: 'req-2', method: 'POST', url: '/billing', statusCode: 500 }
    }));

    const byType = await store.query({ type: 'request' });
    assert.equal(byType.length, 2);

    const byRequest = await store.query({ requestId: 'req-1' });
    assert.equal(byRequest.length, 2);

    const byMethod = await store.query({ method: 'POST' });
    assert.equal(byMethod[0].id, '3');

    const byStatus = await store.query({ statusCode: 500 });
    assert.equal(byStatus[0].id, '3');

    const bySource = await store.query({ source: 'core' });
    assert.equal(bySource[0].id, '3');

    const bySearch = await store.query({ search: 'orders' });
    assert.equal(bySearch.length, 2);

    const byDate = await store.query({ from: '2026-01-01T00:00:00.500Z', to: '2026-01-01T00:00:01.500Z' });
    assert.equal(byDate.length, 1);
    assert.equal(byDate[0].id, '2');

    const limited = await store.query({ search: 'orders', limit: 1 });
    assert.equal(limited.length, 1);
  });

  test(`${name} timeline returns correlated events in deterministic oldest-first order`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({ id: 'b', type: 'error', timestamp: '2026-01-01T00:00:01.000Z', payload: { requestId: 'req-123', message: 'boom' } }));
    await store.capture(createEvent({ id: 'a', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', payload: { requestId: 'req-123', method: 'GET' } }));
    await store.capture(createEvent({ id: 'c', type: 'request', timestamp: '2026-01-01T00:00:02.000Z', payload: { requestId: 'req-other', method: 'POST' } }));

    const timeline = await store.getTimeline('req-123');
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].type, 'request');
    assert.equal(timeline[1].type, 'error');
    assert.deepEqual(timeline.map((event) => event.id), ['a', 'b']);
  });

  test(`${name} getById returns null for a missing event`, async (t) => {
    const store = await createStore(t);
    assert.equal(await store.getById('missing'), null);
  });

  test(`${name} cleanup removes events older than the cutoff`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({ id: 'old', timestamp: '2026-01-01T00:00:00.000Z' }));
    await store.capture(createEvent({ id: 'new', timestamp: '2026-01-03T00:00:00.000Z' }));

    const removed = await store.cleanup({ olderThan: '2026-01-02T00:00:00.000Z' });
    assert.equal(removed, 1);
    assert.equal(await store.getById('old'), null);
    assert.equal((await store.getById('new')).id, 'new');
  });

  test(`${name} cleanup without olderThan does not wipe events`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({ id: 'keep' }));
    assert.equal(await store.cleanup(), 0);
    assert.equal((await store.getById('keep')).id, 'keep');
  });

  test(`${name} clear removes every stored event`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({ id: 'one' }));
    await store.capture(createEvent({ id: 'two', timestamp: '2026-01-01T00:00:01.000Z' }));

    const removed = await store.clear();
    assert.equal(removed, 2);
    assert.equal(await store.getById('one'), null);
    assert.equal(await store.getById('two'), null);
    assert.equal((await store.query()).length, 0);
    assert.equal(await store.clear(), 0);
  });

  test(`${name} close prevents later use`, async (t) => {
    const store = await createStore(t);
    await store.close();
    await assert.rejects(() => store.capture(createEvent()), (error) => {
      assert.equal(error.name, 'TraceoStorageError');
      assert.equal(error.code, 'CLOSED');
      return true;
    });
  });

  test(`${name} redacts obvious secrets before persist`, async (t) => {
    const store = await createStore(t);
    await store.capture(createEvent({
      id: 'secret',
      payload: {
        requestId: 'req-secret',
        request: {
          url: '/pay?token=secret&page=1',
          headers: { authorization: 'Bearer secret', 'x-api-key': 'secret-key', 'x-safe': 'visible' },
          query: { token: 'secret', page: '1' },
          cookies: { session: 'secret-cookie' }
        },
        response: {
          headers: { authorization: 'Bearer response-secret' },
          body: 'card 4111-1111-1111-1111'
        }
      }
    }));

    const stored = await store.getById('secret');
    assert.equal(stored.payload.request.url, '/pay?token=[REDACTED]&page=1');
    assert.equal(stored.payload.request.headers.authorization, '[REDACTED]');
    assert.equal(stored.payload.request.headers['x-api-key'], '[REDACTED]');
    assert.equal(stored.payload.request.headers['x-safe'], 'visible');
    assert.equal(stored.payload.request.query.token, '[REDACTED]');
    assert.equal(stored.payload.request.cookies.session, '[REDACTED]');
    assert.equal(stored.payload.response.headers.authorization, '[REDACTED]');
    assert.equal(stored.payload.response.body, 'card [REDACTED]');
  });

  test(`${name} rejects invalid events without implementation details`, async (t) => {
    const store = await createStore(t);
    await assert.rejects(() => store.capture({ id: '', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', source: 'core', payload: {} }), (error) => {
      assert.ok(error instanceof TraceoStorageError);
      assert.equal(error.code, 'INVALID_EVENT');
      assert.doesNotMatch(error.message, /\/home|events\.json|ENOENT|SyntaxError/);
      return true;
    });
  });
}

runStorageContractTests('InMemoryTraceStore', async () => new InMemoryTraceStore());

runStorageContractTests('FileTraceStore', async (t) => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-storage-')), 'events.json');
  t.after(() => {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  });
  return new FileTraceStore(filePath);
});

runStorageContractTests('JsonFileTraceStore alias', async (t) => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-json-storage-')), 'events.json');
  t.after(() => {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  });
  return new JsonFileTraceStore(filePath);
});

runStorageContractTests('SqliteTraceStore', async (t) => {
  const store = new SqliteTraceStore(':memory:');
  t.after(() => store.close());
  return store;
});

test('FileTraceStore does not leak filesystem details on corrupt data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-corrupt-'));
  const filePath = path.join(dir, 'events.json');
  fs.writeFileSync(filePath, '{not-json');
  const store = new FileTraceStore(filePath);

  try {
    await assert.rejects(() => store.query(), (error) => {
      assert.ok(error instanceof TraceoStorageError);
      assert.equal(error.code, 'UNAVAILABLE');
      assert.doesNotMatch(error.message, new RegExp(filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
