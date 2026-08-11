# API Guide

This guide documents the public APIs that are available in the current Traceo workspace. It reflects the product direction from the PRD: a lightweight Node.js observability toolkit with reusable packages, framework integrations, and clear extension points for contributors.

## Current Status
Traceo has moved beyond the initial repository setup milestone into the core package and framework integration phases. The workspace currently includes:

- `@traceo/core` for creating request, response, and error events.
- `@traceo/storage` for in-memory and file-backed event storage.
- `@traceo/express` for request/response capture in Express-style middleware.
- `@traceo/server` for local HTTP access to captured events.
- `@traceo/cli` for local timeline and event inspection.

## Core package

Use `TraceoCore` to send normalized events to any compatible sink.

```ts
import { TraceoCore, createRequestEvent } from '@traceo/core';
import { InMemoryTraceStore } from '@traceo/storage';

const store = new InMemoryTraceStore();
const traceo = new TraceoCore(store, {
  enabled: true,
  environment: 'development'
});

await traceo.capture(createRequestEvent({
  method: 'GET',
  url: '/health',
  statusCode: 200
}));
```

### Event shape

All packages exchange events with this common shape:

```ts
interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}
```

Current event helpers:

- `createRequestEvent(context)` creates request events.
- `createResponseEvent(context)` creates response events with timing and payload metadata.
- `createErrorEvent(context)` creates error events with stack and request correlation metadata.

## Storage package

`@traceo/storage` exposes two stores:

- `InMemoryTraceStore` for tests, examples, and short-lived processes.
- `FileTraceStore` for local persistence to JSON files.

Both stores support:

- `capture(event)` to store an event.
- `list()` to return all events.
- `listByType(type)` to filter by event type.
- `listByRequestId(requestId)` and `getTimeline(requestId)` for request timelines.
- `query(query)` for filtered event lookup.

Supported query filters:

| Filter | Description |
| --- | --- |
| `type` | Match an event type such as `request`, `response`, or `error`. |
| `requestId` | Match events correlated to a request. |
| `method` | Match the request method stored in the payload. |
| `statusCode` | Match the status code stored in the payload. |
| `source` | Match the package or integration source. |
| `from` / `to` | Restrict events by ISO timestamp range. |
| `search` | Search serialized event metadata and payload values. |
| `limit` | Return only the newest matching events up to the limit. |

## Express middleware

Use `createTraceoMiddleware` to capture correlated request and response events from an Express-compatible request pipeline.

```ts
import express from 'express';
import { FileTraceStore } from '@traceo/storage';
import { createTraceoMiddleware } from '@traceo/express';

const app = express();
const store = new FileTraceStore('./.traceo/events.json');

app.use(createTraceoMiddleware({
  sink: store,
  captureHeaders: true,
  captureResponseBody: false
}));
```

The middleware attaches `traceoRequestId` to the request object, captures a request event immediately, and captures a response event when the response finishes.

## Local server

Run `@traceo/server` to inspect file-backed events over HTTP. The server reads from `TRACEO_DATA_FILE` or defaults to `~/.traceo/events.json`.

Available endpoints:

- `GET /health` returns service health.
- `GET /events` returns filtered events with the same filters as the storage query API.
- `GET /timeline/:requestId` returns events correlated to one request.

## CLI

The CLI reads from `TRACEO_DATA_FILE` or defaults to `~/.traceo/events.json`.

```bash
traceo timeline req-123
traceo events --method GET --status 200 --search orders --limit 10
```

## Extension points

Traceo integrations can plug into the system by implementing the event sink contract:

```ts
interface TraceoEventSink {
  capture(event: TraceEventLike): Promise<void>;
}
```

Future phases should use this contract for NestJS, Fastify, database, and external API integrations so captured data remains queryable through the same storage, server, and CLI surfaces.
