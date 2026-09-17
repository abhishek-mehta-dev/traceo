import { createErrorEvent, errorFromUnknown, type TraceoEventSink } from '@traceojs/core';
import {
  attachTraceo as attachTraceoExpress,
  createTraceoErrorHandler,
  createTraceoMiddleware,
  type TraceoAttachOptions,
  type TraceoAttachment,
  type TraceoExpressOptions
} from '@traceojs/express';

export type TraceoNestOptions = TraceoExpressOptions;
export type { TraceoAttachOptions, TraceoAttachment };

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

interface NestHttpAdapterLike {
  getInstance(): ExpressLike;
}

interface NestApplicationLike {
  use: (...args: unknown[]) => unknown;
  getHttpAdapter?: () => NestHttpAdapterLike;
}

interface ExpressLike {
  use: (...args: unknown[]) => unknown;
}

export interface TraceoNestAttachment extends TraceoAttachment {
  /** Nest-idiomatic exception filter — register with `app.useGlobalFilters(traceo.exceptionFilter)`. */
  exceptionFilter: ReturnType<typeof createTraceoExceptionFilter>;
}

function resolveExpressApp(app: NestApplicationLike | ExpressLike): ExpressLike {
  if ('getHttpAdapter' in app && typeof app.getHttpAdapter === 'function') {
    return app.getHttpAdapter().getInstance();
  }
  return app as ExpressLike;
}

/**
 * Wire Traceo into a NestJS app with the same minimal boilerplate as Express.
 *
 * Nest's default HTTP adapter is Express-compatible, so this mounts capture +
 * the ledger dashboard on the underlying Express instance.
 *
 * When `TRACEO_ENABLED=1|true` (or `options.enabled`):
 * - captures requests/responses
 * - serves the dashboard + API under `/traceo` (or `TRACEO_PATH`)
 *
 * @example
 * ```ts
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *   const traceo = attachTraceo(app);
 *   if (traceo.enabled) {
 *     app.useGlobalFilters(traceo.exceptionFilter);
 *   }
 *   await app.listen(3000);
 * }
 * ```
 *
 * Env (same as Express):
 * ```bash
 * TRACEO_ENABLED=true
 * TRACEO_DASHBOARD=1          # required in production
 * TRACEO_PATH=/traceo
 * TRACEO_BASIC_AUTH=user:pass
 * TRACEO_SQLITE_FILE=./traceo.sqlite
 * ```
 */
export function attachTraceo(
  app: NestApplicationLike | ExpressLike,
  options: TraceoAttachOptions = {}
): TraceoNestAttachment {
  const expressApp = resolveExpressApp(app);
  const attachment = attachTraceoExpress(expressApp, options);

  const exceptionFilter = attachment.storage
    ? createTraceoExceptionFilter({ sink: attachment.storage })
    : {
        catch(_exception: unknown, _host: NestHttpArgumentsHost): Promise<void> {
          return Promise.resolve();
        }
      };

  return {
    ...attachment,
    exceptionFilter
  };
}
