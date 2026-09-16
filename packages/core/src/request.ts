import { createRequestStartedEvent, type CreateRequestStartedEventContext } from './http';
import type { TraceCapturePolicy } from './redaction';

export interface TraceRequestContext extends CreateRequestStartedEventContext {
  statusCode?: number;
}

export function createRequestEvent(context: TraceRequestContext, policy: TraceCapturePolicy = {}) {
  return createRequestStartedEvent(context, policy);
}
