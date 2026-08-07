export type TraceEventType = 'request' | 'error' | 'query' | 'auth';

export interface TraceEvent {
  id: string;
  type: TraceEventType;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}
