const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCustomEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));
const { SQLiteTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/index.js'));
const { createTraceoServer } = require(path.resolve(__dirname, '../packages/server/dist/index.js'));
const { createTraceoClient } = require(path.resolve(__dirname, '../packages/dashboard-sdk/dist/index.js'));

function createTempDatabasePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceo-custom-test-'));
  return path.join(dir, 'traceo.sqlite');
}

test('custom-events: createCustomEvent generates canonical event structure', () => {
  const event = createCustomEvent({
    name: 'order_checkout',
    category: 'e_commerce',
    payload: { cartTotal: 199.99, itemCount: 3 },
    requestId: 'req-cust-1',
    traceId: 'trace-cust-1'
  });

  assert.equal(event.type, 'CUSTOM');
  assert.equal(event.payload.name, 'order_checkout');
  assert.equal(event.payload.category, 'e_commerce');
  assert.equal(event.payload.customPayload.cartTotal, 199.99);
  assert.equal(event.payload.requestId, 'req-cust-1');
});

test('custom-events: Server Ingestion POST /events and SDK sendCustomEvent persist custom events', async () => {
  const dbPath = createTempDatabasePath();
  const store = new SQLiteTraceStore(dbPath);
  await store.initialize();

  const server = createTraceoServer({ storage: store, port: 0, apiKey: 'cust-test-key' });
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1');
    server.server.once('listening', resolve);
  });

  const port = server.server.address().port;
  const client = createTraceoClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'cust-test-key' });

  try {
    const res = await client.sendCustomEvent({
      name: 'user_subscribed',
      category: 'billing',
      payload: { plan: 'pro_monthly' }
    });

    assert.equal(res.success, true);
    assert.ok(res.id);

    const list = await client.getCustomEvents();
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].name, 'user_subscribed');
    assert.equal(list.data[0].category, 'billing');

    const detail = await client.getCustomEventById(list.data[0].id);
    assert.equal(detail.id, list.data[0].id);
    assert.equal(detail.customPayload.plan, 'pro_monthly');
  } finally {
    await server.close();
    await store.close();
  }
});
