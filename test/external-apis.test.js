const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createExternalApiEvent, createTraceoFetch } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-ext-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('external-apis: createExternalApiEvent extracts hostname and redacts sensitive headers', () => {
  const event = createExternalApiEvent({
    url: 'https://api.stripe.com/v1/charges',
    method: 'POST',
    statusCode: 200,
    durationMs: 145.2,
    requestHeaders: {
      Authorization: 'Bearer sk_test_12345',
      'Content-Type': 'application/json'
    },
    requestId: 'req-ext-1',
    traceId: 'trace-ext-1'
  });

  assert.equal(event.type, 'EXTERNAL_API');
  assert.equal(event.payload.hostname, 'api.stripe.com');
  assert.equal(event.payload.method, 'POST');
  assert.equal(event.payload.statusCode, 200);
  assert.equal(event.payload.durationMs, 145.2);
  assert.equal(event.payload.requestHeaders.authorization, '[REDACTED]');
  assert.equal(event.payload.requestHeaders['content-type'], 'application/json');
});

test('external-apis: createTraceoFetch wraps fetch call and emits EXTERNAL_API event', async () => {
  const captured = [];
  const dummySink = {
    async capture(evt) {
      captured.push(evt);
    }
  };

  const mockFetch = async () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  const traceoFetch = createTraceoFetch({ sink: dummySink, fetchImpl: mockFetch, captureHeaders: true });

  const res = await traceoFetch('https://api.github.com/users/octocat', {
    headers: { authorization: 'token ghp_secret123' }
  });

  assert.equal(res.status, 200);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'EXTERNAL_API');
  assert.equal(captured[0].payload.hostname, 'api.github.com');
  assert.equal(captured[0].payload.requestHeaders.authorization, '[REDACTED]');
});

test('external-apis: Server API and Dashboard SDK list and retrieve external API events', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const extEvent = createExternalApiEvent({
    url: 'https://api.twilio.com/2010-04-01/Accounts.json',
    method: 'GET',
    statusCode: 200,
    durationMs: 88.5,
    requestId: 'req-tw-1',
    traceId: 'trace-tw-1'
  });

  await store.capture(extEvent);

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'ext-test-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'ext-test-key' });

  try {
    const list = await client.getExternalApis();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].hostname, 'api.twilio.com');
    assert.equal(list.data[0].url, 'https://api.twilio.com/2010-04-01/Accounts.json');

    const detail = await client.getExternalApiById(list.data[0].id);
    assert.equal(detail.id, list.data[0].id);
    assert.equal(detail.durationMs, 88.5);
  } finally {
    await server.close();
    await store.close();
  }
});
