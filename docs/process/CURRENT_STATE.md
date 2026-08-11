# Traceo Current State

## 1. Repository Overview

Traceo is currently a pnpm monorepo with root TypeScript project references for `packages/core`, `packages/shared`, `packages/storage`, `packages/express`, `packages/cli`, and `packages/server`. The workspace glob also includes `apps/*` and `examples/*`, but those directories are currently placeholder-only. The repository has substantial product and architecture documentation, an initial runtime skeleton, and behavior tests that target compiled `dist` output.

Top-level status:

| Area | Status | Evidence |
| --- | --- | --- |
| Monorepo configuration | DONE | Root `package.json`, `pnpm-workspace.yaml`, and TS references exist. |
| Runnable packages | PARTIAL | Core, storage, Express, CLI, and server contain source; dashboard-sdk, NestJS, and plugins are placeholders. |
| Apps/examples | SCAFFOLDED | App and example folders contain only `.gitkeep` files. |
| Initial PRD vertical slice | PARTIAL | Events can be created, captured to memory/file JSON, queried, served over simple HTTP APIs, and partially captured from Express middleware. |

## 2. Current Architecture

```mermaid
flowchart LR
  App[Node.js application / tests] --> Express[@traceo/express middleware]
  Express -->|emits request/response events directly| Sink[TraceoEventSink]
  App --> Core[@traceo/core]
  Core -->|capture(event)| Sink
  Core -->|create request/response/error events| Event[TraceEventLike]
  Sink --> Storage[@traceo/storage]
  Storage --> File[(JSON file store)]
  Storage --> Memory[(In-memory store)]
  Server[@traceo/server] --> Storage
  CLI[@traceo/cli] --> Storage
  Dashboard[apps/dashboard] -. missing .-> Server
```

The implemented flow is simpler than the planned event-bus architecture. `@traceo/core` provides event factories and a sink-forwarding class, while `@traceo/express` constructs request/response event objects itself rather than using the core factories. Storage is JSON-file/in-memory based, not SQLite.

## 3. Dependency Graph

Manifest and source-import dependency graph:

```mermaid
flowchart TD
  Root[traceo root]
  CLI[@traceo/cli] --> Storage[@traceo/storage]
  Server[@traceo/server] --> Storage
  Storage --> Core[@traceo/core]
  Express[@traceo/express] --> Core
  Express --> Shared[@traceo/shared]
  Core -->|source import ./error only| CoreInternal[core internal modules]
  DashboardSDK[@traceo/dashboard-sdk] -. placeholder .- Root
  NestJS[@traceo/nestjs] -. placeholder .- Root
  Plugins[@traceo/plugins] -. placeholder .- Root
```

External dependencies are intentionally minimal: root dev dependencies are TypeScript, Turbo, and Node types; package code uses only Node built-ins. No circular package dependencies were found. The main questionable direction is `@traceo/storage -> @traceo/core`, because storage should likely depend on shared event contracts rather than core runtime behavior long term.

## 4. Package-by-Package Assessment

### @traceo/cli

#### Responsibility
Command-line access to persisted trace events.

#### Implemented
- `traceo timeline <requestId>` reads a file-backed store and prints correlated events.
- `traceo events` supports filters for type, method, status, search, and limit.
- Uses `TRACEO_DATA_FILE` or `~/.traceo/events.json`.

#### Partial
- No package `bin` field, help system, structured output mode, or robust argument validation.
- Only reads the JSON file store; no server integration.

#### Scaffolded
- Package exists with TypeScript build configuration.

#### Dependencies
- Internal: `@traceo/storage`.
- External/runtime: Node `path` and `os` built-ins.

#### Public API
- Executable source `packages/cli/src/index.ts`; no exported library API is intended.

#### Problems
- Invalid numeric options become `NaN` silently.
- CLI depends directly on file storage details.

#### PRD Alignment
Supports basic local inspection of captured events, but CLI tooling is future functionality rather than part of the initial dashboard-first PRD.

#### Recommendation
Keep CLI secondary; after storage/server contracts stabilize, make CLI consume stable query APIs and add package `bin` metadata.

### @traceo/core

#### Responsibility
Core event contracts, event factories, and minimal capture forwarding through an injected sink.

#### Implemented
- `TraceoCore.capture()` forwards events when enabled.
- `TraceoCore.captureError()` creates and captures an error event.
- Factories exist for request, response, and error events.
- No Express, NestJS, SQLite, dashboard, or ORM dependency was found.

