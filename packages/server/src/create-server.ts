import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { TraceEventLike, TraceEventQuery, TraceoStorage } from '@traceo/storage';

export interface TraceoBasicAuth {
  username: string;
  password: string;
}

export interface TraceoServerOptions {
  storage: TraceoStorage;
  dashboard?: boolean;
  dashboardDir?: string;
  basicAuth?: TraceoBasicAuth;
  apiKey?: string;
}

export interface TraceRequestSummary {
  requestId: string;
  method?: string;
  url?: string;
  statusCode?: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  errorCount: number;
  eventCount: number;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

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

function sendStorageFailure(res: ServerResponse): void {
  sendJson(res, 500, { error: 'Storage unavailable' });
}

export function isDashboardEnabled(options: Pick<TraceoServerOptions, 'dashboard'>): boolean {
  if (typeof options.dashboard === 'boolean') {
    return options.dashboard;
  }
  const flag = process.env.TRACEO_DASHBOARD?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function resolveDashboardDir(dashboardDir?: string): string {
  return dashboardDir ?? process.env.TRACEO_DASHBOARD_DIR ?? join(__dirname, '../../../apps/dashboard/public');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function readHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isAuthorized(req: IncomingMessage, options: TraceoServerOptions): boolean {
  if (!options.basicAuth && !options.apiKey) {
    return true;
  }

  const authorization = readHeader(req, 'authorization');
  if (options.apiKey) {
    const headerKey = readHeader(req, 'x-traceo-key');
    if (headerKey && timingSafeEqual(headerKey, options.apiKey)) {
      return true;
    }
    if (authorization?.startsWith('Bearer ') && timingSafeEqual(authorization.slice('Bearer '.length), options.apiKey)) {
      return true;
    }
  }

  if (options.basicAuth && authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator !== -1) {
      const username = decoded.slice(0, separator);
      const password = decoded.slice(separator + 1);
      if (timingSafeEqual(username, options.basicAuth.username) && timingSafeEqual(password, options.basicAuth.password)) {
        return true;
      }
    }
  }

  return false;
}

function sendUnauthorized(res: ServerResponse, options: TraceoServerOptions): void {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.basicAuth) {
    headers['WWW-Authenticate'] = 'Basic realm="Traceo"';
  }
  res.writeHead(401, headers);
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

export function isFaultSummary(request: TraceRequestSummary): boolean {
  return request.errorCount > 0 || (request.statusCode !== undefined && request.statusCode >= 500);
}

export function filterRequestSummaries(
  requests: TraceRequestSummary[],
  options: { statusFamily?: string; faults?: boolean } = {}
): TraceRequestSummary[] {
  return requests.filter((request) => {
    if (options.faults) return isFaultSummary(request);
    if (options.statusFamily) {
      return String(request.statusCode ?? '').startsWith(options.statusFamily);
    }
    return true;
  });
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (trimmed === '' || !/^[0-9]+$/.test(trimmed)) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  if (max !== undefined) return Math.min(parsed, max);
  return parsed;
}

export function paginateRequestSummaries(
  requests: TraceRequestSummary[],
  rawPage: string | null,
  rawPageSize: string | null
): {
  requests: TraceRequestSummary[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
} {
  const wantsPagination = (rawPage !== null && rawPage !== '') || (rawPageSize !== null && rawPageSize !== '');
  const pageSize = wantsPagination
    ? parsePositiveInt(rawPageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    : Math.max(requests.length, DEFAULT_PAGE_SIZE);
  const count = requests.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize) || 1);
  const requestedPage = parsePositiveInt(rawPage, 1);
  const page = count === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    requests: wantsPagination ? requests.slice(start, start + pageSize) : requests,
    count,
    page,
    pageSize: wantsPagination ? pageSize : (count === 0 ? DEFAULT_PAGE_SIZE : count),
    totalPages: wantsPagination ? totalPages : 1,
    hasPrev: wantsPagination && page > 1,
    hasNext: wantsPagination && page < totalPages && count > 0
  };
}

export function requestFacets(requests: TraceRequestSummary[]): Record<string, number> {
  return {
    '': requests.length,
    '2': requests.filter((item) => String(item.statusCode ?? '').startsWith('2')).length,
    '4': requests.filter((item) => String(item.statusCode ?? '').startsWith('4')).length,
    '5': requests.filter((item) => String(item.statusCode ?? '').startsWith('5')).length,
    errors: requests.filter(isFaultSummary).length
  };
}

export function summarizeRequests(events: TraceEventLike[]): TraceRequestSummary[] {
  const summaries = new Map<string, TraceRequestSummary>();

  for (const event of events) {
    const requestId = typeof event.payload.requestId === 'string'
      ? event.payload.requestId
      : typeof event.payload.traceId === 'string'
        ? event.payload.traceId
        : event.id;
    const request = event.payload.request as { method?: string; url?: string } | undefined;
    const response = event.payload.response as { statusCode?: number; durationMs?: number; completedAt?: string } | undefined;
    const current = summaries.get(requestId) ?? {
      requestId,
      errorCount: 0,
      eventCount: 0
    };

    current.eventCount += 1;
    current.method = current.method ?? (typeof event.payload.method === 'string' ? event.payload.method : request?.method);
    current.url = current.url ?? (typeof event.payload.url === 'string' ? event.payload.url : request?.url);
    if (current.startedAt === undefined || event.timestamp < current.startedAt) {
      current.startedAt = event.timestamp;
    }
    if (response?.statusCode !== undefined) {
      current.statusCode = response.statusCode;
    } else if (typeof event.payload.statusCode === 'number') {
      current.statusCode = event.payload.statusCode;
    }
    if (response?.durationMs !== undefined) {
      current.durationMs = response.durationMs;
    }
    if (response?.completedAt !== undefined) {
      current.completedAt = response.completedAt;
    }
    if (event.type === 'error') {
      current.errorCount += 1;
    }
    summaries.set(requestId, current);
  }

  return [...summaries.values()].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}

function safeDashboardFile(dashboardDir: string, urlPath: string): string | null {
  const relative = urlPath === '/' || urlPath === '/dashboard' || urlPath === '/dashboard/'
    ? 'index.html'
    : urlPath.replace(/^\/dashboard\//, '').replace(/^\//, '');
  const resolved = resolve(dashboardDir, normalize(relative));
  const root = resolve(dashboardDir) + sep;
  if (!resolved.startsWith(root) && resolved !== resolve(dashboardDir)) {
    return null;
  }
  return resolved;
}

function serveDashboard(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  const content = readFileSync(filePath);
  const headers: Record<string, string> = {
    'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream'
  };
  if (/\.(svg|png|ico)$/.test(filePath)) {
    headers['Cache-Control'] = 'public, max-age=86400';
  }
  res.writeHead(200, headers);
  res.end(content);
  return true;
}

export function createTraceoServer(options: TraceoServerOptions): Server {
  const { storage } = options;
  const dashboardEnabled = isDashboardEnabled(options);
  const dashboardDir = resolveDashboardDir(options.dashboardDir);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      sendJson(res, 400, { error: 'Missing URL' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return;
      }

      if (!isAuthorized(req, options)) {
        sendUnauthorized(res, options);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/events') {
        const events = await storage.query(parseQuery(url));
        sendJson(res, 200, { events, count: events.length });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/errors') {
        const events = await storage.query({ ...parseQuery(url), type: 'error' });
        sendJson(res, 200, { events, count: events.length });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/requests') {
        const query = parseQuery(url);
        delete query.limit;
        const events = await storage.query(query);
        const all = summarizeRequests(events);
        const statusFamily = url.searchParams.get('statusFamily')?.trim() ?? '';
        const faults = url.searchParams.get('faults') === '1' || url.searchParams.get('faults') === 'true';
        const filtered = filterRequestSummaries(all, {
          statusFamily: /^[2-5]$/.test(statusFamily) ? statusFamily : undefined,
          faults
        });
        const page = paginateRequestSummaries(
          filtered,
          url.searchParams.get('page'),
          url.searchParams.get('pageSize')
        );
        sendJson(res, 200, {
          ...page,
          facets: requestFacets(all)
        });
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/timeline/')) {
        const requestId = url.pathname.split('/').pop() ?? '';
        const timeline = await storage.getTimeline(requestId);
        sendJson(res, 200, { requestId, timeline });
        return;
      }

      if (req.method === 'GET' && dashboardEnabled) {
        const filePath = safeDashboardFile(dashboardDir, url.pathname);
        if (filePath && serveDashboard(res, filePath)) {
          return;
        }
        if (url.pathname === '/' || url.pathname.startsWith('/dashboard')) {
          sendJson(res, 404, { error: 'Dashboard not found' });
          return;
        }
      }

      if (req.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/dashboard'))) {
        sendJson(res, 404, { error: 'Dashboard disabled' });
        return;
      }
    } catch {
      sendStorageFailure(res);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });
}
