import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { FileTraceStore } from '@traceo/storage';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RequestService } from './service';
import type { TraceoErrorResponse, TraceoServerConfig, TraceoStorageLike } from './types';

export interface TraceoServerInstance {
  server: Server;
  listen(port?: number, host?: string): Server;
  close(): Promise<void>;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parsePage(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseSort(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  return raw.trim();
}

function parseOrder(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  return raw.trim().toUpperCase();
}

function parseQuery(url: URL): Record<string, string | undefined> {
  return {
    page: url.searchParams.get('page') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    order: url.searchParams.get('order') ?? undefined,
    method: url.searchParams.get('method') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    eventType: url.searchParams.get('eventType') ?? undefined,
    traceId: url.searchParams.get('traceId') ?? undefined,
    requestId: url.searchParams.get('requestId') ?? undefined
  };
}

function safeError(message: string, details?: string): TraceoErrorResponse {
  return details ? { error: message, details } : { error: message };
}

export function createTraceoServer(config: TraceoServerConfig): TraceoServerInstance {
  const service = new RequestService(config.storage);
  const host = config.host ?? '127.0.0.1';
  const port = config.port ?? 3030;
  const basePath = config.basePath ?? '';
  const corsOrigin = config.corsOrigin;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      sendJson(res, 400, safeError('Missing URL'));
      return;
    }

    const url = new URL(req.url, `http://${host}:${port}`);
    const pathname = url.pathname.replace(new RegExp(`^${basePath}`), '');

    if (corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'GET' && pathname === '/events') {
      try {
        const query = parseQuery(url);
        const response = await service.list({
          page: parsePage(query.page),
          limit: parseLimit(query.limit),
          sort: parseSort(query.sort),
          order: parseOrder(query.order),
          method: query.method,
          status: query.status,
          eventType: query.eventType,
          traceId: query.traceId,
          requestId: query.requestId
        });
        sendJson(res, 200, { events: response.data, count: response.pagination.total });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid request';
        const statusCode = message === 'invalid page' || message === 'invalid limit' || message === 'invalid sort' ? 400 : 500;
        sendJson(res, statusCode, safeError('Invalid request', message));
      }
      return;
    }

    if (req.method === 'GET' && pathname === '/requests') {
      try {
        const query = parseQuery(url);
        const response = await service.list({
          page: parsePage(query.page),
          limit: parseLimit(query.limit),
          sort: parseSort(query.sort),
          order: parseOrder(query.order),
          method: query.method,
          status: query.status,
          eventType: query.eventType,
          traceId: query.traceId,
          requestId: query.requestId
        });
        sendJson(res, 200, response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid request';
        const statusCode = message === 'invalid page' || message === 'invalid limit' || message === 'invalid sort' ? 400 : 500;
        sendJson(res, statusCode, safeError('Invalid request', message));
      }
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/requests/')) {
      const segments = pathname.split('/').filter(Boolean);
      const id = segments[1];
      const action = segments[2];

      if (segments.length === 2 && id) {
        try {
          const detail = await service.getById(id);
          if (!detail) {
            sendJson(res, 404, safeError('Request not found'));
            return;
          }
          sendJson(res, 200, detail);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'storage failure';
          sendJson(res, 500, safeError('Storage failure', message));
        }
        return;
      }

      if (segments.length === 3 && segments[0] === 'requests' && action === 'timeline' && id) {
        try {
          const timelineResponse = await service.getTimeline(id);
          sendJson(res, 200, timelineResponse);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'storage failure';
          sendJson(res, 500, safeError('Storage failure', message));
        }
        return;
      }
    }

    if (req.method === 'GET' && pathname.startsWith('/timeline/')) {
      const requestId = pathname.split('/').filter(Boolean).pop();
      if (requestId) {
        try {
          const events = (await (config.storage as TraceoStorageLike).query({ requestId })) as Array<Record<string, unknown>>;
          sendJson(res, 200, { requestId, timeline: events.map((event) => event) });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'storage failure';
          sendJson(res, 500, safeError('Storage failure', message));
        }
        return;
      }
    }

    sendJson(res, 404, safeError('Not found'));
  });

  return {
    server,
    listen: (port?: number, host?: string) => server.listen(port, host),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

export function createDefaultTraceoServer(storage: TraceoStorageLike): TraceoServerInstance {
  return createTraceoServer({ storage });
}

export function startTraceoServer(config: TraceoServerConfig): TraceoServerInstance {
  const instance = createTraceoServer(config);
  instance.listen(config.port ?? 3030, config.host ?? '127.0.0.1');
  return instance;
}

if (require.main === module) {
  const dataFile = process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
  const storage = new FileTraceStore(dataFile);
  startTraceoServer({ storage, host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3030) });
}
