import { createRequestStartedEvent, type CreateRequestStartedEventContext } from './http';

export interface TraceRequestContext extends CreateRequestStartedEventContext {
  statusCode?: number;
}

export function createRequestEvent(context: TraceRequestContext) {
  return createRequestStartedEvent(context);
}
