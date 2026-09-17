const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/create-server.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function get(port, urlPath, headers = {}) {
  return send(port, { method: 'GET', path: urlPath, headers });
}

function send(port, { method, path: urlPath, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('dashboard lists requests and serves the UI from injected storage', async () => {
  const store = new InMemoryTraceStore();
  await store.capture({
    id: '1',
    type: 'REQUEST_STARTED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: { requestId: 'req-1', request: { method: 'GET', url: '/orders' } }
  });
  await store.capture({
    id: '2',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T00:00:01.000Z',
    source: 'core',
    payload: { requestId: 'req-1', request: { method: 'GET', url: '/orders' }, response: { statusCode: 200, durationMs: 4 } }
  });

  const server = createTraceoServer({
    storage: store,
    dashboard: true,
    dashboardDir: path.resolve(__dirname, '../apps/dashboard/public')
  });
  const port = await listen(server);

  try {
    const ui = await get(port, '/');
    assert.equal(ui.statusCode, 200);
    assert.match(ui.body, /Traceo/);
    assert.match(ui.body, /signal desk/);
    assert.match(ui.body, /rel="icon"/);
    assert.match(ui.body, /favicon\.svg/);
    assert.match(ui.body, /id="page-prev"/);
    assert.match(ui.body, /id="page-next"/);
    assert.match(ui.body, /aria-label="Hop pages"/);
    assert.match(ui.body, /id="page-input"/);
    assert.match(ui.body, /id="clear-all"/);
    assert.match(ui.body, /styles\.css/);
    assert.match(ui.body, /app\.js/);
    assert.match(ui.body, /json-preview\.js/);

    const preview = await get(port, '/json-preview.js');
    assert.equal(preview.statusCode, 200);
    assert.match(preview.headers['content-type'], /javascript/);
    assert.match(preview.body, /recoverTruncatedJson/);

    const css = await get(port, '/styles.css');
    assert.equal(css.statusCode, 200);
    assert.match(css.headers['content-type'], /text\/css/);

    const appJs = await get(port, '/app.js');
    assert.equal(appJs.statusCode, 200);
    assert.match(appJs.headers['content-type'], /javascript/);
    assert.match(appJs.body, /loadRequests/);
    assert.match(appJs.body, /TRACEO_BASE|__TRACEO_BASE__/);

    const icon = await get(port, '/favicon.svg');
    assert.equal(icon.statusCode, 200);
    assert.match(icon.headers['content-type'], /image\/svg\+xml/);
    assert.match(icon.body, /Traceo/);

    const ico = await get(port, '/favicon.ico');
    assert.equal(ico.statusCode, 200);
    assert.match(ico.headers['content-type'], /image\/(x-icon|vnd\.microsoft\.icon)/);

    const requests = await get(port, '/requests');
    assert.equal(requests.statusCode, 200);
    const body = JSON.parse(requests.body);
    assert.equal(body.count, 1);
    assert.equal(body.requests[0].requestId, 'req-1');
    assert.equal(body.requests[0].method, 'GET');
    assert.equal(body.requests[0].statusCode, 200);
  } finally {
    await closeServer(server);
  }
});

test('dashboard is disabled when explicitly turned off', async () => {
  const server = createTraceoServer({ storage: new InMemoryTraceStore(), dashboard: false });
  const port = await listen(server);
  try {
    const ui = await get(port, '/');
    assert.equal(ui.statusCode, 404);
    assert.match(ui.body, /Dashboard disabled/);
  } finally {
    await closeServer(server);
  }
});

test('health stays public while events require configured credentials', async () => {
  const store = new InMemoryTraceStore();
  await store.capture({
    id: '1',
    type: 'request',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'express',
    payload: { requestId: 'req-auth', method: 'GET', url: '/secret' }
  });
  const server = createTraceoServer({
    storage: store,
    dashboard: false,
    basicAuth: { username: 'traceo', password: 's3cret' },
    apiKey: 'key-123'
  });
  const port = await listen(server);

  try {
    const health = await get(port, '/health');
    assert.equal(health.statusCode, 200);

    const denied = await get(port, '/events');
    assert.equal(denied.statusCode, 401);

    const basic = await get(port, '/events', {
      authorization: 'Basic ' + Buffer.from('traceo:s3cret').toString('base64')
    });
    assert.equal(basic.statusCode, 200);
    assert.match(basic.body, /req-auth/);

    const apiKey = await get(port, '/events', { 'x-traceo-key': 'key-123' });
    assert.equal(apiKey.statusCode, 200);

    const deniedClear = await send(port, { method: 'DELETE', path: '/requests' });
    assert.equal(deniedClear.statusCode, 401);
  } finally {
    await closeServer(server);
  }
});

test('DELETE /requests clears captured hops', async () => {
  const store = new InMemoryTraceStore();
  await store.capture({
    id: '1',
    type: 'REQUEST_STARTED',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'core',
    payload: { requestId: 'req-1', request: { method: 'GET', url: '/orders' } }
  });
  await store.capture({
    id: '2',
    type: 'REQUEST_COMPLETED',
    timestamp: '2026-01-01T00:00:01.000Z',
    source: 'core',
    payload: { requestId: 'req-1', request: { method: 'GET', url: '/orders' }, response: { statusCode: 200, durationMs: 4 } }
  });

  const server = createTraceoServer({ storage: store, dashboard: false });
  const port = await listen(server);

  try {
    const cleared = await send(port, { method: 'DELETE', path: '/requests' });
    assert.equal(cleared.statusCode, 200);
    assert.deepEqual(JSON.parse(cleared.body), { removed: 2 });

    const requests = await get(port, '/requests');
    assert.equal(requests.statusCode, 200);
    const body = JSON.parse(requests.body);
    assert.equal(body.count, 0);
    assert.deepEqual(body.requests, []);

    const empty = await send(port, { method: 'DELETE', path: '/requests' });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(JSON.parse(empty.body), { removed: 0 });
  } finally {
    await closeServer(server);
  }
});
