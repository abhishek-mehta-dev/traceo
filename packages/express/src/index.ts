export interface TraceoExpressOptions {
  sink: {
    capture(event: { id: string; type: string; timestamp: string; source: string; payload: Record<string, unknown> }): Promise<void>;
  };
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createTraceoMiddleware(options: TraceoExpressOptions) {
  return (req: any, res: any, next: () => void) => {
    const requestId = req.traceoRequestId ?? createRequestId();
    req.traceoRequestId = requestId;

    const event = {
      id: `${Date.now()}`,
      type: 'request',
      timestamp: new Date().toISOString(),
      source: 'express',
      payload: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        requestId
      }
    };

    void options.sink.capture(event);
    next();
  };
}
