export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface TraceEventQuery {
  type?: string;
  requestId?: string;
  method?: string;
  statusCode?: number;
  source?: string;
  from?: string | Date;
  to?: string | Date;
  search?: string;
  limit?: number;
}

export interface TraceCleanupOptions {
  olderThan?: string | Date;
}
