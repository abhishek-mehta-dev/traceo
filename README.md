# Traceo

Traceo is a self-hosted Node.js observability toolkit. It captures HTTP requests, responses, and errors, stores them locally, and lets you inspect timelines from a localhost dashboard.

## Current vertical slice

- Express and NestJS adapters
- Canonical `REQUEST_STARTED`, `REQUEST_COMPLETED`, and `error` events
- Storage contract with memory, JSON file, and SQLite adapters
- Local dashboard for request list and timeline detail
- Optional basic auth / API key; dashboard off in production by default
- Secrets redacted before persist; bodies opt-in and size-limited

## Quick start

```bash
pnpm install
pnpm build
pnpm start
```

Then open [http://127.0.0.1:3030/](http://127.0.0.1:3030/) and hit [http://127.0.0.1:3000/orders](http://127.0.0.1:3000/orders).

## Packages

| Package | Role |
| --- | --- |
| `@traceo/core` | Event factories, redaction, capture sink |
| `@traceo/express` | Express middleware and error handler |
| `@traceo/nestjs` | NestJS middleware and exception filter |
| `@traceo/storage` | `TraceoStorage` plus memory, JSON, and SQLite stores |
| `@traceo/server` | HTTP API and dashboard |
| `@traceo/cli` | `timeline` and `events` commands |

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
