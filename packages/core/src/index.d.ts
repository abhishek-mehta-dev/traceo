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
export declare class TraceoCore {
    private readonly sink;
    private readonly config;
    constructor(sink: TraceoEventSink, config: TraceoConfig);
    capture(event: TraceEventLike): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map