#### Partial
- No event bus, masking, validation, normalization, enrichment, retention, backpressure, or plugin hooks.
- Request and response correlation is not managed centrally across a lifecycle.

#### Scaffolded
- `TraceoConfig`, `TraceEventLike`, and `TraceoEventSink` provide early contracts.

#### Dependencies
- No package dependencies; internal import from `./error`.

#### Public API
- `TraceoCore`, `TraceoConfig`, `TraceEventLike`, `TraceoEventSink`.
- `createRequestEvent`, `createResponseEvent`, `createErrorEvent` and their context interfaces.

#### Problems
- Event schema is loose (`type: string`, arbitrary payload).
- Duplicates concepts with `@traceo/shared`.
- Built `.js`/`.d.ts` files exist in `src`, creating potential drift from TypeScript source.

#### PRD Alignment
Partially supports HTTP request/response/error event creation, but does not yet implement the actual capture pipeline or lifecycle processing.

#### Recommendation
Next stabilize a single event contract and correlation model before adding more adapters.

### @traceo/dashboard-sdk

#### Responsibility
Planned SDK/client for dashboard communication.

#### Implemented
- None.

#### Partial
- None.

#### Scaffolded
- Placeholder directory only.

#### Dependencies
- None.

#### Public API
- None.

#### Problems
- Package manifest and source are missing.

#### PRD Alignment
Dashboard integration is missing.

#### Recommendation
Do not build until server API and dashboard app needs are clearer.

### @traceo/express

#### Responsibility
Express-style middleware for HTTP request and response event capture.

#### Implemented
- Middleware captures a request event when invoked.
- Middleware captures a response event on `finish`.
- Correlates request/response events using `req.traceoRequestId`.
- Can optionally capture request/response headers and response body metadata/body.

#### Partial
- Uses `any` request/response types and does not declare Express as peer dependency.
- Does not capture request body.
- Does not capture thrown errors or `next(error)`.
- Does not sanitize headers/cookies/tokens.
- Fire-and-forget sink failures are ignored.

#### Scaffolded
- Package manifest and TS project are present.

#### Dependencies
- Manifest: `@traceo/core`, `@traceo/shared`.
- Source currently imports neither internal package, so manifest dependencies are unused in implementation.

#### Public API
- `TraceoExpressOptions` and `createTraceoMiddleware()`.

#### Problems
- Duplicates event-id/request-id/event construction instead of using core factories or shared contracts.
- Potential security risk if `captureHeaders` or `captureResponseBody` are enabled.

#### PRD Alignment
Partially satisfies Express adapter and HTTP request/response monitoring.

#### Recommendation
First implementation task should align this middleware with core event factories/contracts and prove adapter-to-core-to-storage capture without redesigning architecture.

### @traceo/nestjs

#### Responsibility
Planned NestJS integration.

#### Implemented
- None.

#### Partial
- None.

#### Scaffolded
- Placeholder directory only.

#### Dependencies
- None.

#### Public API
- None.

#### Problems
- Package manifest and source are missing.

#### PRD Alignment
NestJS adapter is missing.

#### Recommendation
Build after Express vertical slice proves the core capture/storage/server path.

### @traceo/plugins

#### Responsibility
Planned plugin ecosystem foundation.

#### Implemented
- None.

#### Partial
- None.

#### Scaffolded
- Placeholder directory only.

#### Dependencies
- None.

#### Public API
- None.

#### Problems
- Package manifest and source are missing.

#### PRD Alignment
Plugin ecosystem is future functionality and currently missing.

#### Recommendation
Do not implement in the initial vertical slice.

### @traceo/server

#### Responsibility
Simple HTTP API over persisted trace events.

#### Implemented
- Starts a Node HTTP server on `PORT` or 3030.
- `GET /health` returns status JSON.
- `GET /events` returns filtered events.
- `GET /timeline/:requestId` returns correlated events.

#### Partial
- No dashboard static hosting, authentication, pagination metadata, validation, CORS policy, graceful shutdown, or write API.
- Uses module-level store and starts immediately on import/run, which limits testability.

#### Scaffolded
- Package manifest and TS project are present.

#### Dependencies
- Internal: `@traceo/storage`.
- External/runtime: Node `http`, `path`, and `os` built-ins.

#### Public API
- No exported API; executable server module.

#### Problems
- Directly coupled to JSON file storage.
- Dashboard exposure would currently be unauthenticated.

#### PRD Alignment
Partially supports server-side dashboard data APIs but no actual dashboard UI.

