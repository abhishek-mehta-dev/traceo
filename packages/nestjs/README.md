# @traceojs/nestjs

Self-hosted request capture for NestJS apps. Records HTTP requests, responses, and errors, stores them locally, and serves the Traceo Ledger dashboard on the same process.

Nest’s default HTTP adapter is Express-compatible. This package mounts Traceo on the underlying Express instance and exposes a Nest exception filter for error capture.

Repository: [abhishek-mehta-dev/traceo](https://github.com/abhishek-mehta-dev/traceo)

## Requirements

- Node.js 22 or newer
- NestJS 9 or newer (`@nestjs/core`, `@nestjs/common`)

## Installation

```bash
npm install @traceojs/nestjs
```

## Getting started

Only one environment variable is required:

```bash
TRACEO_ENABLED=true
```

Then wire Traceo into your Nest app:

```ts
import { NestFactory } from '@nestjs/core';
import { attachTraceo } from '@traceojs/nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const traceo = attachTraceo(app);
  if (traceo.enabled) {
    app.useGlobalFilters(traceo.exceptionFilter);
  }

  await app.listen(3000);
}
bootstrap();
```

Open the dashboard at `http://localhost:3000/traceo/`.

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

Attaches capture and mounts the dashboard. Accepts a Nest application (or Express instance).

**Returns**

| Field | Description |
| --- | --- |
| `enabled` | Whether Traceo is active |
| `path` | Mounted base path |
| `storage` | Backing store, or `null` when disabled |
| `exceptionFilter` | Nest filter — use `app.useGlobalFilters(traceo.exceptionFilter)` |
| `errorHandler` | Express-style error middleware (optional) |

### `createTraceoNestMiddleware(options)` / `createTraceoExceptionFilter({ sink })`

Lower-level APIs when you manage storage yourself.

## Production tips

- Set `TRACEO_BASIC_AUTH` (or protect `/traceo/` at the reverse proxy).
- Point `TRACEO_SQLITE_FILE` at a durable disk path if you use SQLite.

## Related packages

| Package | Purpose |
| --- | --- |
| [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express) | Express middleware |
| [`@traceojs/cli`](https://www.npmjs.com/package/@traceojs/cli) | Terminal timeline / events |

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
