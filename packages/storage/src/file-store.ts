import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TraceoStorage } from './contract';
import { TraceoStorageError, TraceoStorageErrorCode } from './errors';
import { assertOpen, prepareStoredEvent, toIsoTimestamp } from './internal';
import { resolveTraceoDataFile } from './paths';
import { queryTraceEvents, timelineForRequestId } from './query';
import type { TraceCleanupOptions, TraceEventLike, TraceEventQuery } from './types';

export class FileTraceStore implements TraceoStorage {
  private closed = false;
  private readonly filePath: string;

  constructor(filePath: string = resolveTraceoDataFile()) {
    this.filePath = filePath;
    try {
      const dir = dirname(filePath);
      if (dir) {
        mkdirSync(dir, { recursive: true });
      }
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }

  public async capture(event: TraceEventLike): Promise<void> {
    assertOpen(this.closed);
    const events = this.readEvents();
    events.push(prepareStoredEvent(event));
    this.writeEvents(events);
  }

  public async getById(id: string): Promise<TraceEventLike | null> {
    assertOpen(this.closed);
    return this.readEvents().find((event) => event.id === id) ?? null;
  }

  public async list(): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return this.readEvents();
  }

  public async listByType(type: string): Promise<TraceEventLike[]> {
    return this.query({ type });
  }

  public async listByRequestId(requestId: string): Promise<TraceEventLike[]> {
    return this.getTimeline(requestId);
  }

  public async getTimeline(requestId: string): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return timelineForRequestId(this.readEvents(), requestId);
  }

  public async query(query: TraceEventQuery = {}): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return queryTraceEvents(this.readEvents(), query);
  }

  public async cleanup(options: TraceCleanupOptions = {}): Promise<number> {
    assertOpen(this.closed);
    if (options.olderThan === undefined) {
      return 0;
    }

    const cutoff = Date.parse(toIsoTimestamp(options.olderThan));
    const events = this.readEvents();
    const remaining = events.filter((event) => Date.parse(event.timestamp) >= cutoff);
    this.writeEvents(remaining);
    return events.length - remaining.length;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }

  private readEvents(): TraceEventLike[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be read');
      }

      return parsed as TraceEventLike[];
    } catch (error) {
      if (error instanceof TraceoStorageError) {
        throw error;
      }

      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be read');
    }
  }

  private writeEvents(events: TraceEventLike[]): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(events, null, 2));
    } catch {
      throw new TraceoStorageError(TraceoStorageErrorCode.UNAVAILABLE, 'Stored events could not be written');
    }
  }
}

export { FileTraceStore as JsonFileTraceStore };
