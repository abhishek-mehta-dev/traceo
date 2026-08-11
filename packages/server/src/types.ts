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
  capture?(event: unknown): Promise<void>;
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

export interface TraceoErrorDetail {
  id: string;
  traceId?: string;
  requestId?: string;
  name: string;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface TraceoErrorListResponse {
  data: TraceoErrorDetail[];
  pagination: PaginationMeta;
}

export interface TraceoDbQueryDetail {
  id: string;
  traceId?: string;
  requestId?: string;
  query: string;
  databaseSystem: string;
  operation: string;
  durationMs: number;
  parameters?: Record<string, unknown> | unknown[];
  rowCount?: number;
  success: boolean;
  error?: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TraceoDbQueryListResponse {
  data: TraceoDbQueryDetail[];
  pagination: PaginationMeta;
}

export interface TraceoExternalApiDetail {
  id: string;
  traceId?: string;
  requestId?: string;
  url: string;
  hostname: string;
  method: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
  requestHeaders?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TraceoExternalApiListResponse {
  data: TraceoExternalApiDetail[];
  pagination: PaginationMeta;
}

export interface TraceoAuthEventDetail {
  id: string;
  traceId?: string;
  requestId?: string;
  action: string;
  userId: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TraceoAuthEventListResponse {
  data: TraceoAuthEventDetail[];
  pagination: PaginationMeta;
}

export interface TraceoCustomEventDetail {
  id: string;
  traceId?: string;
  requestId?: string;
  name: string;
  category: string;
  customPayload?: Record<string, unknown>;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface TraceoCustomEventListResponse {
  data: TraceoCustomEventDetail[];
  pagination: PaginationMeta;
}

export interface TraceoErrorResponse {
  error: string;
  details?: string;
}
