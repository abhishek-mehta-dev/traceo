const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const http = require('node:http');

const { createTraceoMiddleware } = require(path.resolve(__dirname, '../packages/express/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-e2e-'));
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

test('complete vertical flow: Express middleware -> SQLite storage -> Traceo Server API', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const middleware = createTraceoMiddleware({
    sink: store,
    captureResponseBody: true
  });

  const req = { method: 'GET', url: '/health-check', headers: { 'user-agent': 'traceo-test' }, originalUrl: '/health-check' };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.send = (body) => body;
  res.getHeaders = () => ({ 'content-type': 'application/json' });

  middleware(req, res, () => {
    res.send(JSON.stringify({ status: 'healthy' }));
    res.emit('finish');
  });

  await new Promise((resolve) => setImmediate(resolve));

  const server = createTraceoServer({ storage: store, port: 0 });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  try {
    const listResponse = await requestJson(server, '/requests?method=GET&status=200');
    assert.equal(listResponse.statusCode, 200);
    assert.ok(listResponse.body.data.length >= 1);

    const summary = listResponse.body.data.find((e) => e.url === '/health-check');
    assert.ok(summary);
    assert.equal(summary.method, 'GET');
    assert.equal(summary.statusCode, 200);

    const detailResponse = await requestJson(server, `/requests/${summary.id}`);
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.body.id, summary.id);
    assert.equal(detailResponse.body.method, 'GET');

    const timelineResponse = await requestJson(server, `/requests/${summary.traceId}/timeline`);
    assert.equal(timelineResponse.statusCode, 200);
    assert.equal(timelineResponse.body.traceId, summary.traceId);
    assert.ok(timelineResponse.body.events.length >= 1);
  } finally {
    await server.close();
    await store.close();
  }
});
