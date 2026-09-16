import type { TraceoStorage } from './contract';
import { assertOpen, cloneEvent, prepareStoredEvent, toIsoTimestamp } from './internal';
import { queryTraceEvents, timelineForRequestId } from './query';
import type { TraceCleanupOptions, TraceEventLike, TraceEventQuery } from './types';

export class InMemoryTraceStore implements TraceoStorage {
  private readonly events: TraceEventLike[] = [];
  private closed = false;

  public async capture(event: TraceEventLike): Promise<void> {
    assertOpen(this.closed);
    this.events.push(prepareStoredEvent(event));
  }

  public async getById(id: string): Promise<TraceEventLike | null> {
    assertOpen(this.closed);
    const found = this.events.find((event) => event.id === id);
    return found ? cloneEvent(found) : null;
  }

  public async list(): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return [...this.events];
  }

  public async listByType(type: string): Promise<TraceEventLike[]> {
    return this.query({ type });
  }

  public async listByRequestId(requestId: string): Promise<TraceEventLike[]> {
    return this.getTimeline(requestId);
  }

  public async getTimeline(requestId: string): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return timelineForRequestId(this.events, requestId);
  }

  public async query(query: TraceEventQuery = {}): Promise<TraceEventLike[]> {
    assertOpen(this.closed);
    return queryTraceEvents(this.events, query);
  }

  public async cleanup(options: TraceCleanupOptions = {}): Promise<number> {
    assertOpen(this.closed);
    if (options.olderThan === undefined) {
      return 0;
    }

    const cutoff = Date.parse(toIsoTimestamp(options.olderThan));
    const remaining = this.events.filter((event) => Date.parse(event.timestamp) >= cutoff);
    const removed = this.events.length - remaining.length;
    this.events.splice(0, this.events.length, ...remaining);
    return removed;
  }

  public async clear(): Promise<number> {
    assertOpen(this.closed);
    const removed = this.events.length;
    this.events.length = 0;
    return removed;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}
