import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { FileTraceStore } from '@traceo/storage';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dataFile = process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
const store = new FileTraceStore(dataFile);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing URL' }));
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/timeline/')) {
    const requestId = url.pathname.split('/').pop();
    const timeline = store.getTimeline(requestId ?? '');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ requestId, timeline }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const port = Number(process.env.PORT ?? 3030);
server.listen(port, () => {
  console.log(`Traceo server listening on http://localhost:${port}`);
});
