const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { FileTraceStore } = require(path.resolve(__dirname, '../packages/storage/dist/file-store.js'));

test('persists and retrieves events from disk', async () => {
  const filePath = path.join(__dirname, 'tmp-events.json');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const store = new FileTraceStore(filePath);
  await store.capture({
    id: '1',
    type: 'request',
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'express',
    payload: { requestId: 'req-123', method: 'GET', url: '/health' }
  });

  const timeline = store.getTimeline('req-123');
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].payload.requestId, 'req-123');
});
