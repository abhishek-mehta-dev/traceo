const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require(path.resolve(__dirname, '../examples/express-basic/node_modules/express'));

const { attachTraceo } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    server.once('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function request(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('attachTraceo is a no-op when TRACEO_ENABLED is off', async () => {
  const previous = process.env.TRACEO_ENABLED;
  delete process.env.TRACEO_ENABLED;
  try {
    const app = express();
    const attachment = attachTraceo(app);
    assert.equal(attachment.enabled, false);
    app.get('/ok', (_req, res) => res.json({ ok: true }));
    const { server, port } = await listen(app);
    try {
      const res = await request(port, 'GET', '/ok');
      assert.equal(res.statusCode, 200);
      const missing = await request(port, 'GET', '/traceo/');
      assert.equal(missing.statusCode, 404);
    } finally {
      await closeServer(server);
    }
  } finally {
    if (previous === undefined) delete process.env.TRACEO_ENABLED;
    else process.env.TRACEO_ENABLED = previous;
  }
});

test('attachTraceo serves the dashboard under /traceo on the same Express app', async () => {
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
    payload: {
      requestId: 'req-1',
      request: { method: 'GET', url: '/orders' },
      response: { statusCode: 200, durationMs: 4 }
    }
  });

  const app = express();
  app.use(express.json());
  const attachment = attachTraceo(app, {
    enabled: true,
    path: '/traceo',
    storage: store,
    dashboard: true,
    dashboardDir: path.resolve(__dirname, '../apps/dashboard/public')
  });
  assert.equal(attachment.enabled, true);
  assert.equal(attachment.path, '/traceo');

  app.get('/api/ping', (_req, res) => res.json({ pong: true }));
  app.use(attachment.errorHandler);

  const { server, port } = await listen(app);
  try {
    const redirect = await request(port, 'GET', '/traceo');
    assert.equal(redirect.statusCode, 302);
    assert.equal(redirect.headers.location, '/traceo/');

    const ui = await request(port, 'GET', '/traceo/');
    assert.equal(ui.statusCode, 200);
    assert.match(ui.body, /Traceo/);
    assert.match(ui.body, /__TRACEO_BASE__/);
    assert.match(ui.body, /\/traceo/);

    const css = await request(port, 'GET', '/traceo/styles.css');
    assert.equal(css.statusCode, 200);

    const requests = await request(port, 'GET', '/traceo/requests');
    assert.equal(requests.statusCode, 200);
    const body = JSON.parse(requests.body);
    assert.equal(body.count, 1);
    assert.equal(body.requests[0].requestId, 'req-1');

    const api = await request(port, 'GET', '/api/ping');
    assert.equal(api.statusCode, 200);

    const listed = await request(port, 'GET', '/traceo/requests?search=ping');
    assert.equal(listed.statusCode, 200);
  } finally {
    await closeServer(server);
  }
});
