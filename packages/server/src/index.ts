import { createTraceoStoreFromEnv } from '@traceo/storage';
import { createTraceoServer, type TraceoBasicAuth, type TraceoServerOptions } from './create-server';

export {
  createTraceoServer,
  createTraceoMount,
  handleTraceoRequest,
  isDashboardEnabled,
  resolveDashboardDir,
  normalizeBasePath,
  summarizeRequests,
  filterRequestSummaries,
  paginateRequestSummaries,
  requestFacets,
  type TraceoBasicAuth,
  type TraceoServerOptions,
  type TraceRequestSummary
} from './create-server';

function resolveBasicAuth(): TraceoBasicAuth | undefined {
  const value = process.env.TRACEO_BASIC_AUTH;
  if (!value) {
    return undefined;
  }
  const separator = value.indexOf(':');
  if (separator === -1) {
    return undefined;
  }
  return {
    username: value.slice(0, separator),
    password: value.slice(separator + 1)
  };
}

export function startTraceoServerFromEnv(): void {
  const options: TraceoServerOptions = {
    storage: createTraceoStoreFromEnv(),
    basicAuth: resolveBasicAuth(),
    apiKey: process.env.TRACEO_API_KEY || undefined
  };

  const server = createTraceoServer(options);
  const port = Number(process.env.PORT ?? 3030);
  const host = process.env.TRACEO_HOST ?? '127.0.0.1';

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Traceo server could not bind http://${host}:${port} because the address is already in use.`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(port, host, () => {
    console.log(`Traceo server listening on http://${host}:${port}`);
  });
}
