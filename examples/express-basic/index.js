'use strict';

const { join } = require('node:path');
const express = require('express');
const { createTraceoErrorHandler, createTraceoMiddleware } = require('@traceo/express');
const { createTraceoServer } = require('@traceo/server');
const { SqliteTraceStore } = require('@traceo/storage');

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the other process or set API_PORT / DASHBOARD_PORT.`));
        return;
      }
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.listen(port, host, onListening);
  });
}

async function main() {
  const store = new SqliteTraceStore(join(__dirname, 'traceo.sqlite'));
  const app = express();
  const apiPort = Number(process.env.API_PORT ?? 3000);
  const dashboardPort = Number(process.env.DASHBOARD_PORT ?? process.env.PORT ?? 3030);
  const host = process.env.TRACEO_HOST ?? '127.0.0.1';

  app.use(express.json());
  app.use(createTraceoMiddleware({
    sink: store,
    captureHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true
  }));

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

  app.use(createTraceoErrorHandler({ sink: store }));
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
  });

  const dashboard = createTraceoServer({
    storage: store,
    dashboard: true,
    dashboardDir: join(__dirname, '../../apps/dashboard/public')
  });

  await listen(app, apiPort, host);
  await listen(dashboard, dashboardPort, host);

  console.log(`Example API:      http://${host}:${apiPort}/orders`);
  console.log(`Traceo dashboard: http://${host}:${dashboardPort}/`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
