import type { TraceCleanupOptions, TraceEventLike, TraceEventQuery } from './types';

export interface TraceoStorage {
  capture(event: TraceEventLike): Promise<void>;
  getById(id: string): Promise<TraceEventLike | null>;
  query(query?: TraceEventQuery): Promise<TraceEventLike[]>;
  getTimeline(requestId: string): Promise<TraceEventLike[]>;
  cleanup(options?: TraceCleanupOptions): Promise<number>;
  close(): Promise<void>;
}
