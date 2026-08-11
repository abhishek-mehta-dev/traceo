# Traceo Implementation Status

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo | DONE | pnpm workspace and TypeScript project references are configured for implemented packages. |
| Core | PARTIAL | `TraceoCore` forwards events to a sink and now owns canonical framework-agnostic HTTP lifecycle events (`REQUEST_STARTED`, `REQUEST_COMPLETED`) with factories, correlation identifiers, timestamp normalization, and minimal sensitive metadata redaction. No event bus or full lifecycle pipeline exists yet. |
| Express | PARTIAL | Middleware now uses the canonical core HTTP event factories, captures request and response completion data, preserves trace/request correlation, and sends canonical events to the configured storage boundary. Error capture, request bodies, configurable production masking, and strong Express package typing remain future work. |
| NestJS | MISSING | Directory is placeholder-only. |
| Storage | PARTIAL | In-memory and JSON file stores support capture, timeline, search, and filters; SQLite storage is missing. |
| Server | PARTIAL | A storage-backed HTTP API now exposes `/health`, `/requests`, `/requests/:id`, `/requests/:traceId/timeline`, basic pagination, supported filtering, and safe sorting; auth, dashboard hosting, and richer response shaping remain future work. |
| Dashboard | MISSING | `apps/dashboard` contains only a placeholder. |
| Dashboard SDK | MISSING | Package directory is placeholder-only. |
| Plugins | MISSING | Package directory is placeholder-only. |
| CLI | PARTIAL | Timeline and events commands work against the JSON file store; no package `bin`, server mode, or robust option validation. |
| Apps | SCAFFOLDED | `apps/dashboard`, `apps/docs`, and `apps/playground` contain placeholders only. |
| Examples | SCAFFOLDED | Example directories contain placeholders only. |
| Tests | PARTIAL | Node test suite passes after `pnpm build`; tests now cover canonical core HTTP event factories and an Express middleware-to-in-memory-storage integration path. Tests rely on compiled `dist` output and no coverage command is configured. |
| Documentation | PARTIAL | Broad product and architecture docs exist, but many describe planned behavior not yet implemented. |
| SQLite | MISSING | No SQLite dependency, schema, migrations, or adapter exist. |
| Security controls | PARTIAL | Canonical HTTP event creation applies minimal redaction for obvious sensitive metadata and captured cookies. Authentication, authorization, encryption, rate limiting, configurable masking, and safe production dashboard defaults are not implemented. |
| First vertical slice | PARTIAL | Capture, storage, query, and server pieces exist separately; no complete dashboard-visible request workflow exists. |

## First Coding Task

Completed in Phase 2: `@traceo/express` now creates canonical core HTTP events and a focused integration test proves Express middleware output reaches `@traceo/storage` in-memory storage. Next phases should still avoid unrelated scope unless explicitly requested; SQLite, dashboard UI, NestJS, plugins, and advanced querying remain unimplemented.
