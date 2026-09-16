# Request Pipeline

Traceo's current request pipeline captures Express HTTP lifecycle data and stores canonical core events through the existing storage boundary.

```text
Express request
  -> @traceo/express middleware
  -> @traceo/core HTTP event factories
  -> Canonical Traceo HTTP event
  -> TraceoEventSink-compatible storage
```

## Canonical events

`@traceo/core` owns the framework-agnostic HTTP event contract. The first supported lifecycle event types are:

- `REQUEST_STARTED`
- `REQUEST_COMPLETED`

Both events include an event id, trace id, request id, timestamp, request metadata, and a `source` value of `core`. Completion events also include response metadata with status code, completion timestamp, and duration.

## Express adapter

`@traceo/express` translates Express-compatible request and response data into core factories using a capture policy:

- Method, URL, route, IP, and user agent are captured.
- Query parameters are captured by default; sensitive query names are redacted in both the query object and the URL.
- Headers, cookies, request bodies, and response bodies are off by default.
- When body capture is enabled, core stores a redacted, size-limited preview (`maxBodyBytes`, default 2048) plus `payloadSizeBytes` and `bodyTruncated`.
- `createTraceoErrorHandler` records correlated `error` events when `next(error)` is used.

## Storage boundary

The middleware writes canonical events to the configured `TraceoEventSink`. Any `TraceoStorage` implementation satisfies that capture boundary. Tests prove Express output reaches both in-memory and JSON file stores. See [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md).

## Sensitive data

Redaction happens before persistence:

1. Core factories redact sensitive metadata keys (authorization, tokens, API keys, passwords, cookies, session, JWT, card numbers, and caller-supplied `maskKeys`), redact all cookie values, sanitize secret query parameters in URLs, and truncate/redact captured bodies.
2. Storage adapters apply the same class of protections so a bypass of core cannot persist obvious secrets.

Configurable production authentication remains a later phase.
