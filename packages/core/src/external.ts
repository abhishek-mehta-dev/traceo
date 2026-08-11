import type { TraceMetadata } from './http';

export interface TraceExternalApiContext {
  url: string;
  method?: string;
  hostname?: string;
  statusCode?: number;
  durationMs?: number;
  success?: boolean;
  error?: string;
  requestHeaders?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
}

export interface TraceoFetchOptions {
  sink: { capture(event: unknown): Promise<void> };
  fetchImpl?: typeof fetch;
  captureHeaders?: boolean;
}

const SENSITIVE_HEADER_PATTERN = /authorization|api-key|cookie|set-cookie|x-api-key|secret|token|credential/i;

function extractHostname(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

function sanitizeHeaders(headers?: Record<string, unknown>): TraceMetadata {
  if (!headers) return {};
  const clean: TraceMetadata = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    if (SENSITIVE_HEADER_PATTERN.test(k)) {
      clean[k.toLowerCase()] = '[REDACTED]';
    } else if (Array.isArray(v)) {
      clean[k.toLowerCase()] = v.map((item) => String(item));
    } else {
      clean[k.toLowerCase()] = String(v);
    }
  }
  return clean;
}

export function createExternalApiEvent(context: TraceExternalApiContext) {
  const now = Date.now();
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  const hostname = context.hostname ?? extractHostname(context.url);
  const method = (context.method ?? 'GET').toUpperCase();
  const statusCode = context.statusCode ?? (context.error ? 500 : 200);

  return {
    id: `ext_${now}_${randomSuffix}`,
    type: 'EXTERNAL_API',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      url: context.url,
      hostname,
      method,
      statusCode,
      durationMs: context.durationMs ?? 0,
      success: context.success ?? (statusCode < 400 && !context.error),
      error: context.error ?? null,
      requestHeaders: sanitizeHeaders(context.requestHeaders),
      responseHeaders: sanitizeHeaders(context.responseHeaders),
      requestId: context.requestId ?? null,
      traceId: context.traceId ?? context.requestId ?? null
    }
  };
}

export function createTraceoFetch(options: TraceoFetchOptions): typeof fetch {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return async (input: string | URL | { url: string; method?: string }, init?: RequestInit): Promise<Response> => {
    const startedAt = Date.now();
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET');

    let requestHeaders: Record<string, unknown> | undefined;
    if (options.captureHeaders && init?.headers) {
      if (init.headers instanceof Headers) {
        requestHeaders = Object.fromEntries(init.headers.entries());
      } else if (Array.isArray(init.headers)) {
        requestHeaders = Object.fromEntries(init.headers);
      } else {
        requestHeaders = init.headers as Record<string, unknown>;
      }
    }

    try {
      const response = await fetchImpl(input as any, init);
      const durationMs = Date.now() - startedAt;

      let responseHeaders: Record<string, unknown> | undefined;
      if (options.captureHeaders && response.headers) {
        responseHeaders = Object.fromEntries(response.headers.entries());
      }

      const event = createExternalApiEvent({
        url: urlStr,
        method,
        statusCode: response.status,
        durationMs,
        success: response.ok,
        requestHeaders,
        responseHeaders
      });

      void options.sink.capture(event);
      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      const event = createExternalApiEvent({
        url: urlStr,
        method,
        statusCode: 0,
        durationMs,
        success: false,
        error: errorMessage,
        requestHeaders
      });

      void options.sink.capture(event);
      throw err;
    }
  };
}
