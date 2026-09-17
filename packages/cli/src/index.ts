#!/usr/bin/env node
import { createTraceoStoreFromEnv } from '@traceojs/storage';
import { runTraceoCli } from './run';

export { runTraceoCli } from './run';

const storage = createTraceoStoreFromEnv();

runTraceoCli(process.argv, storage).then((code) => {
  if (code !== 0) {
    process.exit(code);
  }
}).catch(() => {
  console.error('Storage unavailable');
  process.exit(1);
});
