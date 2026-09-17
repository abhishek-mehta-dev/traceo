# @traceojs/express

Self-hosted request capture for Express apps. Records HTTP requests, responses, and errors, stores them locally, and serves the Traceo Ledger dashboard on the same process.

Repository: [abhishek-mehta-dev/traceo](https://github.com/abhishek-mehta-dev/traceo)

## Requirements

- Node.js 22 or newer
- Express 4 or newer

## Installation

```bash
npm install @traceojs/express
```

## Getting started

Only one environment variable is required:

```bash
TRACEO_ENABLED=true
```

Then wire Traceo into your app:

```js
import express from 'express';
import { attachTraceo } from '@traceojs/express';

const app = express();
app.use(express.json());

const traceo = attachTraceo(app);

// ... your routes ...

app.use(traceo.errorHandler);
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

app.listen(8000);
```

Open the dashboard at `http://localhost:8000/traceo/`.

Without `TRACEO_ENABLED=true`, `attachTraceo` is a no-op (safe to leave in your codebase).

## Optional configuration

These are optional. Defaults work for local use.

| Environment variable | Default | Description |
| --- | --- | --- |
| `TRACEO_PATH` | `/traceo` | Dashboard and API base path |
| `TRACEO_STORAGE` | `sqlite` | `sqlite`, `json`, or `memory` |
| `TRACEO_SQLITE_FILE` | `~/.traceo/events.sqlite` | SQLite database path |
| `TRACEO_DATA_FILE` | `~/.traceo/events.json` | JSON file when using `json` storage |
| `TRACEO_BASIC_AUTH` | — | `username:password` (recommended in production) |
| `TRACEO_API_KEY` | — | Optional API key |
| `TRACEO_DASHBOARD` | — | Override dashboard on/off (`1` / `0`); normally not needed with `attachTraceo` |

## API

### `attachTraceo(app, options?)`

Attaches capture middleware and mounts the dashboard under `/traceo` (or `TRACEO_PATH` / `options.path`).

**Returns**

| Field | Description |
| --- | --- |
| `enabled` | Whether Traceo is active |
| `path` | Mounted base path |
| `storage` | Backing store, or `null` when disabled |
| `errorHandler` | Express error middleware — mount before your final handler |

### `createTraceoMiddleware(options)` / `createTraceoErrorHandler(options)`

Lower-level APIs when you manage storage yourself.

### `isTraceoEnabled()`

Returns whether `TRACEO_ENABLED` is `true` or `1`.

## Production tips

- Set `TRACEO_BASIC_AUTH` (or protect `/traceo/` at the reverse proxy).
- Point `TRACEO_SQLITE_FILE` at a durable disk path if you use SQLite.

## Related packages

| Package | Purpose |
| --- | --- |
| [`@traceojs/nestjs`](https://www.npmjs.com/package/@traceojs/nestjs) | NestJS adapter |
| [`@traceojs/cli`](https://www.npmjs.com/package/@traceojs/cli) | Terminal timeline / events |

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
