const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

let serverProcess;
let serverPort = 3031;

test.before(() => {
  const dataFile = path.join(__dirname, 'tmp-server-events.json');
  fs.writeFileSync(dataFile, JSON.stringify([{ id: '1', type: 'request', timestamp: '2026-01-01T00:00:00.000Z', source: 'express', payload: { requestId: 'req-123', method: 'GET', url: '/orders', statusCode: 200 } }]));
  serverProcess = spawn(process.execPath, [path.resolve(__dirname, '../packages/server/dist/index.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(serverPort), TRACEO_DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
});

test.after(() => {
  serverProcess.kill();
});

test('server exposes health and timeline endpoints', async () => {
  // Retry helper to wait for spawned server process to bind port
  let health;
  for (let i = 0; i < 20; i++) {
    try {
      health = await new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port: serverPort, path: '/health' }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  assert.ok(health, 'Server did not respond to /health within retry window');

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

  const events = await new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: serverPort, path: '/events?search=orders&method=GET&statusCode=200' }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });

  assert.equal(events.statusCode, 200);
  assert.match(events.body, /"count":1/);
});
