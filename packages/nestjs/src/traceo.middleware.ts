import {
  createRequestCompletedEvent,
  createRequestStartedEvent,
  type TraceEventLike,
  type TraceHttpRequestMetadata,
  type TraceMetadata
} from '@traceo/core';
import type { TraceoNestOptions } from './traceo.interceptor';

interface NestReqLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  ip?: string;
  traceoRequestId?: string;
  traceoTraceId?: string;
  route?: { path?: unknown };
}

interface NestResLike {
  statusCode?: number;
  getHeaders?: () => Record<string, unknown>;
  on?(event: 'finish', listener: () => void): unknown;
}

function normalizeMetadata(metadata: Record<string, unknown> | undefined): TraceMetadata {
  const normalized: TraceMetadata = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined) continue;
    const normalizedKey = key.toLowerCase();
    if (Array.isArray(value)) {
      normalized[normalizedKey] = value.map((item) => String(item));
    } else if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalized[normalizedKey] = value;
    } else {
      normalized[normalizedKey] = String(value);
    }
  }
  return normalized;
}

function getRequestMetadata(req: NestReqLike, captureHeaders: boolean | undefined): TraceHttpRequestMetadata {
  const headers = normalizeMetadata(captureHeaders ? req.headers : undefined);
  const userAgent = typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;

  return {
    method: req.method ?? 'GET',
    url: req.originalUrl ?? req.url ?? '/',
    headers,
    query: normalizeMetadata(req.query),
    cookies: normalizeMetadata(req.cookies),
    ...(req.ip !== undefined ? { ip: req.ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {})
  };
}

export function createTraceoNestMiddleware(options: TraceoNestOptions) {
  return (req: NestReqLike, res: NestResLike, next: () => void) => {
    const startedAt = Date.now();
    const startedEvent = createRequestStartedEvent({
      ...getRequestMetadata(req, options.captureHeaders),
      requestId: req.traceoRequestId,
      traceId: req.traceoTraceId
    });

    req.traceoRequestId = startedEvent.payload.requestId;
    req.traceoTraceId = startedEvent.payload.traceId;

    void options.sink.capture(startedEvent);

    if (typeof res.on === 'function') {
      res.on('finish', () => {
        const completedAt = new Date();
        const durationMs = Date.now() - startedAt;
        const request = getRequestMetadata(req, options.captureHeaders);
        const completedEvent = createRequestCompletedEvent({
          traceId: startedEvent.payload.traceId,
          requestId: startedEvent.payload.requestId,
          request,
          response: {
            statusCode: res.statusCode ?? 200,
            headers: normalizeMetadata(options.captureHeaders && typeof res.getHeaders === 'function' ? res.getHeaders() : undefined),
            durationMs: Number(durationMs.toFixed(3)),
            completedAt
          },
          timestamp: completedAt
        });

        void options.sink.capture(completedEvent);
      });
    }

    next();
  };
}
