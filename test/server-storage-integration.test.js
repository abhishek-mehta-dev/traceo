const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/create-server.js'));
const { FileTraceStore, InMemoryTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: urlPath }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
      });
    }).on('error', reject);
  });
}

const sampleEvent = {
  id: '1',
  type: 'request',
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'express',
  payload: { requestId: 'req-123', method: 'GET', url: '/orders', statusCode: 200 }
};

async function assertServerReadsStore(storage) {
  await storage.capture(sampleEvent);
  const server = createTraceoServer({ storage });
  const port = await listen(server);

  try {
    const health = await getJson(port, '/health');
    assert.equal(health.statusCode, 200);
    assert.equal(health.body.status, 'ok');

    const timeline = await getJson(port, '/timeline/req-123');
    assert.equal(timeline.statusCode, 200);
    assert.equal(timeline.body.requestId, 'req-123');
    assert.equal(timeline.body.timeline.length, 1);

    const events = await getJson(port, '/events?search=orders&method=GET&statusCode=200');
    assert.equal(events.statusCode, 200);
    assert.equal(events.body.count, 1);
  } finally {
    await closeServer(server);
  }
}

test('server serves events from injected in-memory storage', async () => {
  await assertServerReadsStore(new InMemoryTraceStore());
});

test('server serves events from injected JSON file storage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-server-storage-'));
  const store = new FileTraceStore(path.join(dir, 'events.json'));
  try {
    await assertServerReadsStore(store);
  } finally {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
