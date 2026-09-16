const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const {
  createTraceoServer,
  paginateRequestSummaries,
  filterRequestSummaries,
  requestFacets
} = require(path.resolve(__dirname, '../packages/server/dist/create-server.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function summary(id, extras = {}) {
  return { requestId: id, errorCount: 0, eventCount: 1, ...extras };
}

function summaries(count) {
  return Array.from({ length: count }, (_, index) => summary('req-' + index, { statusCode: 200 }));
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: urlPath }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: JSON.parse(data)
      }));
    }).on('error', reject);
  });
}

async function seedRequests(store, count) {
  for (let i = 0; i < count; i += 1) {
    const second = String(i).padStart(2, '0');
    const statusCode = i % 5 === 0 ? 500 : i % 3 === 0 ? 404 : 200;
    await store.capture({
      id: 'start-' + i,
      type: 'REQUEST_STARTED',
      timestamp: `2026-01-01T00:00:${second}.000Z`,
      source: 'core',
      payload: { requestId: 'req-' + i, request: { method: i % 2 ? 'POST' : 'GET', url: '/item/' + i } }
    });
    await store.capture({
      id: 'done-' + i,
      type: 'REQUEST_COMPLETED',
      timestamp: `2026-01-01T00:00:${second}.500Z`,
      source: 'core',
      payload: {
        requestId: 'req-' + i,
        request: { method: i % 2 ? 'POST' : 'GET', url: '/item/' + i },
        response: { statusCode, durationMs: 4, completedAt: `2026-01-01T00:00:${second}.500Z` }
      }
    });
  }
  await store.capture({
    id: 'err-1',
    type: 'error',
    timestamp: '2026-01-01T00:00:01.800Z',
    source: 'core',
    payload: { requestId: 'req-1', message: 'boom' }
  });
}

test('paginateRequestSummaries leaves unpaged lists intact', () => {
  const items = summaries(8);
  const page = paginateRequestSummaries(items, null, null);

  assert.equal(page.count, 8);
  assert.equal(page.requests.length, 8);
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 1);
  assert.equal(page.hasPrev, false);
  assert.equal(page.hasNext, false);
  assert.equal(page.pageSize, 8);
});

test('paginateRequestSummaries slices forward and back with defaults', () => {
  const items = summaries(26);
  const first = paginateRequestSummaries(items, '1', '10');
  const second = paginateRequestSummaries(items, '2', '10');
  const last = paginateRequestSummaries(items, '3', '10');

  assert.equal(first.requests.length, 10);
  assert.equal(first.requests[0].requestId, 'req-0');
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasNext, true);
  assert.equal(first.totalPages, 3);

  assert.equal(second.requests[0].requestId, 'req-10');
  assert.equal(second.hasPrev, true);
  assert.equal(second.hasNext, true);

  assert.equal(last.requests.length, 6);
  assert.equal(last.page, 3);
  assert.equal(last.hasPrev, true);
  assert.equal(last.hasNext, false);
});

test('paginateRequestSummaries validates and clamps edge cases', () => {
  const items = summaries(12);
  const empty = paginateRequestSummaries([], '4', '10');
  const beyond = paginateRequestSummaries(items, '99', '5');
  const invalid = paginateRequestSummaries(items, 'abc', '-3');
  const floats = paginateRequestSummaries(items, '1.5', '2.5');
  const zero = paginateRequestSummaries(items, '0', '0');
  const huge = paginateRequestSummaries(summaries(150), '1', '500');
  const scientific = paginateRequestSummaries(items, '1e2', '1e2');
  const onlyPage = paginateRequestSummaries(summaries(40), '2', null);
  const onlySize = paginateRequestSummaries(items, null, '5');
  const blanks = paginateRequestSummaries(items, '', '');

  assert.deepEqual(empty, {
    requests: [],
    count: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    hasPrev: false,
    hasNext: false
  });
  assert.equal(beyond.page, 3);
  assert.equal(beyond.requests.length, 2);
  assert.equal(beyond.hasNext, false);
  assert.equal(invalid.page, 1);
  assert.equal(invalid.pageSize, 25);
  assert.equal(floats.page, 1);
  assert.equal(floats.pageSize, 25);
  assert.equal(zero.page, 1);
  assert.equal(zero.pageSize, 25);
  assert.equal(huge.pageSize, 100);
  assert.equal(huge.requests.length, 100);
  assert.equal(scientific.page, 1);
  assert.equal(scientific.pageSize, 25);
  assert.equal(onlyPage.page, 2);
  assert.equal(onlyPage.pageSize, 25);
  assert.equal(onlyPage.requests.length, 15);
  assert.equal(onlyPage.hasPrev, true);
  assert.equal(onlyPage.hasNext, false);
  assert.equal(onlySize.page, 1);
  assert.equal(onlySize.pageSize, 5);
  assert.equal(blanks.requests.length, 12);
  assert.equal(blanks.hasNext, false);
});

