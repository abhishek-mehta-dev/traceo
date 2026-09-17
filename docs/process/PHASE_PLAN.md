# Traceo Phase Plan

Phases 1 through 11 of the first vertical slice and Express dogfooding are complete.

```text
PHASE 3  Storage Abstraction     ✅
PHASE 4  Safer Capture           ✅
PHASE 5  SQLite Adapter          ✅
PHASE 6  Minimal Dashboard       ✅
PHASE 7  Working Express Example ✅
PHASE 8  NestJS Integration      ✅
PHASE 9  Security / Authentication ✅
PHASE 10 Error Monitoring        ✅
PHASE 11 Express dogfooding      ✅
```

## Phase 5 — SQLite Adapter ✅
`SqliteTraceStore` implements `TraceoStorage` using Node's built-in `node:sqlite`. Server and CLI select it through `createTraceoStoreFromEnv()`.

## Phase 6 — Minimal Dashboard ✅
`apps/dashboard/public` is a request list + timeline UI served by `@traceojs/server` from `/` and `/dashboard`. `/requests` groups events by request id.

## Phase 7 — Working Express Example ✅
`examples/express-basic` starts an API on port 3000 and the Traceo dashboard on port 3030, both on localhost.

## Phase 8 — NestJS Integration ✅
`@traceojs/nestjs` exposes Express-compatible middleware and an exception filter that writes core error events to the injected sink.

## Phase 9 — Security / Authentication ✅
Server binds to `127.0.0.1` by default. Dashboard is off in production unless `TRACEO_DASHBOARD=1`. Optional `TRACEO_BASIC_AUTH` and `TRACEO_API_KEY` protect non-health routes.

## Phase 10 — Error Monitoring ✅
Express `createTraceoErrorHandler` and Nest `createTraceoExceptionFilter` capture request-correlated errors. The dashboard shows error counts and error events on the timeline.

## Phase 11 — Real Express dogfooding ✅
`amity-ai-assistant-backend` runs `@traceojs/express` with SQLite and the dashboard. Results: [DOGFOODING.md](DOGFOODING.md).

## After Phase 11
PRD items still later: Prisma/Mongoose, live request streaming, additional frameworks, plugin marketplace. Next implementation phase should follow issues in [DOGFOODING.md](DOGFOODING.md).
