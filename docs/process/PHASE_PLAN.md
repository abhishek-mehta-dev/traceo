# Traceo Phase Plan

Phases 1 through 10 of the first vertical slice are complete.

```text
PHASE 3  Storage Abstraction     ✅
PHASE 4  Safer Capture           ✅
PHASE 5  SQLite Adapter          ✅
PHASE 6  Minimal Dashboard       ✅
PHASE 7  Working Express Example ✅
PHASE 8  NestJS Integration      ✅
PHASE 9  Security / Authentication ✅
PHASE 10 Error Monitoring        ✅
```

## Phase 5 — SQLite Adapter ✅
`SqliteTraceStore` implements `TraceoStorage` using Node's built-in `node:sqlite`. Server and CLI select it through `createTraceoStoreFromEnv()`.

## Phase 6 — Minimal Dashboard ✅
`apps/dashboard/public` is a request list + timeline UI served by `@traceo/server` from `/` and `/dashboard`. `/requests` groups events by request id.

## Phase 7 — Working Express Example ✅
`examples/express-basic` starts an API on port 3000 and the Traceo dashboard on port 3030, both on localhost.

## Phase 8 — NestJS Integration ✅
`@traceo/nestjs` exposes Express-compatible middleware and an exception filter that writes core error events to the injected sink.

## Phase 9 — Security / Authentication ✅
Server binds to `127.0.0.1` by default. Dashboard is off in production unless `TRACEO_DASHBOARD=1`. Optional `TRACEO_BASIC_AUTH` and `TRACEO_API_KEY` protect non-health routes.

## Phase 10 — Error Monitoring ✅
Express `createTraceoErrorHandler` and Nest `createTraceoExceptionFilter` capture request-correlated errors. The dashboard shows error counts and error events on the timeline.

## After Phase 10
PRD items still later: Prisma/Mongoose, live requests, external API/cache/queue monitoring, additional frameworks, plugin marketplace.
