export const REDACTED = '[REDACTED]';
export const DEFAULT_MAX_BODY_BYTES = 2048;

export const DEFAULT_SENSITIVE_KEY_PATTERN =
  /(authorization|password|passwd|pwd|token|secret|cookie|api[-_]?key|apikey|jwt|session|credit[-_]?card|card[-_]?number|cvv|ssn)/i;

const CARD_NUMBER_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

export interface TraceCapturePolicy {
  additionalMaskKeys?: string[];
  maxBodyBytes?: number;
}

export interface TraceBodySummary {
  payloadSizeBytes: number;
  body?: string;
  bodyTruncated: boolean;
}

export type TraceMetadataValue = string | number | boolean | null | string[];
export type TraceMetadata = Record<string, TraceMetadataValue>;

export function createSensitiveKeyMatcher(additionalMaskKeys: string[] = []): (key: string) => boolean {
  const extras = additionalMaskKeys
    .map((key) => key.trim().toLowerCase())
    .filter((key) => key.length > 0);

  return (key: string) => {
    if (DEFAULT_SENSITIVE_KEY_PATTERN.test(key)) {
      return true;
    }

    const normalized = key.toLowerCase();
    return extras.some((mask) => normalized === mask);
  };
}

export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
  policy: TraceCapturePolicy = {}
): TraceMetadata {
  const isSensitiveKey = createSensitiveKeyMatcher(policy.additionalMaskKeys);
  const sanitized: TraceMetadata = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = isSensitiveKey(normalizedKey) ? REDACTED : normalizeMetadataValue(value);
    if (normalizedValue !== undefined) {
      sanitized[normalizedKey] = normalizedValue;
    }
  }

  return sanitized;
}

export function redactCookieMetadata(metadata: Record<string, unknown> | undefined): TraceMetadata {
  const redacted: TraceMetadata = {};
  for (const key of Object.keys(metadata ?? {})) {
    redacted[key.toLowerCase()] = REDACTED;
  }
  return redacted;
}

export function sanitizeUrl(url: string, policy: TraceCapturePolicy = {}): string {
  const isSensitiveKey = createSensitiveKeyMatcher(policy.additionalMaskKeys);
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

    if (!isSensitiveKey(key)) {
      return part;
    }

    return eq === -1 ? `${rawKey}=${REDACTED}` : `${rawKey}=${REDACTED}`;
  });

  return `${path}?${pairs.join('&')}${hash}`;
}

export function summarizeCapturedBody(body: unknown, policy: TraceCapturePolicy = {}): TraceBodySummary {
  const maxBodyBytes = policy.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const isSensitiveKey = createSensitiveKeyMatcher(policy.additionalMaskKeys);

  if (body === undefined || body === null) {
    return { payloadSizeBytes: 0, bodyTruncated: false };
  }

  if (body instanceof Uint8Array) {
    return {
      payloadSizeBytes: body.byteLength,
      bodyTruncated: body.byteLength > Math.max(maxBodyBytes, 0)
    };
  }

  const payloadSizeBytes = measurePayloadSize(body);
  if (maxBodyBytes <= 0) {
    return { payloadSizeBytes, bodyTruncated: payloadSizeBytes > 0 };
  }

  const redacted = toRedactedBodyString(body, isSensitiveKey);
  if (redacted.length > maxBodyBytes) {
    return {
      payloadSizeBytes,
      body: redacted.slice(0, maxBodyBytes),
      bodyTruncated: true
    };
  }

  return { payloadSizeBytes, body: redacted, bodyTruncated: false };
}

function measurePayloadSize(body: unknown): number {
  if (typeof body === 'string') {
    return body.length;
  }

  return JSON.stringify(body).length;
}

function toRedactedBodyString(body: unknown, isSensitiveKey: (key: string) => boolean): string {
  if (typeof body === 'string') {
    const parsed = tryParseJson(body);
    if (parsed !== undefined) {
      return JSON.stringify(redactDeep(parsed, isSensitiveKey));
    }

    return redactSensitiveText(body);
  }

  return JSON.stringify(redactDeep(body, isSensitiveKey));
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function redactDeep(value: unknown, isSensitiveKey: (key: string) => boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, isSensitiveKey));
  }

  if (isPlainObject(value)) {
    const redacted: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = isSensitiveKey(key) ? REDACTED : redactDeep(nested, isSensitiveKey);
    }
    return redacted;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  return value;
}

function redactSensitiveText(value: string): string {
  return value.replace(CARD_NUMBER_PATTERN, REDACTED);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMetadataValue(value: unknown): TraceMetadataValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}
