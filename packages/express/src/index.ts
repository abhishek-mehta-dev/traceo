export interface TraceoExpressOptions {
  sink: {
    capture(event: { id: string; type: string; timestamp: string; source: string; payload: Record<string, unknown> }): Promise<void>;
  };
  captureHeaders?: boolean;
  captureResponseBody?: boolean;
}


function createEventId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeHeaders(headers: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value)])
  );
}

function estimatePayloadSize(body: unknown): number | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body.length;
  }

  if (body instanceof Uint8Array) {
    return body.byteLength;
  }

  return JSON.stringify(body).length;
}

export function createTraceoMiddleware(options: TraceoExpressOptions) {
  return (req: any, res: any, next: () => void) => {
    const startedAt = Date.now();
    const requestEvent = {
      id: createEventId(),
      type: 'request',
      timestamp: new Date().toISOString(),
      source: 'express',
      payload: {
        method: req.method,
        url: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        headers: options.captureHeaders ? normalizeHeaders(req.headers) : {},
        requestId: createRequestId()
      }
    };

    const requestId = req.traceoRequestId ?? requestEvent.payload.requestId;
    req.traceoRequestId = requestId;
    requestEvent.payload.requestId = requestId;

    let responseBody: unknown;
    const originalSend = typeof res.send === 'function' ? res.send.bind(res) : undefined;
    if (originalSend) {
      res.send = (body: unknown) => {
        responseBody = body;
        return originalSend(body);
      };
    }

    void options.sink.capture(requestEvent);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const responseEvent = {
        id: createEventId(),
        type: 'response',
        timestamp: new Date().toISOString(),
        source: 'express',
        payload: {
          requestId,
          method: req.method,
          url: req.originalUrl ?? req.url,
          statusCode: res.statusCode,
          headers: options.captureHeaders && typeof res.getHeaders === 'function' ? normalizeHeaders(res.getHeaders()) : {},
          body: options.captureResponseBody ? responseBody : null,
          durationMs: Number(durationMs.toFixed(3)),
          payloadSizeBytes: estimatePayloadSize(responseBody) ?? null
        }
      };

      void options.sink.capture(responseEvent);
    });

    next();
  };
}
