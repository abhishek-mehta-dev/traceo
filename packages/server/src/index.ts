import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { FileTraceStore, type TraceEventQuery } from '@traceo/storage';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dataFile = process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
const store = new FileTraceStore(dataFile);

function parseQuery(url: URL): TraceEventQuery {
  const statusCode = url.searchParams.get('statusCode');
  const limit = url.searchParams.get('limit');

  return {
    type: url.searchParams.get('type') ?? undefined,
    requestId: url.searchParams.get('requestId') ?? undefined,
    method: url.searchParams.get('method') ?? undefined,
    source: url.searchParams.get('source') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    statusCode: statusCode === null ? undefined : Number(statusCode),
    limit: limit === null ? undefined : Number(limit)
  };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const events = store.query(parseQuery(url));
    sendJson(res, 200, { events, count: events.length });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/timeline/')) {
    const requestId = url.pathname.split('/').pop();
    const timeline = store.getTimeline(requestId ?? '');
    sendJson(res, 200, { requestId, timeline });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const port = Number(process.env.PORT ?? 3030);
server.listen(port, () => {
  console.log(`Traceo server listening on http://localhost:${port}`);
});
