export interface TraceoExpressOptions {
  sink: {
    capture(event: { id: string; type: string; timestamp: string; source: string; payload: Record<string, unknown> }): Promise<void>;
  };
}

export function createTraceoMiddleware(options: TraceoExpressOptions) {
  return (req: any, res: any, next: () => void) => {
    const event = {
      id: `${Date.now()}`,
      type: 'request',
      timestamp: new Date().toISOString(),
      source: 'express',
      payload: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode
      }
    };

    void options.sink.capture(event);
    next();
  };
}
