# Storage Architecture

Traceo persists observability events through a storage contract, not through a specific engine.

```text
Traceo Event
     ↓
Storage Contract (TraceoStorage)
     ├── InMemoryTraceStore
     ├── FileTraceStore / JsonFileTraceStore
     └── SqliteTraceStore
```

SQLite is implemented as another adapter behind the same contract. Express, core, server, and the dashboard do not import SQLite APIs.

`createTraceoStoreFromEnv()` chooses the engine:

- `TRACEO_STORAGE=memory`
- `TRACEO_STORAGE=json` or a `TRACEO_DATA_FILE` ending in `.json`
- `TRACEO_STORAGE=sqlite` (default), file from `TRACEO_SQLITE_FILE` or `~/.traceo/events.sqlite`

## Capture path

```text
Express request
  → @traceojs/express middleware
  → @traceojs/core HTTP event factories
  → TraceoEventSink.capture() / TraceoStorage.capture()
  → InMemoryTraceStore or FileTraceStore
```

`@traceojs/express` depends on the core sink abstraction. It does not import a storage engine.

`@traceojs/core` creates events and forwards them to whatever sink was injected. It does not import filesystem or JSON storage.

`@traceojs/server` and `@traceojs/cli` query `TraceoStorage`. Their HTTP/CLI entrypoints may choose a default JSON file store at the composition root (`TRACEO_DATA_FILE` or `~/.traceo/events.json`). Request handlers and commands do not read that file themselves.

## Contract

`TraceoStorage` is async so future adapters (SQLite included) can perform I/O naturally:

- `capture(event)` — persist one event
- `getById(id)` — return that event or `null`
- `query(options)` — filter events
- `getTimeline(requestId)` — correlated events for one request
- `cleanup({ olderThan })` — delete older events; returns the removed count. Without `olderThan`, this is a no-op.
- `clear()` — delete every stored event; returns the removed count
- `close()` — release resources; later calls fail with a closed-storage error

Query filters preserved from the current implementation:

- `type`
- `requestId`
- `method`
- `statusCode`
- `source`
- `from` / `to`
- `search`
- `limit`

## Timeline identifier

Timelines are keyed by **requestId**.

Matching uses `payload.requestId`, and falls back to `payload.traceId` when `requestId` is absent. Canonical HTTP events include both.

Timeline order is oldest-first by `timestamp`. Events with the same timestamp keep capture order. Query results remain newest-first.

## Redaction boundary

Sensitive values are redacted before persistence:

1. Core HTTP factories redact obvious secret metadata, URL query secrets, cookie values, and size-limited bodies when creating events.
2. Storage adapters apply the same class of redaction to `payload.request` / `payload.response` so a bypass of core cannot persist plaintext tokens, authorization headers, cookies, card numbers, or oversized bodies.

Storage does not weaken core redaction. Authentication and production dashboard defaults remain later phases.

## Errors

Callers receive `TraceoStorageError` with stable codes (`INVALID_EVENT`, `UNAVAILABLE`, `CLOSED`). Public messages do not include filesystem paths or raw engine errors.

## Why JSON, memory, and SQLite

Memory and JSON remain available for tests and simple local use. SQLite is the default durable engine. PostgreSQL and MySQL remain later optional adapters.
