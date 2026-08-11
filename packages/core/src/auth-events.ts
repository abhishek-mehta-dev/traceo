import type { TraceMetadata } from './http';

export interface TraceAuthEventContext {
  action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_reset' | 'authorization_failed' | string;
  userId?: string;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
}

const SENSITIVE_KEY_PATTERN = /authorization|token|password|secret|cookie|key|credential/i;

function sanitizeValue(value: unknown): string | number | boolean | null | string[] {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  return String(value);
}

function sanitizeMetadata(metadata?: Record<string, unknown>): TraceMetadata {
  if (!metadata) return {};
  const clean: TraceMetadata = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (v === undefined) continue;
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitizeValue(v);
    }
  }
  return clean;
}

export function createAuthEvent(context: TraceAuthEventContext) {
  const now = Date.now();
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  const action = context.action || 'auth_action';
  const success = context.success ?? (!context.action.includes('failed') && !context.error);

  return {
    id: `auth_${now}_${randomSuffix}`,
    type: 'AUTH',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      action,
      userId: context.userId ?? 'anonymous',
      success,
      error: context.error ?? null,
      metadata: sanitizeMetadata(context.metadata),
      requestId: context.requestId ?? null,
      traceId: context.traceId ?? context.requestId ?? null
    }
  };
}
