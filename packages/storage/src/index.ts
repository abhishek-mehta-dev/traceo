import { queryTraceEvents, type TraceEventQuery } from './query';

export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export * from './query';
export * from './file-store';
export * from './sqlite-store';

export class InMemoryTraceStore {
  private readonly events: TraceEventLike[] = [];

  public async capture(event: TraceEventLike): Promise<void> {
    this.events.push(event);
  }

  public list(): TraceEventLike[] {
    return [...this.events];
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
    return queryTraceEvents([...this.events], query);
  }
}
