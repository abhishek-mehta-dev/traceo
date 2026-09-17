import {
  createErrorEvent,
  createRequestCompletedEvent,
  createRequestStartedEvent,
  errorFromUnknown,
  type TraceCapturePolicy,
  type TraceoEventSink
} from '@traceojs/core';
import {
  createTraceoMount,
  normalizeBasePath,
  type TraceoBasicAuth,
  type TraceoServerOptions
} from '@traceojs/server';
import { createTraceoStoreFromEnv, type TraceoStorage } from '@traceojs/storage';

export interface TraceoExpressOptions {
  sink: TraceoEventSink;
  captureHeaders?: boolean;
  captureCookies?: boolean;
  captureQuery?: boolean;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  maxBodyBytes?: number;
  maskKeys?: string[];
  /** Skip capture for URLs under this prefix (dashboard traffic). */
  skipPathPrefix?: string;
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

export interface TraceoAttachOptions {
  enabled?: boolean;
  path?: string;
  storage?: TraceoStorage;
  dashboard?: boolean;
  dashboardDir?: string;
  basicAuth?: TraceoBasicAuth;
  apiKey?: string;
  captureHeaders?: boolean;
  captureCookies?: boolean;
  captureQuery?: boolean;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
  maxBodyBytes?: number;
  maskKeys?: string[];
}

export interface TraceoAttachment {
  enabled: boolean;
  path: string;
  storage: TraceoStorage | null;
  errorHandler: (error: unknown, req: TraceoRequestLike, res: TraceoResponseLike, next: TraceoNextFunction) => void;
}

interface ExpressLike {
  use: (...args: unknown[]) => unknown;
}

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

function shouldSkipCapture(req: TraceoRequestLike, skipPathPrefix?: string): boolean {
  if (!skipPathPrefix) {
    return false;
  }
  const path = req.originalUrl ?? req.url ?? '';
  return path === skipPathPrefix || path.startsWith(`${skipPathPrefix}/`) || path.startsWith(`${skipPathPrefix}?`);
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
    if (shouldSkipCapture(req, options.skipPathPrefix)) {
      next();
      return;
    }

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
    if (!shouldSkipCapture(req, options.skipPathPrefix)) {
      captureRequestError(options, req, error, res.statusCode && res.statusCode >= 400 ? res.statusCode : undefined);
    }
    next(error);
  };
}

export function isTraceoEnabled(flag = process.env.TRACEO_ENABLED): boolean {
  const value = flag?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

function resolveBasicAuthFromEnv(): TraceoBasicAuth | undefined {
  const value = process.env.TRACEO_BASIC_AUTH;
  if (!value) {
    return undefined;
  }
  const separator = value.indexOf(':');
  if (separator === -1) {
    return undefined;
  }
  return {
    username: value.slice(0, separator),
    password: value.slice(separator + 1)
  };
}

function resolveAttachPath(path?: string): string {
  return normalizeBasePath(path ?? process.env.TRACEO_PATH ?? '/traceo') || '/traceo';
}

/**
 * Wire Traceo into an Express app with minimal boilerplate.
 *
 * When `TRACEO_ENABLED=1|true` (or `options.enabled`):
 * - captures requests/responses
 * - serves the dashboard + API under `/traceo` (or `TRACEO_PATH`) on the same server
 *
 * Place after body parsers. Mount `attachment.errorHandler` before your final error handler.
 *
 * @example
 * ```js
 * app.use(express.json());
 * const traceo = attachTraceo(app);
 * // ... routes ...
 * app.use(traceo.errorHandler);
 * app.use(yourErrorHandler);
 * ```
 */
export function attachTraceo(app: ExpressLike, options: TraceoAttachOptions = {}): TraceoAttachment {
  const enabled = options.enabled ?? isTraceoEnabled();
  const path = resolveAttachPath(options.path);
  const noopErrorHandler = (error: unknown, _req: TraceoRequestLike, _res: TraceoResponseLike, next: TraceoNextFunction) => {
    next(error);
  };

  if (!enabled) {
    return {
      enabled: false,
      path,
      storage: null,
      errorHandler: noopErrorHandler
    };
  }

  const storage = options.storage ?? createTraceoStoreFromEnv();
  const captureOptions: TraceoExpressOptions = {
    sink: storage,
    captureHeaders: options.captureHeaders ?? true,
    captureCookies: options.captureCookies ?? true,
    captureQuery: options.captureQuery,
    captureRequestBody: options.captureRequestBody ?? true,
    captureResponseBody: options.captureResponseBody ?? true,
    maxBodyBytes: options.maxBodyBytes,
    maskKeys: options.maskKeys,
    skipPathPrefix: path
  };

  app.use(createTraceoMiddleware(captureOptions));

  const mountOptions: TraceoServerOptions = {
    storage,
    dashboard: options.dashboard ?? true,
    dashboardDir: options.dashboardDir,
    basicAuth: options.basicAuth ?? resolveBasicAuthFromEnv(),
    apiKey: options.apiKey ?? process.env.TRACEO_API_KEY ?? undefined,
    basePath: path
  };
  app.use(path, createTraceoMount(mountOptions));

  return {
    enabled: true,
    path,
    storage,
    errorHandler: createTraceoErrorHandler(captureOptions)
  };
}