test('filterRequestSummaries and facets cover status families and faults', () => {
  const items = [
    summary('ok', { statusCode: 201 }),
    summary('missing', { statusCode: 404 }),
    summary('crash', { statusCode: 500 }),
    summary('thrown', { statusCode: 200, errorCount: 1 })
  ];

  assert.equal(filterRequestSummaries(items, { statusFamily: '4' }).length, 1);
  assert.equal(filterRequestSummaries(items, { faults: true }).length, 2);
  assert.equal(filterRequestSummaries(items, { statusFamily: '2', faults: true }).length, 2);
  assert.deepEqual(requestFacets(items), {
    '': 4,
    '2': 2,
    '4': 1,
    '5': 1,
    errors: 2
  });
});

test('GET /requests paginates, filters, and rejects invalid page values', async () => {
  const store = new InMemoryTraceStore();
  await seedRequests(store, 30);

  const server = createTraceoServer({ storage: store, dashboard: false });
  const port = await listen(server);

  try {
    const all = await get(port, '/requests');
    assert.equal(all.statusCode, 200);
    assert.equal(all.body.count, 30);
    assert.equal(all.body.requests.length, 30);
    assert.equal(all.body.requests[0].requestId, 'req-29');
    assert.equal(all.body.facets[''], 30);
    assert.equal(all.body.facets['2'], 16);
    assert.equal(all.body.facets['4'], 8);
    assert.equal(all.body.facets['5'], 6);
    assert.equal(all.body.facets.errors, 7);

    const page1 = await get(port, '/requests?page=1&pageSize=10');
    assert.equal(page1.body.page, 1);
    assert.equal(page1.body.pageSize, 10);
    assert.equal(page1.body.count, 30);
    assert.equal(page1.body.totalPages, 3);
    assert.equal(page1.body.hasPrev, false);
    assert.equal(page1.body.hasNext, true);
    assert.equal(page1.body.requests.length, 10);
    assert.equal(page1.body.requests[0].requestId, 'req-29');
    assert.equal(page1.body.requests[9].requestId, 'req-20');
    assert.equal(page1.body.facets.errors, 7);

    const page2 = await get(port, '/requests?page=2&pageSize=10');
    assert.equal(page2.body.page, 2);
    assert.equal(page2.body.hasPrev, true);
    assert.equal(page2.body.hasNext, true);
    assert.equal(page2.body.requests[0].requestId, 'req-19');

    const page3 = await get(port, '/requests?page=3&pageSize=10');
    assert.equal(page3.body.page, 3);
    assert.equal(page3.body.requests.length, 10);
    assert.equal(page3.body.hasNext, false);
    assert.equal(page3.body.requests[9].requestId, 'req-0');

    const clamped = await get(port, '/requests?page=99&pageSize=10');
    assert.equal(clamped.body.page, 3);
    assert.equal(clamped.body.requests[0].requestId, page3.body.requests[0].requestId);

    const invalid = await get(port, '/requests?page=nope&pageSize=nope');
    assert.equal(invalid.body.page, 1);
    assert.equal(invalid.body.pageSize, 25);

    const oversized = await get(port, '/requests?page=1&pageSize=500');
    assert.equal(oversized.body.pageSize, 100);
    assert.equal(oversized.body.requests.length, 30);

    const family = await get(port, '/requests?page=1&pageSize=10&statusFamily=4');
    assert.equal(family.body.count, 8);
    assert.equal(family.body.totalPages, 1);
    assert.equal(family.body.hasNext, false);
    assert.ok(family.body.requests.every((item) => String(item.statusCode).startsWith('4')));
    assert.equal(family.body.facets['4'], 8);

    const faults = await get(port, '/requests?page=1&pageSize=10&faults=1');
    assert.equal(faults.body.count, 7);
    assert.ok(faults.body.requests.every((item) => item.errorCount > 0 || item.statusCode >= 500));

    const ignoredFamily = await get(port, '/requests?page=1&pageSize=10&statusFamily=9');
    assert.equal(ignoredFamily.body.count, 30);

    const limited = await get(port, '/requests?limit=1');
    assert.equal(limited.body.count, 30);
    const grouped = limited.body.requests.find((item) => item.requestId === 'req-1');
    assert.equal(grouped.errorCount, 1);
    assert.equal(grouped.eventCount, 3);

    const empty = await get(port, '/requests?search=does-not-exist&page=4&pageSize=10');
    assert.equal(empty.body.count, 0);
    assert.equal(empty.body.page, 1);
    assert.equal(empty.body.requests.length, 0);
    assert.equal(empty.body.hasPrev, false);
    assert.equal(empty.body.hasNext, false);
    assert.equal(empty.body.totalPages, 1);
  } finally {
    await closeServer(server);
  }
});

test('GET /requests empty store stays on page 1 with pager disabled', async () => {
  const server = createTraceoServer({ storage: new InMemoryTraceStore(), dashboard: false });
  const port = await listen(server);

  try {
    const page = await get(port, '/requests?page=8&pageSize=10');
    assert.equal(page.statusCode, 200);
    assert.equal(page.body.count, 0);
    assert.equal(page.body.page, 1);
    assert.equal(page.body.hasPrev, false);
    assert.equal(page.body.hasNext, false);
    assert.deepEqual(page.body.requests, []);
    assert.equal(page.body.facets[''], 0);
  } finally {
    await closeServer(server);
  }
});
