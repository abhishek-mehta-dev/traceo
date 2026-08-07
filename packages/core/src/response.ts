export interface TraceResponseContext {
  requestId: string;
  statusCode: number;
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | number | undefined>;
  body?: unknown;
  durationMs?: number;
  payloadSizeBytes?: number;
  timestamp?: string;
}

export function createResponseEvent(context: TraceResponseContext) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'response',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      requestId: context.requestId,
      method: context.method ?? null,
      url: context.url ?? null,
      statusCode: context.statusCode,
      headers: context.headers ?? {},
      body: context.body ?? null,
      durationMs: context.durationMs ?? null,
      payloadSizeBytes: context.payloadSizeBytes ?? null
    }
  };
}