#### Recommendation
After capture/storage are stable, extract app/server creation APIs and add secure dashboard-facing endpoints.

### @traceo/shared

#### Responsibility
Shared event type definitions.

#### Implemented
- `TraceEventType` union and `TraceEvent` interface.

#### Partial
- Types are minimal and not consistently consumed by other packages.

#### Scaffolded
- Package manifest and TS project are present.

#### Dependencies
- None.

#### Public API
- `TraceEventType`, `TraceEvent`.

#### Problems
- Built files exist in `src` and may drift.
- Types overlap with `@traceo/core` and `@traceo/storage` local `TraceEventLike` interfaces.

#### PRD Alignment
Supports foundational contracts only.

#### Recommendation
Make shared the stable home for event contracts, or intentionally fold it into core; avoid duplication.

### @traceo/storage

#### Responsibility
Persistence and query utilities for trace events.

#### Implemented
- `InMemoryTraceStore` captures, lists, filters, and returns timelines.
- `FileTraceStore` persists events to a JSON file.
- Query filters include type, requestId, method, statusCode, source, date range, search, and limit.

#### Partial
- File persistence is synchronous and non-atomic.
- No SQLite adapter, migrations, indexes, retention, pagination cursor, or storage abstraction interface.

#### Scaffolded
- Package manifest and TS project are present.

#### Dependencies
- Manifest: `@traceo/core`, though source only uses local event interfaces and query modules.
- External/runtime: Node `fs` built-ins.

#### Public API
- `InMemoryTraceStore`, `FileTraceStore`, `TraceEventQuery`, `queryTraceEvents`, local `TraceEventLike`.

#### Problems
- Coupled to JSON files for durable storage.
- Duplicate event types.
- Synchronous read-modify-write per capture is a performance and data-loss risk.

#### PRD Alignment
Partially supports persistence/search/filtering, but SQLite storage is missing.

#### Recommendation
Define a storage adapter interface and then add SQLite behind it in a later phase.

## 5. Application/Example Assessment

| Area | Status | Assessment |
| --- | --- | --- |
| `apps/dashboard` | SCAFFOLDED | Placeholder only; no dashboard UI or API client. |
| `apps/docs` | SCAFFOLDED | Placeholder only; documentation exists under root `docs/`, not an app. |
| `apps/playground` | SCAFFOLDED | Placeholder only; no runnable playground. |
| `examples/express-basic` | SCAFFOLDED | Placeholder only. |
| `examples/nestjs` | SCAFFOLDED | Placeholder only. |
| `examples/express-prisma` | SCAFFOLDED | Placeholder only. |
| `examples/fastify` | SCAFFOLDED | Placeholder only; Fastify is future scope. |

## 6. Existing Tests

Test framework: Node's built-in `node:test` with `node:assert/strict`.

Test organization:
- Root `test/*.test.js` covers core event factories/capture, storage, CLI, and server.
- `packages/express/src/index.test.js` covers middleware behavior against compiled output.

Coverage tooling is not configured. Tests are a mix of unit-style tests and lightweight integration tests. They test real behavior, but they rely on `dist` files, so `pnpm build` must run before `pnpm test` in a clean checkout.

