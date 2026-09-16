import { TraceoStorageError, TraceoStorageErrorCode } from './errors';
import type { TraceEventLike } from './types';

const SENSITIVE_KEY_PATTERN =
  /(authorization|password|passwd|pwd|token|secret|cookie|api[-_]?key|apikey|jwt|session|credit[-_]?card|card[-_]?number|cvv|ssn)/i;
const CARD_NUMBER_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const REDACTED = '[REDACTED]';
const MAX_STORED_BODY_CHARS = 2048;

export function cloneEvent(event: TraceEventLike): TraceEventLike {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    source: event.source,
    payload: { ...event.payload }
  };
}

export function assertOpen(closed: boolean): void {
  if (closed) {
    throw new TraceoStorageError(TraceoStorageErrorCode.CLOSED, 'Storage is closed');
  }
}

export function validateEvent(event: TraceEventLike): void {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event must be an object');
  }

  if (typeof event.id !== 'string' || event.id.trim() === '') {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event id is required');
  }

  if (typeof event.type !== 'string' || event.type.trim() === '') {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event type is required');
  }

  if (typeof event.timestamp !== 'string' || event.timestamp.trim() === '') {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event timestamp is required');
  }

  if (typeof event.source !== 'string' || event.source.trim() === '') {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event source is required');
  }

  if (event.payload === null || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new TraceoStorageError(TraceoStorageErrorCode.INVALID_EVENT, 'Event payload must be an object');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : value;
  }

  return redacted;
}

function redactAllValues(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const key of Object.keys(metadata)) {
    redacted[key] = REDACTED;
  }
  return redacted;
}

function sanitizeUrl(url: string): string {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) {
    return url;
  }

  const path = withoutHash.slice(0, queryIndex);
  const search = withoutHash.slice(queryIndex + 1);
  if (search.length === 0) {
    return url;
  }

  const pairs = search.split('&').map((part) => {
    if (part.length === 0) {
      return part;
    }

    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    let key = rawKey;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
    }

    return SENSITIVE_KEY_PATTERN.test(key) ? `${rawKey}=${REDACTED}` : part;
  });

  return `${path}?${pairs.join('&')}${hash}`;
}

function sanitizeBody(body: unknown): { body: unknown; bodyTruncated?: boolean } {
  if (typeof body !== 'string') {
    return { body };
  }

  const redacted = body.replace(CARD_NUMBER_PATTERN, REDACTED);
  if (redacted.length <= MAX_STORED_BODY_CHARS) {
    return { body: redacted };
  }

  return { body: redacted.slice(0, MAX_STORED_BODY_CHARS), bodyTruncated: true };
}

function sanitizeHttpSection(section: unknown, redactAllCookies: boolean): unknown {
  if (!isPlainObject(section)) {
    return section;
  }

  const sanitized: Record<string, unknown> = { ...section };

  if (typeof section.url === 'string') {
    sanitized.url = sanitizeUrl(section.url);
  }

  if (isPlainObject(section.headers)) {
    sanitized.headers = redactMetadata(section.headers);
  }

  if (isPlainObject(section.query)) {
    sanitized.query = redactMetadata(section.query);
  }

  if (isPlainObject(section.cookies)) {
    sanitized.cookies = redactAllCookies ? redactAllValues(section.cookies) : redactMetadata(section.cookies);
  }

  if (section.body !== undefined) {
    const sanitizedBody = sanitizeBody(section.body);
    sanitized.body = sanitizedBody.body;
    if (sanitizedBody.bodyTruncated) {
      sanitized.bodyTruncated = true;
    }
  }

  return sanitized;
}

export function prepareStoredEvent(event: TraceEventLike): TraceEventLike {
  validateEvent(event);
  const cloned = cloneEvent(event);
  const payload = { ...cloned.payload };

  if (isPlainObject(payload.request)) {
    payload.request = sanitizeHttpSection(payload.request, true);
  }

  if (isPlainObject(payload.response)) {
    payload.response = sanitizeHttpSection(payload.response, false);
  }

  cloned.payload = payload;
  return cloned;
}

export function toIsoTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export function eventCorrelationId(event: TraceEventLike): unknown {
  return event.payload.requestId ?? event.payload.traceId;
}
