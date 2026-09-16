import { FileTraceStore } from './file-store';
import { InMemoryTraceStore } from './memory-store';
import { resolveTraceoDataFile, resolveTraceoSqliteFile, resolveTraceoStorageEngine } from './paths';
import { SqliteTraceStore } from './sqlite-store';
import type { TraceoStorage } from './contract';

export function createTraceoStoreFromEnv(): TraceoStorage {
  const engine = resolveTraceoStorageEngine();
  if (engine === 'memory') {
    return new InMemoryTraceStore();
  }
  if (engine === 'json') {
    return new FileTraceStore(resolveTraceoDataFile(process.env.TRACEO_DATA_FILE));
  }
  return new SqliteTraceStore(process.env.TRACEO_DATA_FILE && (process.env.TRACEO_DATA_FILE.endsWith('.sqlite') || process.env.TRACEO_DATA_FILE.endsWith('.db'))
    ? process.env.TRACEO_DATA_FILE
    : resolveTraceoSqliteFile());
}
