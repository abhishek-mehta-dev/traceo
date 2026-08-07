export interface TraceRequestContext {
  method: string;
  url: string;
  statusCode?: number;
  headers?: Record<string, string>;
  timestamp?: string;
}

export function createRequestEvent(context: TraceRequestContext) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'request',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      method: context.method,
      url: context.url,
      statusCode: context.statusCode,
      headers: context.headers ?? {}
    }
  };
}
