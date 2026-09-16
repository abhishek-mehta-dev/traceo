import { createErrorEvent, errorFromUnknown, type TraceoEventSink } from '@traceo/core';
import { createTraceoErrorHandler, createTraceoMiddleware, type TraceoExpressOptions } from '@traceo/express';

export type TraceoNestOptions = TraceoExpressOptions;

export function createTraceoNestMiddleware(options: TraceoNestOptions) {
  return createTraceoMiddleware(options);
}

export function createTraceoNestErrorHandler(options: TraceoNestOptions) {
  return createTraceoErrorHandler(options);
}

export interface NestHttpArgumentsHost {
  switchToHttp(): {
    getRequest(): {
      method?: string;
      url?: string;
      originalUrl?: string;
      traceoRequestId?: string;
      traceoTraceId?: string;
    };
    getResponse(): {
      statusCode?: number;
    };
  };
}

export function createTraceoExceptionFilter(options: { sink: TraceoEventSink }) {
  return {
    catch(exception: unknown, host: NestHttpArgumentsHost): Promise<void> {
      const http = host.switchToHttp();
      const req = http.getRequest();
      const res = http.getResponse();
      const details = errorFromUnknown(exception);
      return options.sink.capture(createErrorEvent({
        ...details,
        requestId: req.traceoRequestId,
        traceId: req.traceoTraceId,
        statusCode: res.statusCode && res.statusCode >= 400 ? res.statusCode : 500,
        method: req.method,
        url: req.originalUrl ?? req.url
      }));
    }
  };
}
