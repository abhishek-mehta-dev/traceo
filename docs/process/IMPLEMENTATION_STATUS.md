# Traceo Implementation Status

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo | DONE | pnpm workspace and TypeScript project references are configured for implemented packages. |
| Core | PARTIAL | `TraceoCore` forwards events to a sink and provides request/response/error event factories, but no event bus, masking, validation, or lifecycle pipeline exists. |
| Express | PARTIAL | Middleware captures basic request and response events, but it duplicates core event construction and lacks error capture, request bodies, sanitization, and strong Express typing. |
| NestJS | MISSING | Directory is placeholder-only. |
| Storage | PARTIAL | In-memory and JSON file stores support capture, timeline, search, and filters; SQLite storage is missing. |
| Server | PARTIAL | Basic Node HTTP API exposes `/health`, `/events`, and `/timeline/:requestId`; no auth, dashboard hosting, pagination, or reusable server factory. |
| Dashboard | MISSING | `apps/dashboard` contains only a placeholder. |
| Dashboard SDK | MISSING | Package directory is placeholder-only. |
| Plugins | MISSING | Package directory is placeholder-only. |
| CLI | PARTIAL | Timeline and events commands work against the JSON file store; no package `bin`, server mode, or robust option validation. |
| Apps | SCAFFOLDED | `apps/dashboard`, `apps/docs`, and `apps/playground` contain placeholders only. |
| Examples | SCAFFOLDED | Example directories contain placeholders only. |
| Tests | PARTIAL | Node test suite passes after `pnpm build`; tests rely on compiled `dist` output and no coverage command is configured. |
| Documentation | PARTIAL | Broad product and architecture docs exist, but many describe planned behavior not yet implemented. |
| SQLite | MISSING | No SQLite dependency, schema, migrations, or adapter exist. |
| Security controls | MISSING | No masking, authentication, authorization, encryption, rate limiting, or safe production dashboard defaults are implemented. |
| First vertical slice | PARTIAL | Capture, storage, query, and server pieces exist separately; no complete dashboard-visible request workflow exists. |

## First Coding Task

Update `@traceo/express` so `createTraceoMiddleware()` uses the canonical core event factories/contracts for request and response events, preserves request/response correlation, and add/adjust tests proving an Express request flows through the middleware into a `@traceo/storage` store. Stop there; do not implement SQLite, dashboard UI, NestJS, plugins, or new dependencies.
