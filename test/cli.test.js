const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('cli timeline command reports request events', () => {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../packages/cli/dist/index.js'), 'timeline', 'req-123'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /No events found for request req-123/);
});
