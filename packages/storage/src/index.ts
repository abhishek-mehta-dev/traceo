export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export * from './file-store';

export class InMemoryTraceStore {
  private readonly events: TraceEventLike[] = [];

  public async capture(event: TraceEventLike): Promise<void> {
    this.events.push(event);
  }

  public list(): TraceEventLike[] {
    return [...this.events];
  }

  public listByType(type: string): TraceEventLike[] {
    return this.events.filter((event) => event.type === type);
  }

  public listByRequestId(requestId: string): TraceEventLike[] {
    return this.events.filter((event) => {
      const payload = event.payload as Record<string, unknown>;
      return payload.requestId === requestId;
    });
  }

  public getTimeline(requestId: string): TraceEventLike[] {
    return this.listByRequestId(requestId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}
