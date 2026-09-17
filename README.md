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

Then open the dashboard at [http://127.0.0.1:3000/traceo/](http://127.0.0.1:3000/traceo/) and hit [http://127.0.0.1:3000/orders](http://127.0.0.1:3000/orders).

## Use in any Express app (local and production)

Same app code everywhere. Nginx only decides the public URL.

```js
import express from 'express';
import { attachTraceo } from '@traceo/express';

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

`.env` (local and production):

```bash
TRACEO_ENABLED=true
TRACEO_PATH=/traceo
TRACEO_SQLITE_FILE=./traceo.sqlite
TRACEO_BASIC_AUTH=user:password   # recommended in production
```

- Local: `http://localhost:8000/traceo/`
- Production nginx:

```nginx
location /traceo/ {
  proxy_pass http://127.0.0.1:8000/traceo/;
  auth_basic "Traceo";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Then: `https://xyz.com/traceo/`

Until packages are on npm, install from the Traceo repo:

```bash
npm install \
  file:../Learning/traceo/packages/express \
  file:../Learning/traceo/packages/server \
  file:../Learning/traceo/packages/storage \
  file:../Learning/traceo/packages/core \
  file:../Learning/traceo/packages/shared
```

Run `pnpm build` in the Traceo repo first so `dist/` and dashboard assets exist.

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
