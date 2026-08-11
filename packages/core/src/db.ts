import type { TraceMetadata } from './http';

export interface TraceDbQueryContext {
  query: string;
  databaseSystem?: string;
  operation?: string;
  durationMs?: number;
  parameters?: Record<string, unknown> | unknown[];
  rowCount?: number;
  success?: boolean;
  error?: string;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
}

const SENSITIVE_KEY_PATTERN = /authorization|token|password|secret|cookie|key|credential/i;

function extractOperation(sql: string): string {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return 'SELECT';
  if (trimmed.startsWith('INSERT')) return 'INSERT';
  if (trimmed.startsWith('UPDATE')) return 'UPDATE';
  if (trimmed.startsWith('DELETE')) return 'DELETE';
  if (trimmed.startsWith('CREATE')) return 'CREATE';
  if (trimmed.startsWith('DROP')) return 'DROP';
  if (trimmed.startsWith('ALTER')) return 'ALTER';
  if (trimmed.startsWith('PRAGMA')) return 'PRAGMA';
  return 'QUERY';
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map(() => '[REDACTED]');
  }
  return '[REDACTED]';
}

function maskParameters(params?: Record<string, unknown> | unknown[]): Record<string, unknown> | unknown[] | undefined {
  if (!params) return undefined;
  if (Array.isArray(params)) {
    return params.map((val) => sanitizeValue(val));
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = sanitizeValue(v);
    }
  }
  return clean;
}

export function createDbQueryEvent(context: TraceDbQueryContext) {
  const now = Date.now();
  const randomSuffix = Math.random().toString(16).slice(2, 10);
  const operation = context.operation ?? extractOperation(context.query);

  return {
    id: `db_${now}_${randomSuffix}`,
    type: 'DB_QUERY',
    timestamp: context.timestamp ?? new Date().toISOString(),
    source: 'core',
    payload: {
      query: context.query,
      databaseSystem: context.databaseSystem ?? 'sqlite',
      operation,
      durationMs: context.durationMs ?? 0,
      parameters: maskParameters(context.parameters),
      rowCount: context.rowCount ?? null,
      success: context.success ?? (context.error ? false : true),
      error: context.error ?? null,
      requestId: context.requestId ?? null,
      traceId: context.traceId ?? context.requestId ?? null
    }
  };
}

export class TraceoDbInstrumentor {
  constructor(private readonly sink: { capture(event: unknown): Promise<void> }) {}

  public async recordQuery<T>(
    context: Omit<TraceDbQueryContext, 'durationMs' | 'success' | 'error'>,
    execute: () => Promise<T> | T
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await execute();
      const durationMs = Date.now() - startedAt;
      const rowCount = Array.isArray(result) ? result.length : undefined;
      const event = createDbQueryEvent({
        ...context,
        durationMs,
        rowCount,
        success: true
      });
      void this.sink.capture(event);
      return result;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const event = createDbQueryEvent({
        ...context,
        durationMs,
        success: false,
        error: errorMessage
      });
      void this.sink.capture(event);
      throw err;
    }
  }
}
