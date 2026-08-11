const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

test('cli events command lists filtered events', () => {
  const dataFile = path.join(__dirname, 'tmp-cli-events.json');
  fs.writeFileSync(dataFile, JSON.stringify([
    { id: '1', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', source: 'express', payload: { requestId: 'req-1', method: 'GET', url: '/orders', statusCode: 200 } },
    { id: '2', type: 'request', timestamp: '2026-01-01T00:00:01.000Z', source: 'express', payload: { requestId: 'req-2', method: 'POST', url: '/billing', statusCode: 500 } }
  ]));

  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../packages/cli/dist/index.js'), 'events', '--method', 'GET', '--search', 'orders'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, TRACEO_DATA_FILE: dataFile },
    encoding: 'utf8'
  });

  fs.unlinkSync(dataFile);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[request\]/);
  assert.match(result.stdout, /orders/);
  assert.doesNotMatch(result.stdout, /billing/);
});
