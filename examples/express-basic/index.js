'use strict';

const { join } = require('node:path');
const express = require('express');
const { attachTraceo } = require('@traceojs/express');
const { SqliteTraceStore } = require('@traceojs/storage');

async function main() {
  process.env.TRACEO_ENABLED = process.env.TRACEO_ENABLED || 'true';

  const app = express();
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  const host = process.env.TRACEO_HOST ?? '127.0.0.1';
  const store = new SqliteTraceStore(join(__dirname, 'traceo.sqlite'));

  app.use(express.json());
  const traceo = attachTraceo(app, {
    enabled: true,
    storage: store,
    path: process.env.TRACEO_PATH || '/traceo',
    captureHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/orders', (_req, res) => {
    res.status(200).json({ orders: [{ id: 'ord-1' }] });
  });

  app.post('/orders', (req, res) => {
    res.status(201).json({ id: 'ord-2', item: req.body?.item ?? 'demo' });
  });

  app.get('/fail', (_req, _res, next) => {
    next(new Error('payment provider unavailable'));
  });

  app.use(traceo.errorHandler);
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
  });

  await new Promise((resolve, reject) => {
    const server = app.listen(port, host, resolve);
    server.once('error', reject);
  });

  console.log(`Example API:      http://${host}:${port}/orders`);
  console.log(`Traceo dashboard: http://${host}:${port}${traceo.path}/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
