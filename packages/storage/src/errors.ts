export const TraceoStorageErrorCode = {
  INVALID_EVENT: 'INVALID_EVENT',
  UNAVAILABLE: 'UNAVAILABLE',
  CLOSED: 'CLOSED'
} as const;

export type TraceoStorageErrorCode = (typeof TraceoStorageErrorCode)[keyof typeof TraceoStorageErrorCode];

export class TraceoStorageError extends Error {
  readonly code: TraceoStorageErrorCode;

  constructor(code: TraceoStorageErrorCode, message: string) {
    super(message);
    this.name = 'TraceoStorageError';
    this.code = code;
  }
}