Command results from this audit:

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm build` | PASS | TypeScript project build completed successfully. |
| `pnpm test` before build completed | FAIL | In a clean/parallel run, tests failed because compiled `dist` files were missing. |
| `pnpm test` after `pnpm build` | PASS | 11/11 tests passed. |

## 7. Build Status

`pnpm build` runs `tsc -b` and succeeds for referenced packages: core, shared, storage, express, cli, and server. TypeScript references are configured for those packages. Placeholder packages/apps are not part of the root TS build. Package `main`/`types` fields point at `dist` for implemented packages. There are no explicit `exports` maps.

## 8. Documentation Status

Existing documentation covers product positioning, architecture, low-level design, API design, database design, event-system design, security design, testing strategy, release process, roadmap, and repository structure. Documentation is useful but ahead of implementation. Notable drift:

- README lists many features as product features even though most are not implemented.
- LLD describes an event bus, masking, validation, plugins, SQLite store, and dashboard modules that do not exist yet.
- Database design describes normalized tables and indexes, but storage is currently JSON file/in-memory only.
- Repository structure describes apps/examples/scripts/benchmarks/.github as fuller surfaces than currently exist.

## 9. PRD Gap Analysis

| PRD Requirement | Current Status | Evidence | Gap | Priority |
| --- | --- | --- | --- | --- |
| HTTP request monitoring | PARTIAL | Core request factory and Express request event test exist. | No request body, route, sanitizer, central lifecycle, or dashboard visibility. | P0 |
| HTTP response monitoring | PARTIAL | Core response factory and Express finish listener exist. | No central policy, no safe body capture, no complete lifecycle handling. | P0 |
| Error monitoring | PARTIAL | Core error factory and captureError exist. | Express/NestJS error integration and dashboard views are missing. | P0 |
| SQLite storage | MISSING | Storage is in-memory or JSON file. | Need SQLite adapter, schema, migrations, retention/indexing. | P0 |
| Dashboard | MISSING | `apps/dashboard` is placeholder. | Need UI and server integration. | P0 |
| Search | PARTIAL | Storage query supports JSON search. | Needs indexed/paginated storage and dashboard UX. | P1 |
| Filtering | PARTIAL | Type, requestId, method, status, source, date, limit filters exist. | Needs robust API validation, pagination, and UI. | P1 |
| Express adapter | PARTIAL | Middleware captures request/response events. | Needs core contract alignment, errors, sanitization, docs/example. | P0 |
| NestJS adapter | MISSING | Placeholder only. | Need package implementation after Express slice. | P1 |

## 10. Architecture Risks

- Core is currently decoupled from Express, NestJS, SQLite, ORMs, server, and dashboard, which is good.
- Event contracts are duplicated across core, shared, storage, and Express objects.
- Express declares core/shared dependencies but does not use them, increasing drift risk.
- Storage depends on core at the manifest level, but durable storage should likely depend on shared contracts or an explicit storage interface.
- The planned event architecture can support REQUEST, RESPONSE, ERROR, DB_QUERY, EXTERNAL_API, AUTH, JOB, and CACHE conceptually, but the current implementation lacks typed extensibility, normalization, and dispatch hooks.
- Server starts at module load, which will make embedding and tests harder.

## 11. Security Risks

- Header capture can include authorization headers, cookies, tokens, and secrets without masking.
- Response body capture can store sensitive payloads without size limits or redaction.
- Request body capture is absent, but future implementation must avoid capturing secrets by default.
- Dashboard/server endpoints are unauthenticated and would expose all stored events if bound beyond localhost.
- File storage writes raw payload JSON without encryption or retention cleanup.

## 12. Performance Risks

- `FileTraceStore.capture()` performs synchronous read-modify-write for every event.
- Querying reads/parses the whole JSON file and filters in memory.
- Large response bodies can be retained in memory by Express middleware before capture.
- Search serializes event payloads with `JSON.stringify` per event.
- Fire-and-forget capture has no backpressure, retry, or failure visibility.

## 13. Current Implementation Status

| Area | Status | Notes |
| --- | --- | --- |
| Monorepo | DONE | pnpm workspaces and TS references exist. |
| Core capture forwarding | PARTIAL | Works with injected sinks, but no real pipeline. |
| Event factories | PARTIAL | Request/response/error events exist, schemas are loose. |
| Express middleware | PARTIAL | Captures request/response lifecycle basics. |
| NestJS adapter | MISSING | Placeholder only. |
| Storage | PARTIAL | Memory/file JSON stores and query filters exist; SQLite missing. |
| Server | PARTIAL | Basic HTTP query API exists; dashboard/auth missing. |
| Dashboard | MISSING | Placeholder only. |
| Search/filtering | PARTIAL | In-memory query over events exists. |
| Tests | PARTIAL | Behavior tests pass after build; no coverage/e2e. |
| Documentation | PARTIAL | Broad docs exist but are ahead of code. |

## 14. Recommended Implementation Order

1. Align Express middleware with core/shared event contracts and prove adapter-to-core-to-store capture in tests.
2. Introduce a clear storage adapter interface without changing durable backend yet.
3. Add safe request/response/error capture policies, including default masking and body-size limits.
4. Implement SQLite storage behind the storage interface.
5. Refactor server into a reusable app/server factory and expose validated dashboard APIs.
6. Build a minimal dashboard list/detail view for HTTP request timelines.
7. Add an `examples/express-basic` vertical-slice app.
8. Add NestJS adapter after the Express slice is stable.

## 15. First Implementation Task

Exactly one first coding task: update `@traceo/express` so `createTraceoMiddleware()` uses the canonical core event factories/contracts for request and response events, preserves request/response correlation, and add/adjust tests proving an Express request flows through the middleware into a `@traceo/storage` store. Do not add SQLite, dashboard UI, new framework adapters, or new dependencies in that task.
