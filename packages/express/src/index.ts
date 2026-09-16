import {
  createErrorEvent,
  createRequestCompletedEvent,
  createRequestStartedEvent,
  errorFromUnknown,
  type TraceCapturePolicy,
  type TraceoEventSink
} from '@traceo/core';

export interface TraceoExpressOptions {
  sink: TraceoEventSink;
  captureHeaders?: boolean;
  captureCookies?: boolean;
  captureQuery?: boolean;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  maxBodyBytes?: number;
  maskKeys?: string[];
}

export interface TraceoRequestLike {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  traceoRequestId?: string;
  traceoTraceId?: string;
  route?: { path?: unknown };
}

export interface TraceoResponseLike {
  statusCode?: number;
  send?: (body: unknown) => unknown;
  getHeaders?: () => Record<string, unknown>;
  on(event: 'finish' | 'error', listener: (...args: unknown[]) => void): unknown;
}

export type TraceoNextFunction = (error?: unknown) => void;

interface CollectedRequest {
  method: string;
  url: string;
  route?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  body?: unknown;
}

function capturePolicy(options: TraceoExpressOptions): TraceCapturePolicy {
  return {
    additionalMaskKeys: options.maskKeys,
    maxBodyBytes: options.maxBodyBytes
  };
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

function getRoute(req: TraceoRequestLike): string | undefined {
  if (typeof req.route?.path === 'string') {
    return req.route.path;
  }

  return undefined;
}

function getRequestMetadata(req: TraceoRequestLike, options: TraceoExpressOptions): CollectedRequest {
  const userAgent = headerValue(req.headers, 'user-agent');

  return {
    method: req.method ?? 'UNKNOWN',
    url: req.originalUrl ?? req.url ?? 'unknown',
    route: getRoute(req),
    headers: options.captureHeaders ? req.headers : undefined,
    query: options.captureQuery === false ? undefined : req.query,
    cookies: options.captureCookies ? req.cookies : undefined,
    ...(req.ip !== undefined ? { ip: req.ip } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(options.captureRequestBody ? { body: req.body } : {})
  };
}

function captureRequestError(options: TraceoExpressOptions, req: TraceoRequestLike, error: unknown, statusCode?: number): void {
  const details = errorFromUnknown(error);
  void options.sink.capture(createErrorEvent({
    ...details,
    requestId: req.traceoRequestId,
    traceId: req.traceoTraceId,
    statusCode,
    method: req.method,
    url: req.originalUrl ?? req.url
  }));
}

export function createTraceoMiddleware(options: TraceoExpressOptions) {
  const policy = capturePolicy(options);

  return (req: TraceoRequestLike, res: TraceoResponseLike, next: TraceoNextFunction) => {
    const startedAt = Date.now();
    const startedEvent = createRequestStartedEvent({
      ...getRequestMetadata(req, options),
      requestId: req.traceoRequestId,
      traceId: req.traceoTraceId
    }, policy);

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

    res.on('error', (error) => {
      captureRequestError(options, req, error, res.statusCode);
    });

    res.on('finish', () => {
      const completedAt = new Date();
      const durationMs = Date.now() - startedAt;
      const completedEvent = createRequestCompletedEvent({
        traceId: startedEvent.payload.traceId,
        requestId: startedEvent.payload.requestId,
        request: getRequestMetadata(req, options),
        response: {
          statusCode: res.statusCode ?? 0,
          headers: options.captureHeaders && typeof res.getHeaders === 'function' ? res.getHeaders() : undefined,
          durationMs: Number(durationMs.toFixed(3)),
          completedAt,
          body: options.captureResponseBody ? responseBody : undefined
        },
        timestamp: completedAt
      }, policy);

      responseBody = undefined;
      void options.sink.capture(completedEvent);
    });

    next();
  };
}

export function createTraceoErrorHandler(options: TraceoExpressOptions) {
  return (error: unknown, req: TraceoRequestLike, res: TraceoResponseLike, next: TraceoNextFunction) => {
    captureRequestError(options, req, error, res.statusCode && res.statusCode >= 400 ? res.statusCode : 500);
    next(error);
  };
}
