import {
  createRequestCompletedEvent,
  createRequestStartedEvent,
  type TraceEventLike,
  type TraceHttpRequestMetadata,
  type TraceMetadata
} from '@traceo/core';

export interface TraceoExpressOptions {
  sink: {
    capture(event: TraceEventLike): Promise<void>;
  };
  captureHeaders?: boolean;
  captureResponseBody?: boolean;
}

interface TraceoRequestLike {
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

interface TraceoResponseLike {
  statusCode?: number;
  send?: (body: unknown) => unknown;
  getHeaders?: () => Record<string, unknown>;
  on(event: 'finish', listener: () => void): unknown;
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

function getRoute(req: TraceoRequestLike): string | undefined {
  if (typeof req.route?.path === 'string') {
    return req.route.path;
  }

  return undefined;
}

function getRequestMetadata(req: TraceoRequestLike, captureHeaders: boolean | undefined): TraceHttpRequestMetadata {
  const headers = normalizeMetadata(captureHeaders ? req.headers : undefined);
  const userAgent = typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;

  return {
    method: req.method ?? 'UNKNOWN',
    url: req.originalUrl ?? req.url ?? 'unknown',
    route: getRoute(req),
    headers,
    query: normalizeMetadata(req.query),
    cookies: normalizeMetadata(req.cookies),
    ...(req.ip !== undefined ? { ip: req.ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {})
  };
}

function estimatePayloadSize(body: unknown): number | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body.length;
  }

  if (body instanceof Uint8Array) {
    return body.byteLength;
  }

  return JSON.stringify(body).length;
}

export function createTraceoMiddleware(options: TraceoExpressOptions) {
  return (req: TraceoRequestLike, res: TraceoResponseLike, next: () => void) => {
    const startedAt = Date.now();
    const startedEvent = createRequestStartedEvent({
      ...getRequestMetadata(req, options.captureHeaders),
      requestId: req.traceoRequestId,
      traceId: req.traceoTraceId
    });

    req.traceoRequestId = startedEvent.payload.requestId;
    req.traceoTraceId = startedEvent.payload.traceId;

    let responseBody: unknown;
    const originalSend = typeof res.send === 'function' ? res.send.bind(res) : undefined;
    if (originalSend && options.captureResponseBody) {
      res.send = (body: unknown) => {
        responseBody = body;
        return originalSend(body);
      };
    }

    void options.sink.capture(startedEvent);

    res.on('finish', () => {
      const completedAt = new Date();
      const durationMs = Date.now() - startedAt;
      const request = getRequestMetadata(req, options.captureHeaders);
      const completedEvent = createRequestCompletedEvent({
        traceId: startedEvent.payload.traceId,
        requestId: startedEvent.payload.requestId,
        request,
        response: {
          statusCode: res.statusCode ?? 0,
          headers: normalizeMetadata(options.captureHeaders && typeof res.getHeaders === 'function' ? res.getHeaders() : undefined),
          durationMs: Number(durationMs.toFixed(3)),
          completedAt,
          payloadSizeBytes: options.captureResponseBody ? estimatePayloadSize(responseBody) : undefined
        },
        timestamp: completedAt
      });

      void options.sink.capture(completedEvent);
    });

    next();
  };
}
