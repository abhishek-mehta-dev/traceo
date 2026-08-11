export type TraceHttpEventType = 'REQUEST_STARTED' | 'REQUEST_COMPLETED';

export type TraceMetadataValue = string | number | boolean | null | string[];
export type TraceMetadata = Record<string, TraceMetadataValue>;

export interface TraceHttpRequestMetadata {
  method: string;
  url: string;
  route?: string;
  headers?: TraceMetadata;
  query?: TraceMetadata;
  cookies?: TraceMetadata;
  ip?: string;
  userAgent?: string;
}

export interface TraceHttpResponseMetadata {
  statusCode: number;
  headers?: TraceMetadata;
  durationMs: number;
  completedAt: string;
  payloadSizeBytes?: number;
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

export interface CreateRequestStartedEventContext extends TraceHttpRequestMetadata {
  traceId?: string;
  requestId?: string;
  timestamp?: string | Date;
}

export interface CreateRequestCompletedEventContext {
  traceId: string;
  requestId: string;
  request: TraceHttpRequestMetadata;
  response: Omit<TraceHttpResponseMetadata, 'completedAt'> & { completedAt?: string | Date };
  timestamp?: string | Date;
}

const SENSITIVE_KEY_PATTERN = /(authorization|password|token|cookie|secret)/i;
const REDACTED = '[REDACTED]';

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

function normalizeMetadataValue(value: unknown): TraceMetadataValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function sanitizeMetadata(metadata: Record<string, unknown> | undefined): TraceMetadata {
  const sanitized: TraceMetadata = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = SENSITIVE_KEY_PATTERN.test(normalizedKey) ? REDACTED : normalizeMetadataValue(value);
    if (normalizedValue !== undefined) {
      sanitized[normalizedKey] = normalizedValue;
    }
  }

  return sanitized;
}

function redactMetadata(metadata: Record<string, unknown> | undefined): TraceMetadata {
  const redacted: TraceMetadata = {};
  for (const key of Object.keys(metadata ?? {})) {
    redacted[key.toLowerCase()] = REDACTED;
  }
  return redacted;
}

function normalizeRequest(context: TraceHttpRequestMetadata): TraceHttpRequestMetadata {
  const method = requireNonEmpty(context.method, 'method').toUpperCase();
  const url = requireNonEmpty(context.url, 'url');

  return {
    method,
    url,
    ...(context.route !== undefined ? { route: context.route } : {}),
    headers: sanitizeMetadata(context.headers),
    query: sanitizeMetadata(context.query),
    cookies: redactMetadata(context.cookies),
    ...(context.ip !== undefined ? { ip: context.ip } : {}),
    ...(context.userAgent !== undefined ? { userAgent: context.userAgent } : {})
  };
}

export function createRequestStartedEvent(context: CreateRequestStartedEventContext): TraceHttpEvent {
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
      request: normalizeRequest(context)
    }
  };
}

export function createRequestCompletedEvent(context: CreateRequestCompletedEventContext): TraceHttpEvent {
  requireNonEmpty(context.traceId, 'traceId');
  requireNonEmpty(context.requestId, 'requestId');

  if (!Number.isFinite(context.response.durationMs) || context.response.durationMs < 0) {
    throw new Error('response.durationMs must be a non-negative number');
  }

  return {
    id: createIdentifier('evt'),
    type: 'REQUEST_COMPLETED',
    timestamp: normalizeTimestamp(context.timestamp ?? context.response.completedAt),
    source: 'core',
    payload: {
      traceId: context.traceId,
      requestId: context.requestId,
      request: normalizeRequest(context.request),
      response: {
        statusCode: context.response.statusCode,
        headers: sanitizeMetadata(context.response.headers),
        durationMs: context.response.durationMs,
        completedAt: normalizeTimestamp(context.response.completedAt),
        ...(context.response.payloadSizeBytes !== undefined ? { payloadSizeBytes: context.response.payloadSizeBytes } : {})
      }
    }
  };
}

export const TRACE_HTTP_EVENT_TYPES = {
  requestStarted: 'REQUEST_STARTED',
  requestCompleted: 'REQUEST_COMPLETED'
} as const;
