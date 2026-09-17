# @traceojs/shared

Shared TypeScript types for [Traceo](https://github.com/abhishek-mehta-dev/traceo).

This package is small and optional for most applications. Framework adapters already depend on the types they need.

## Requirements

- Node.js 22 or newer

## Installation

```bash
npm install @traceojs/shared
```

## Usage

```ts
import type { TraceEvent, TraceEventType } from '@traceojs/shared';

const event: TraceEvent = {
  id: 'evt_1',
  type: 'request',
  timestamp: new Date().toISOString(),
  source: 'my-app',
  payload: { method: 'GET', url: '/health' }
};
```

## Exports

| Export | Description |
| --- | --- |
| `TraceEvent` | Common event shape |
| `TraceEventType` | Union of known event type strings |

## Related packages

- [`@traceojs/core`](https://www.npmjs.com/package/@traceojs/core)
- [`@traceojs/storage`](https://www.npmjs.com/package/@traceojs/storage)

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
