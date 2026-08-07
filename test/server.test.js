const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

let serverProcess;
let serverPort = 3031;

test.before(() => {
  serverProcess = spawn(process.execPath, [path.resolve(__dirname, '../packages/server/dist/index.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(serverPort), TRACEO_DATA_FILE: path.join(__dirname, 'tmp-server-events.json') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
});

test.after(() => {
  serverProcess.kill();
});

test('server exposes health and timeline endpoints', async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const health = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: serverPort, path: '/health' }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });

  assert.equal(health.statusCode, 200);
  assert.match(health.body, /"status":"ok"/);

  const timeline = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: serverPort, path: '/timeline/req-123' }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });

  assert.equal(timeline.statusCode, 200);
  assert.match(timeline.body, /"requestId":"req-123"/);
});
