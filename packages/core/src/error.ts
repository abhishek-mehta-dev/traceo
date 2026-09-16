export interface TraceErrorContext {
  message: string;
  stack?: string;
  name?: string;
  requestId?: string;
  traceId?: string;
  statusCode?: number;
  method?: string;
  url?: string;
  timestamp?: string;
}

export function createErrorEvent(context: TraceErrorContext) {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'error',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      message: context.message,
      stack: context.stack ?? '',
      name: context.name ?? 'Error',
      requestId: context.requestId ?? null,
      ...(context.traceId !== undefined ? { traceId: context.traceId } : {}),
      ...(context.statusCode !== undefined ? { statusCode: context.statusCode } : {}),
      ...(context.method !== undefined ? { method: context.method } : {}),
      ...(context.url !== undefined ? { url: context.url } : {})
    }
  };
}

export function errorFromUnknown(error: unknown): { message: string; stack?: string; name: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, name: error.name };
  }

  return { message: String(error), name: 'Error' };
}
