const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { TraceoCore, createRequestEvent } = require(path.resolve(__dirname, '../packages/core/dist/index.js'));

test('captures request events through the core pipeline', async () => {
  const captured = [];
  const sink = {
    async capture(event) {
      captured.push(event);
    }
  };

  const core = new TraceoCore(sink, { enabled: true, environment: 'test' });
  const event = createRequestEvent({
    method: 'GET',
    url: '/health',
    statusCode: 200,
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  await core.capture(event);

  assert.equal(captured.length, 1);
  assert.equal(captured[0].type, 'request');
  assert.equal(captured[0].payload.url, '/health');
  assert.equal(captured[0].payload.statusCode, 200);
});
