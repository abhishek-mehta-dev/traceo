import {
  createRequestCompletedEvent,
  createRequestStartedEvent,
  type TraceEventLike,
  type TraceHttpRequestMetadata,
  type TraceMetadata
} from '@traceo/core';

export interface TraceoNestOptions {
  sink: {
    capture(event: TraceEventLike): Promise<void>;
  };
  captureHeaders?: boolean;
  captureResponseBody?: boolean;
}

interface NestRequestLike {
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

interface NestResponseLike {
  statusCode?: number;
  send?: (body: unknown) => unknown;
  getHeaders?: () => Record<string, unknown>;
  on?(event: string, listener: () => void): unknown;
}

interface NestExecutionContextLike {
  getType?: () => string;
  getClass?: () => { name?: string };
  getHandler?: () => { name?: string };
  switchToHttp?: () => {
    getRequest: () => NestRequestLike;
    getResponse: () => NestResponseLike;
  };
}

interface NestCallHandlerLike {
  handle: () => {
    pipe: (operator: unknown) => unknown;
    subscribe?: (observer: { next?: (val: unknown) => void; error?: (err: unknown) => void; complete?: () => void }) => void;
  };
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

function getNestRoute(context: NestExecutionContextLike, req: NestRequestLike): string | undefined {
  const className = context.getClass?.()?.name;
  const handlerName = context.getHandler?.()?.name;
  if (className && handlerName) {
    return `${className}.${handlerName}`;
  }
  if (typeof req.route?.path === 'string') {
    return req.route.path;
  }
  return undefined;
}

function getRequestMetadata(
  context: NestExecutionContextLike,
  req: NestRequestLike,
  captureHeaders: boolean | undefined
): TraceHttpRequestMetadata {
  const headers = normalizeMetadata(captureHeaders ? req.headers : undefined);
  const userAgent = typeof headers['user-agent'] === 'string' ? headers['user-agent'] : undefined;

  return {
    method: req.method ?? 'GET',
    url: req.originalUrl ?? req.url ?? '/',
    route: getNestRoute(context, req),
    headers,
    query: normalizeMetadata(req.query),
    cookies: normalizeMetadata(req.cookies),
    ...(req.ip !== undefined ? { ip: req.ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {})
  };
}

export class TraceoInterceptor {
  constructor(private readonly options: TraceoNestOptions) {}

  public intercept(context: NestExecutionContextLike, next: NestCallHandlerLike): unknown {
    if (context.getType?.() !== 'http' || !context.switchToHttp) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const startedAt = Date.now();

    const startedEvent = createRequestStartedEvent({
      ...getRequestMetadata(context, req, this.options.captureHeaders),
      requestId: req.traceoRequestId,
      traceId: req.traceoTraceId
    });

    req.traceoRequestId = startedEvent.payload.requestId;
    req.traceoTraceId = startedEvent.payload.traceId;

    void this.options.sink.capture(startedEvent);

    const onComplete = (overrideStatus?: number) => {
      const completedAt = new Date();
      const durationMs = Date.now() - startedAt;
      const request = getRequestMetadata(context, req, this.options.captureHeaders);
      const completedEvent = createRequestCompletedEvent({
        traceId: startedEvent.payload.traceId,
        requestId: startedEvent.payload.requestId,
        request,
        response: {
          statusCode: overrideStatus ?? res.statusCode ?? 200,
          headers: normalizeMetadata(this.options.captureHeaders && typeof res.getHeaders === 'function' ? res.getHeaders() : undefined),
          durationMs: Number(durationMs.toFixed(3)),
          completedAt
        },
        timestamp: completedAt
      });

      void this.options.sink.capture(completedEvent);
    };

    if (typeof res.on === 'function') {
      res.on('finish', () => onComplete());
    }

    return next.handle();
  }
}
