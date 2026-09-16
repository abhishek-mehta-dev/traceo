import {
  redactCookieMetadata,
  sanitizeMetadata,
  sanitizeUrl,
  summarizeCapturedBody,
  type TraceCapturePolicy,
  type TraceMetadata
} from './redaction';

export type TraceHttpEventType = 'REQUEST_STARTED' | 'REQUEST_COMPLETED';

export interface TraceHttpRequestMetadata {
  method: string;
  url: string;
  route?: string;
  headers?: TraceMetadata;
  query?: TraceMetadata;
  cookies?: TraceMetadata;
  ip?: string;
  userAgent?: string;
  payloadSizeBytes?: number;
  body?: string;
  bodyTruncated?: boolean;
}

export interface TraceHttpResponseMetadata {
  statusCode: number;
  headers?: TraceMetadata;
  durationMs: number;
  completedAt: string;
  payloadSizeBytes?: number;
  body?: string;
  bodyTruncated?: boolean;
}

export interface TraceHttpEventPayload {
  [key: string]: unknown;
  traceId: string;
  requestId: string;
  request: TraceHttpRequestMetadata;
  response?: TraceHttpResponseMetadata;
}

export interface TraceHttpEvent {
  id: string;
  type: TraceHttpEventType;
  timestamp: string;
  source: 'core';
  payload: TraceHttpEventPayload;
}

export interface CreateRequestStartedEventContext {
  method: string;
  url: string;
  route?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  body?: unknown;
  traceId?: string;
  requestId?: string;
  timestamp?: string | Date;
}

export interface CreateRequestCompletedEventContext {
  traceId: string;
  requestId: string;
  request: Omit<CreateRequestStartedEventContext, 'traceId' | 'requestId' | 'timestamp' | 'body'> & {
    method: string;
    url: string;
    body?: unknown;
  };
  response: {
    statusCode: number;
    headers?: Record<string, unknown>;
    durationMs: number;
    completedAt?: string | Date;
    payloadSizeBytes?: number;
    body?: unknown;
  };
  timestamp?: string | Date;
}

function createIdentifier(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTimestamp(timestamp?: string | Date): string {
  if (timestamp === undefined) {
    return new Date().toISOString();
  }

  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('timestamp must be a valid date/time value');
  }

  return parsed.toISOString();
}

function requireNonEmpty(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${field} is required`);
  }

  return value;
}

function bodyFields(summary: { payloadSizeBytes: number; body?: string; bodyTruncated: boolean }): Pick<TraceHttpRequestMetadata, 'payloadSizeBytes' | 'body' | 'bodyTruncated'> {
  return {
    ...(summary.body !== undefined || summary.payloadSizeBytes > 0 ? { payloadSizeBytes: summary.payloadSizeBytes } : {}),
    ...(summary.body !== undefined ? { body: summary.body } : {}),
    ...(summary.bodyTruncated ? { bodyTruncated: true } : {})
  };
}

function normalizeRequest(
  context: Pick<CreateRequestStartedEventContext, 'method' | 'url' | 'route' | 'headers' | 'query' | 'cookies' | 'ip' | 'userAgent' | 'body'>,
  policy: TraceCapturePolicy = {}
): TraceHttpRequestMetadata {
  const method = requireNonEmpty(context.method, 'method').toUpperCase();
  const url = sanitizeUrl(requireNonEmpty(context.url, 'url'), policy);
  const body = context.body === undefined ? undefined : summarizeCapturedBody(context.body, policy);

  return {
    method,
    url,
    ...(context.route !== undefined ? { route: context.route } : {}),
    ...(context.headers !== undefined ? { headers: sanitizeMetadata(context.headers, policy) } : {}),
    ...(context.query !== undefined ? { query: sanitizeMetadata(context.query, policy) } : {}),
    ...(context.cookies !== undefined ? { cookies: redactCookieMetadata(context.cookies) } : {}),
    ...(context.ip !== undefined ? { ip: context.ip } : {}),
    ...(context.userAgent !== undefined ? { userAgent: context.userAgent } : {}),
    ...(body === undefined ? {} : bodyFields(body))
  };
}

export function createRequestStartedEvent(
  context: CreateRequestStartedEventContext,
  policy: TraceCapturePolicy = {}
): TraceHttpEvent {
  const traceId = context.traceId ?? createIdentifier('trace');
  const requestId = context.requestId ?? traceId;

  return {
    id: createIdentifier('evt'),
    type: 'REQUEST_STARTED',
    timestamp: normalizeTimestamp(context.timestamp),
    source: 'core',
    payload: {
      traceId,
      requestId,
      request: normalizeRequest(context, policy)
    }
  };
}

export function createRequestCompletedEvent(
  context: CreateRequestCompletedEventContext,
  policy: TraceCapturePolicy = {}
): TraceHttpEvent {
  requireNonEmpty(context.traceId, 'traceId');
  requireNonEmpty(context.requestId, 'requestId');

  if (!Number.isFinite(context.response.durationMs) || context.response.durationMs < 0) {
    throw new Error('response.durationMs must be a non-negative number');
  }

  const responseBody = context.response.body === undefined
    ? undefined
    : summarizeCapturedBody(context.response.body, policy);
  const payloadSizeBytes = context.response.payloadSizeBytes ?? responseBody?.payloadSizeBytes;

  return {
    id: createIdentifier('evt'),
    type: 'REQUEST_COMPLETED',
    timestamp: normalizeTimestamp(context.timestamp ?? context.response.completedAt),
    source: 'core',
    payload: {
      traceId: context.traceId,
      requestId: context.requestId,
      request: normalizeRequest(context.request, policy),
      response: {
        statusCode: context.response.statusCode,
        ...(context.response.headers !== undefined ? { headers: sanitizeMetadata(context.response.headers, policy) } : {}),
        durationMs: context.response.durationMs,
        completedAt: normalizeTimestamp(context.response.completedAt),
        ...(payloadSizeBytes !== undefined ? { payloadSizeBytes } : {}),
        ...(responseBody?.body !== undefined ? { body: responseBody.body } : {}),
        ...(responseBody?.bodyTruncated ? { bodyTruncated: true } : {})
      }
    }
  };
}

export const TRACE_HTTP_EVENT_TYPES = {
  requestStarted: 'REQUEST_STARTED',
  requestCompleted: 'REQUEST_COMPLETED'
} as const;
