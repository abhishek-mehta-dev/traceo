import { createRequestCompletedEvent, sanitizeMetadata } from './http';

export interface TraceResponseContext {
  requestId: string;
  traceId?: string;
  statusCode: number;
  method?: string;
  url?: string;
  route?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  durationMs?: number;
  payloadSizeBytes?: number;
  timestamp?: string;
}

export function createResponseEvent(context: TraceResponseContext) {
  return createRequestCompletedEvent({
    traceId: context.traceId ?? context.requestId,
    requestId: context.requestId,
    request: {
      method: context.method ?? 'UNKNOWN',
      url: context.url ?? 'unknown',
      route: context.route
    },
    response: {
      statusCode: context.statusCode,
      headers: sanitizeMetadata(context.headers),
      durationMs: context.durationMs ?? 0,
      completedAt: context.timestamp,
      payloadSizeBytes: context.payloadSizeBytes
    },
    timestamp: context.timestamp
  });
}
