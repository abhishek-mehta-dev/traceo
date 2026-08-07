export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export class InMemoryTraceStore {
  private readonly events: TraceEventLike[] = [];

  public async capture(event: TraceEventLike): Promise<void> {
    this.events.push(event);
  }

  public list(): TraceEventLike[] {
    return [...this.events];
  }
}
