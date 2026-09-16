import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TraceoStorage } from './contract';
import { TraceoStorageError, TraceoStorageErrorCode } from './errors';
import { assertOpen, eventCorrelationId, prepareStoredEvent } from './internal';
import { resolveTraceoSqliteFile } from './paths';
import { queryTraceEvents, timelineForRequestId } from './query';
import type { TraceCleanupOptions, TraceEventLike, TraceEventQuery } from './types';

interface EventRow {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  payload TEXT NOT NULL,
  request_id TEXT,
  method TEXT,
  status_code INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_request_id ON events(request_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
`;

export class SqliteTraceStore implements TraceoStorage {
  private closed = false;
  private readonly db: DatabaseSync;

  constructor(filePath: string = resolveTraceoSqliteFile()) {
    try {
      if (filePath !== ':memory:') {
        const dir = dirname(filePath);
        if (dir) {
          mkdirSync(dir, { recursive: true });
        }
      }
      this.db = new DatabaseSync(filePath);
      this.db.exec(SCHEMA);
    } catch (error) {
      if (error instanceof TraceoStorageError) {
        throw error;
      }
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }

  public async capture(event: TraceEventLike): Promise<void> {
    assertOpen(this.closed);
    const stored = prepareStoredEvent(event);
    const requestId = stringValue(eventCorrelationId(stored));
    const method = stringValue(stored.payload.method ?? requestMethod(stored.payload));
    const statusCode = numberValue(stored.payload.statusCode ?? responseStatus(stored.payload));

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO events (id, type, timestamp, source, payload, request_id, method, status_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stored.id,
        stored.type,
        stored.timestamp,
        stored.source,
        JSON.stringify(stored.payload),
        requestId,
        method,
        statusCode
      );
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }

  public async getById(id: string): Promise<TraceEventLike | null> {
    assertOpen(this.closed);
    try {
      const row = this.db.prepare('SELECT id, type, timestamp, source, payload FROM events WHERE id = ?').get(id) as unknown as EventRow | undefined;
      return row ? rowToEvent(row) : null;
    } catch (error) {
      throw wrapReadError(error);
    }
  }

  public async list(): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    try {
      const rows = this.db.prepare('SELECT id, type, timestamp, source, payload FROM events ORDER BY rowid ASC').all() as unknown as EventRow[];
      return rows.map(rowToEvent);
    } catch (error) {
      throw wrapReadError(error);
    }
  }

  public async listByType(type: string): Promise<TraceEventLike[]> {
    return this.query({ type });
  }

  public async listByRequestId(requestId: string): Promise<TraceEventLike[]> {
    return this.getTimeline(requestId);
  }

  public async getTimeline(requestId: string): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    try {
      const rows = this.db.prepare('SELECT id, type, timestamp, source, payload FROM events WHERE request_id = ? ORDER BY timestamp ASC, rowid ASC').all(requestId) as unknown as EventRow[];
      return timelineForRequestId(rows.map(rowToEvent), requestId);
    } catch (error) {
      throw wrapReadError(error);
    }
  }

  public async query(query: TraceEventQuery = {}): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    try {
      const rows = this.db.prepare('SELECT id, type, timestamp, source, payload FROM events ORDER BY timestamp DESC, rowid DESC').all() as unknown as EventRow[];
      return queryTraceEvents(rows.map(rowToEvent), query);
    } catch (error) {
      throw wrapReadError(error);
    }
  }

  public async cleanup(options: TraceCleanupOptions = {}): Promise<number> {
    assertOpen(this.closed);
    if (options.olderThan === undefined) {
      return 0;
    }

    const cutoff = options.olderThan instanceof Date ? options.olderThan.toISOString() : options.olderThan;
    try {
      const result = this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(cutoff);
      return Number(result.changes ?? 0);
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }

  public async clear(): Promise<number> {
    assertOpen(this.closed);
    try {
      const result = this.db.prepare('DELETE FROM events').run();
      return Number(result.changes ?? 0);
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      this.db.close();
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Storage is closed');
    }
  }
}

function rowToEvent(row: EventRow): TraceEventLike {
  try {
    return {
      id: row.id,
      type: row.type,
      timestamp: row.timestamp,
      source: row.source,
      payload: JSON.parse(row.payload) as Record<string, unknown>
    };
  } catch {
    throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be read');
  }
}

function wrapReadError(error: unknown): TraceoStorageError {
  if (error instanceof TraceoStorageError) {
    return error;
  }
  return new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be read');
}

function requestMethod(payload: Record<string, unknown>): unknown {
  const request = payload.request as { method?: unknown } | undefined;
  return request?.method;
}

function responseStatus(payload: Record<string, unknown>): unknown {
  const response = payload.response as { statusCode?: unknown } | undefined;
  return response?.statusCode;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
