import type { TraceEventQuery } from '@traceo/storage';
import type { TraceoAuthProvider } from './auth';

export interface TraceoServerConfig {
  host?: string;
  port?: number;
  storage: TraceoStorageLike;
  basePath?: string;
  corsOrigin?: string;
  enabled?: boolean;
  authRequired?: boolean;
  apiKey?: string;
  authProvider?: TraceoAuthProvider;
}

export interface TraceoStorageLike {
  query(query?: TraceEventQuery): unknown[];
  getById(id: string): unknown | undefined;
  getTimeline(traceId: string): unknown[];
}

export interface TraceoRequestSummary {
  id: string;
  traceId: string;
  requestId: string;
  eventType: string;
  method: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  timestamp: string;
  route?: string;
}

export interface TraceoRequestDetail extends TraceoRequestSummary {
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface TraceoTimeline {
  traceId: string;
  events: TraceoRequestDetail[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TraceoListResponse {
  data: TraceoRequestSummary[];
  pagination: PaginationMeta;
}

export interface TraceoErrorResponse {
  error: string;
  details?: string;
}
