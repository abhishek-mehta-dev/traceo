export interface TraceErrorContext {
  message: string;
  stack?: string;
  requestId?: string;
  timestamp?: string;
}

export function createErrorEvent(context: TraceErrorContext) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: 'error',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      message: context.message,
      stack: context.stack ?? '',
      requestId: context.requestId ?? null
    }
  };
}
