# Traceo

Traceo is a self-hosted Node.js observability toolkit. It captures HTTP requests, responses, and errors, stores them locally, and lets you inspect timelines from a localhost dashboard.

## Current Architecture

Traceo is structured as a monorepo containing core libraries, framework adapters, storage engines, and a standalone dashboard.

- **Core & Adapters**: `@traceojs/core` handles event creation and redaction. Framework adapters (`@traceojs/express`, `@traceojs/nestjs`) capture `REQUEST_STARTED`, `REQUEST_COMPLETED`, and `error` events. Secrets are redacted before persistence, and bodies are opt-in and size-limited.
- **Storage**: `@traceojs/storage` provides pluggable persistence (Memory, JSON file, SQLite). SQLite is the default engine.
- **Server**: `@traceojs/server` exposes a REST API (`/requests`, `/timeline/:requestId`) and serves the dashboard. It supports optional basic auth / API keys, and the dashboard is disabled in production by default.
- **Dashboard ("Traceo — Ledger")**: A vanilla HTML/CSS/JS single-page application (`apps/dashboard`) with a warm, numbered log-book theme. It provides a split-pane view for request inspection and timeline detail.

## Requirements

- **Node.js ≥ 22** (SQLite storage uses `node:sqlite`)

## Install from npm (production)

**Express:**

```bash
npm install @traceojs/express
```

**NestJS:**

```bash
npm install @traceojs/nestjs
```

Then call `attachTraceo` (see below) and set env vars. Full publish guide: [docs/PUBLISH.md](docs/PUBLISH.md).

## Quick start (this monorepo)

```bash
pnpm install
pnpm build
pnpm start
```

Then open the dashboard at [http://127.0.0.1:3000/traceo/](http://127.0.0.1:3000/traceo/) and hit [http://127.0.0.1:3000/orders](http://127.0.0.1:3000/orders).

## Use in any Express app (local and production)

Same app code everywhere. Nginx only decides the public URL.

```js
import express from 'express';
import { attachTraceo } from '@traceojs/express';

const app = express();
app.use(express.json());

const traceo = attachTraceo(app); // on when TRACEO_ENABLED=true

// ... your routes ...

app.use(traceo.errorHandler);
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

app.listen(8000);
```

## Use in any NestJS app (same minimal setup)

Nest’s default HTTP adapter is Express-compatible, so Traceo mounts the same way:

```ts
import { NestFactory } from '@nestjs/core';
import { attachTraceo } from '@traceojs/nestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const traceo = attachTraceo(app); // on when TRACEO_ENABLED=true
  if (traceo.enabled) {
    app.useGlobalFilters(traceo.exceptionFilter);
  }

  await app.listen(3000);
}
bootstrap();
```

```bash
npm install @traceojs/express   # Express
npm install @traceojs/nestjs    # NestJS
```

`.env` (local and production — same for Express and NestJS):

```bash
TRACEO_ENABLED=true
TRACEO_DASHBOARD=1              # required in production to serve the UI
TRACEO_PATH=/traceo
TRACEO_SQLITE_FILE=./traceo.sqlite
TRACEO_BASIC_AUTH=user:password   # recommended in production
```

- Local: `http://localhost:3000/traceo/` (or your app port)
- Production nginx:

```nginx
location /traceo/ {
  proxy_pass http://127.0.0.1:8000/traceo/;
  auth_basic "Traceo";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Then: `https://xyz.com/traceo/`

## Packages

| Package | Role |
| --- | --- |
| `@traceojs/core` | Event factories, redaction, capture sink |
| `@traceojs/express` | Express middleware and error handler |
| `@traceojs/nestjs` | NestJS middleware and exception filter |
| `@traceojs/storage` | `TraceoStorage` plus memory, JSON, and SQLite stores |
| `@traceojs/server` | HTTP API and dashboard server |
| `apps/dashboard` | "Traceo — Ledger" vanilla HTML/CSS/JS frontend |
| `@traceojs/cli` | `timeline` and `events` commands |

## Storage

SQLite is the default engine (`~/.traceo/events.sqlite`). JSON remains available:

```bash
TRACEO_STORAGE=json TRACEO_DATA_FILE=~/.traceo/events.json
TRACEO_STORAGE=sqlite TRACEO_SQLITE_FILE=~/.traceo/events.sqlite
```

## Server security

The server binds to `127.0.0.1` by default. In `NODE_ENV=production` the dashboard is disabled unless `TRACEO_DASHBOARD=1`. Optional credentials:

```bash
TRACEO_BASIC_AUTH=user:password
TRACEO_API_KEY=your-key
TRACEO_HOST=127.0.0.1
```

## License
Traceo is licensed under the MIT License.
