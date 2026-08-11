export interface TraceCustomEventContext {
  name: string;
  category?: string;
  payload?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
}

export function createCustomEvent(context: TraceCustomEventContext) {
  const now = Date.now();
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  const name = context.name || 'custom_event';
  const category = context.category || 'general';

  return {
    id: `evt_${now}_${randomSuffix}`,
    type: 'CUSTOM',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      name,
      category,
      customPayload: context.payload ?? {},
      requestId: context.requestId ?? null,
      traceId: context.traceId ?? context.requestId ?? null
    }
  };
}
