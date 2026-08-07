import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
    return this.readEvents().filter((event) => event.type === type);
  }

  public listByRequestId(requestId: string): TraceEventLike[] {
    return this.readEvents().filter((event) => {
      const payload = event.payload as Record<string, unknown>;
      return payload.requestId === requestId;
    });
  }

  public getTimeline(requestId: string): TraceEventLike[] {
    return this.listByRequestId(requestId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
