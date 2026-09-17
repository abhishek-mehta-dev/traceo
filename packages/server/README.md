# @traceojs/server

HTTP API and Ledger dashboard for [Traceo](https://github.com/abhishek-mehta-dev/traceo).

Most applications mount this automatically through [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express) or [`@traceojs/nestjs`](https://www.npmjs.com/package/@traceojs/nestjs) via `attachTraceo`. Use `@traceojs/server` when you want a standalone process or a custom mount.

## Requirements

- Node.js 22 or newer

## Installation

```bash
npm install @traceojs/server
```

## Getting started

### Mount on an existing Express app

```js
import express from 'express';
import { createTraceoStoreFromEnv } from '@traceojs/storage';
import { createTraceoMount } from '@traceojs/server';

const app = express();
const storage = createTraceoStoreFromEnv();

app.use('/traceo', createTraceoMount({ storage, dashboard: true }));
app.listen(8000);
```

### Standalone server from environment

```js
import { startTraceoServerFromEnv } from '@traceojs/server';

startTraceoServerFromEnv();
```

Listens on `PORT` (default `3030`) and `TRACEO_HOST` (default `127.0.0.1`).

## Configuration

| Environment variable | Description |
| --- | --- |
| `PORT` | Listen port for standalone mode (default `3030`) |
| `TRACEO_HOST` | Bind address (default `127.0.0.1`) |
| `TRACEO_DASHBOARD` | Set to `1` to enable UI in production |
| `TRACEO_BASIC_AUTH` | `username:password` |
| `TRACEO_API_KEY` | Optional API key |
| `TRACEO_STORAGE` / `TRACEO_SQLITE_FILE` / `TRACEO_DATA_FILE` | Storage selection (via `@traceojs/storage`) |

## Main exports

| Export | Description |
| --- | --- |
| `createTraceoMount(options)` | Express middleware that serves API + dashboard |
| `createTraceoServer(options)` | Standalone Node HTTP server |
| `startTraceoServerFromEnv()` | Start a server using environment variables |
| `handleTraceoRequest` | Low-level request handler |

## Related packages

- [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express) — attach capture + this server in one call
- [`@traceojs/storage`](https://www.npmjs.com/package/@traceojs/storage) — event stores

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
