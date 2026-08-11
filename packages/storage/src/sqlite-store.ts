import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { TraceEventLike, TraceEventQuery } from './query';

interface SQLiteStoreOptions {
  maxPayloadBytes?: number;
}

const SENSITIVE_KEY_PATTERN = /(authorization|password|token|cookie|secret)/i;
const REDACTED = '[REDACTED]';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeForJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return { $type: 'Buffer', data: Array.from(value) };
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item, seen));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedValue = normalizeForJson(child, seen);
    if (normalizedValue !== undefined) {
      normalized[key] = normalizedValue;
    }
  }
  seen.delete(value);
  return normalized;
}

function serializePayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(normalizeForJson(payload));
  } catch {
    return JSON.stringify({ __traceo_serialization_error: true });
  }
}

function sanitizePayload(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = REDACTED;
      continue;
    }

    sanitized[key] = sanitizePayload(child);
  }

  return sanitized;
}

function deserializePayload(serialized: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(serialized);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export class SQLiteTraceStore {
  private db: DatabaseSync | undefined;
  private initialized = false;
  private readonly maxPayloadBytes: number;

  constructor(private readonly filePath: string, options: SQLiteStoreOptions = {}) {
    this.maxPayloadBytes = options.maxPayloadBytes ?? 256 * 1024;
    const dir = dirname(filePath);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.db = new DatabaseSync(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        trace_id TEXT,
        request_id TEXT,
        method TEXT,
        status_code INTEGER,
        payload TEXT NOT NULL,
        payload_size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_timestamp ON trace_events(timestamp)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_type ON trace_events(type)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_trace_id ON trace_events(trace_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_request_id ON trace_events(request_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_method ON trace_events(method)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_trace_events_status_code ON trace_events(status_code)');
    this.initialized = true;
  }

  public async capture(event: TraceEventLike): Promise<void> {
    this.initialize();

    const payloadPayload = this.preparePayload(event.payload);
    const payloadText = serializePayload(payloadPayload);
    const payloadSizeBytes = Buffer.byteLength(payloadText, 'utf8');

    const statement = this.db!.prepare(
      `INSERT OR REPLACE INTO trace_events (
        id,
        type,
        timestamp,
        source,
        trace_id,
        request_id,
        method,
        status_code,
        payload,
        payload_size_bytes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    statement.run(
      event.id,
      event.type,
      event.timestamp,
      event.source,
      this.extractTraceId(payloadPayload),
      this.extractRequestId(payloadPayload),
      this.extractMethod(payloadPayload),
      this.extractStatusCode(payloadPayload),
      payloadText,
      payloadSizeBytes,
      new Date().toISOString()
    );
  }

  public list(): TraceEventLike[] {
    this.ensureInitialized();
    const rows = this.db!.prepare('SELECT id, type, timestamp, source, payload FROM trace_events ORDER BY timestamp DESC').all() as Array<{ id: string; type: string; timestamp: string; source: string; payload: string }>;
    return rows.map((row) => this.rowToEvent(row));
  }

  public listByType(type: string): TraceEventLike[] {
    return this.query({ type });
  }

  public listByRequestId(requestId: string): TraceEventLike[] {
    return this.query({ requestId }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  public getTimeline(requestId: string): TraceEventLike[] {
    return this.listByRequestId(requestId);
  }

  public query(query: TraceEventQuery = {}): TraceEventLike[] {
    this.ensureInitialized();

    const clauses: string[] = [];
    const params: Array<string | number | null> = [];

    if (query.type !== undefined) {
      clauses.push('type = ?');
      params.push(query.type);
    }

    if (query.traceId !== undefined) {
      clauses.push('trace_id = ?');
      params.push(query.traceId);
    }

    if (query.requestId !== undefined) {
      clauses.push('request_id = ?');
      params.push(query.requestId);
    }

    if (query.method !== undefined) {
      clauses.push('method = ?');
      params.push(query.method);
    }

    if (query.statusCode !== undefined) {
      clauses.push('status_code = ?');
      params.push(query.statusCode);
    }

    if (query.source !== undefined) {
      clauses.push('source = ?');
      params.push(query.source);
    }

    if (query.from !== undefined) {
      clauses.push('timestamp >= ?');
      params.push(query.from);
    }

    if (query.to !== undefined) {
      clauses.push('timestamp <= ?');
      params.push(query.to);
    }

    if (query.search !== undefined && query.search.trim() !== '') {
      clauses.push('(id LIKE ? OR type LIKE ? OR source LIKE ? OR payload LIKE ? OR trace_id LIKE ? OR request_id LIKE ?)');
      const searchValue = `%${query.search}%`;
      params.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    let sql = 'SELECT id, type, timestamp, source, payload FROM trace_events';
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ' ORDER BY timestamp DESC';

    if (query.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db!.prepare(sql).all(...params) as Array<{ id: string; type: string; timestamp: string; source: string; payload: string }>;
    return rows.map((row) => this.rowToEvent(row));
  }

  public getById(id: string): TraceEventLike | undefined {
    this.ensureInitialized();
    const row = this.db!.prepare('SELECT id, type, timestamp, source, payload FROM trace_events WHERE id = ?').get(id) as { id: string; type: string; timestamp: string; source: string; payload: string } | undefined;
    return row ? this.rowToEvent(row) : undefined;
  }

  public cleanup(olderThan: string | Date): number {
    this.ensureInitialized();
    const cutoff = olderThan instanceof Date ? olderThan.toISOString() : new Date(olderThan).toISOString();
    const result = this.db!.prepare('DELETE FROM trace_events WHERE timestamp < ?').run(cutoff);
    return Number(result.changes ?? 0);
  }

  public deleteOlderThan(olderThan: string | Date): number {
    return this.cleanup(olderThan);
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.initialized = false;
  }

  private preparePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const normalizedPayload = normalizeForJson(payload);
    const safePayload = isPlainObject(normalizedPayload) ? (sanitizePayload(normalizedPayload) as Record<string, unknown>) : { value: normalizedPayload };
    if (Buffer.byteLength(serializePayload(safePayload), 'utf8') > this.maxPayloadBytes) {
      return {
        __traceo_truncated: true,
        __traceo_payload_size_bytes: Buffer.byteLength(serializePayload(safePayload), 'utf8')
      };
    }
    return safePayload;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      this.initialize();
    }
  }

  private extractTraceId(payload: Record<string, unknown>): string | null {
    const value = payload.traceId;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private extractRequestId(payload: Record<string, unknown>): string | null {
    const value = payload.requestId;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private extractMethod(payload: Record<string, unknown>): string | null {
    const request = payload.request;
    const value = isPlainObject(request) ? request.method : undefined;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  private extractStatusCode(payload: Record<string, unknown>): number | null {
    const response = payload.response;
    const value = isPlainObject(response) ? response.statusCode : undefined;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private rowToEvent(row: { id: string; type: string; timestamp: string; source: string; payload: string }): TraceEventLike {
    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      source: row.source,
      payload: deserializePayload(row.payload)
    };
  }
}
