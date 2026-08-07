export interface TraceoConfig {
  enabled: boolean;
  environment: string;
  retentionDays?: number;
}

export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface TraceoEventSink {
  capture(event: TraceEventLike): Promise<void>;
}

export class TraceoCore {
  constructor(private readonly sink: TraceoEventSink, private readonly config: TraceoConfig) {}

  public async capture(event: TraceEventLike): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.sink.capture(event);
  }
}

export * from './request';
