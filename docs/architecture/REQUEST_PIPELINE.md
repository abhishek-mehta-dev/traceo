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

`@traceo/express` translates data available from Express-compatible request and response objects into the core factories. It captures method, URL, route when available, query parameters, headers when enabled, cookies when available, IP, user agent, response status, completion timestamp, and duration.

Response body capture remains opt-in and limited to the pre-existing `captureResponseBody` behavior. Broader body capture and safer production controls remain future work.

## Storage boundary

The middleware writes canonical events to the configured `TraceoEventSink`. Tests use the existing in-memory storage implementation to prove actual persisted data rather than only spying on method calls.

## Sensitive data

Core event normalization redacts metadata keys containing obvious sensitive terms such as authorization, password, token, cookie, or secret. Cookie values are redacted when cookies are captured. This is a minimal Phase 2 safety boundary; configurable production masking remains future work.
