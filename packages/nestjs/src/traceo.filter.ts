import { createErrorEvent } from '@traceo/core';
import type { TraceoNestOptions } from './traceo.interceptor';

interface NestArgumentsHostLike {
  getType?: () => string;
  getClass?: () => { name?: string };
  getHandler?: () => { name?: string };
  switchToHttp: () => {
    getRequest: () => {
      method?: string;
      url?: string;
      originalUrl?: string;
      route?: { path?: unknown };
      traceoRequestId?: string;
      traceoTraceId?: string;
    };
    getResponse: () => {
      statusCode?: number;
    };
  };
}

export class TraceoExceptionFilter {
  constructor(private readonly options: TraceoNestOptions) {}

  public catch(exception: unknown, host: NestArgumentsHostLike): void {
    const http = host.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const err = exception instanceof Error ? exception : new Error(String(exception));
    const className = host.getClass?.()?.name;
    const handlerName = host.getHandler?.()?.name;
    const route = className && handlerName ? `${className}.${handlerName}` : (req.route?.path as string) ?? req.originalUrl ?? req.url;

    const errorEvent = createErrorEvent({
      name: err.name,
      message: err.message,
      stack: err.stack,
      requestId: req.traceoRequestId,
      traceId: req.traceoTraceId,
      route,
      method: req.method,
      statusCode: res.statusCode ?? 500
    });

    void this.options.sink.capture(errorEvent);
  }
}
