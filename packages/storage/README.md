# @traceojs/storage

Persistence layer for [Traceo](https://github.com/abhishek-mehta-dev/traceo). Provides in-memory, JSON file, and SQLite stores that implement the `TraceoStorage` contract.

Express and Nest integrations create a store for you via environment variables. Use this package directly when you need a custom store or CLI access to the same data.

## Requirements

- Node.js 22 or newer (SQLite uses `node:sqlite`)

## Installation

```bash
npm install @traceojs/storage
```

## Getting started

```js
import { createTraceoStoreFromEnv, SqliteTraceStore } from '@traceojs/storage';

// From environment (recommended)
const store = createTraceoStoreFromEnv();

// Or explicit
const sqlite = new SqliteTraceStore('./traceo.sqlite');

await store.capture(event);
const timeline = await store.getTimeline(requestId);
const events = await store.query({ method: 'GET', limit: 50 });
```

## Configuration

| Environment variable | Description |
| --- | --- |
| `TRACEO_STORAGE` | `sqlite` (default), `json`, or `memory` |
| `TRACEO_SQLITE_FILE` | Path to the SQLite database |
| `TRACEO_DATA_FILE` | Path to the JSON events file |

Examples:

```bash
TRACEO_STORAGE=sqlite TRACEO_SQLITE_FILE=~/.traceo/events.sqlite
TRACEO_STORAGE=json TRACEO_DATA_FILE=~/.traceo/events.json
TRACEO_STORAGE=memory
```

## Main exports

| Export | Description |
| --- | --- |
| `createTraceoStoreFromEnv()` | Create a store from env vars |
| `SqliteTraceStore` | SQLite-backed store |
| `FileTraceStore` / `JsonFileTraceStore` | JSON file store |
| `InMemoryTraceStore` | Process-local store |
| `TraceoStorage` | Storage interface type |

## Related packages

- [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express)
- [`@traceojs/cli`](https://www.npmjs.com/package/@traceojs/cli)

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
