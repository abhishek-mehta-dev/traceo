import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { queryTraceEvents, type TraceEventQuery } from './query';

export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export class FileTraceStore {
  constructor(private readonly filePath: string) {
    const dir = filePath.split('/').slice(0, -1).join('/');
    if (dir) {
      mkdirSync(dir, { recursive: true });
    }
  }

  public async capture(event: TraceEventLike): Promise<void> {
    const events = this.readEvents();
    events.push(event);
    this.writeEvents(events);
  }

  public list(): TraceEventLike[] {
    return this.readEvents();
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
    return queryTraceEvents(this.readEvents(), query);
  }

  private readEvents(): TraceEventLike[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    const raw = readFileSync(this.filePath, 'utf8');
    return raw ? JSON.parse(raw) : [];
  }

  private writeEvents(events: TraceEventLike[]): void {
    writeFileSync(this.filePath, JSON.stringify(events, null, 2));
  }
}
