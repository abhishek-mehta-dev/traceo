import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolveTraceoDataFile(filePath?: string): string {
  return filePath ?? process.env.TRACEO_DATA_FILE ?? join(homedir(), '.traceo', 'events.json');
}

export function resolveTraceoSqliteFile(filePath?: string): string {
  return filePath ?? process.env.TRACEO_SQLITE_FILE ?? join(homedir(), '.traceo', 'events.sqlite');
}

export type TraceoStorageEngine = 'memory' | 'json' | 'sqlite';

export function resolveTraceoStorageEngine(): TraceoStorageEngine {
  const explicit = process.env.TRACEO_STORAGE?.trim().toLowerCase();
  if (explicit === 'memory' || explicit === 'json' || explicit === 'sqlite') {
    return explicit;
  }

  const dataFile = process.env.TRACEO_DATA_FILE ?? '';
  if (dataFile.endsWith('.json')) {
    return 'json';
  }
  if (dataFile.endsWith('.sqlite') || dataFile.endsWith('.db')) {
    return 'sqlite';
  }

  return 'sqlite';
}
