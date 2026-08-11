# Traceo Dashboard API

The Traceo server (`@traceo/server`) exposes a clean, lightweight HTTP API designed for consumption by the Traceo Dashboard and SDK (`@traceo/dashboard-sdk`).

## Base URL

Default server configuration:
- Host: `127.0.0.1` (configurable)
- Port: `3030` (configurable)
- Base URL: `http://127.0.0.1:3030`

CORS support can be enabled via `corsOrigin` configuration option.

---

## Endpoints

### 1. Health Check

`GET /health`

Returns a simple successful JSON payload confirming server readiness. Does not expose internal secrets or database paths.

#### Response (200 OK)
```json
{
  "status": "ok"
}
```

---

### 2. Request List

`GET /requests`

Returns stored Traceo request-related events in a lightweight, dashboard-friendly summary format.

#### Query Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | integer | `1` | Page number (must be `>= 1`). |
| `limit` | integer | `25` | Items per page (must be `>= 1` and `<= 100`). |
| `sort` | string | `timestamp` | Sort field: `timestamp`, `duration`, `statusCode`. |
| `order` | string | `DESC` | Sort direction: `ASC` or `DESC`. |
| `method` | string | optional | Filter by HTTP method (e.g. `GET`, `POST`). |
| `status` | integer | optional | Filter by numeric HTTP status code (e.g. `200`, `500`). |
| `eventType` | string | optional | Filter by event type (`REQUEST_STARTED`, `REQUEST_COMPLETED`). |
| `traceId` | string | optional | Filter events by specific trace ID. |
| `requestId` | string | optional | Filter events by specific request ID. |
| `search` | string | optional | Free-text search query across event payloads. |

#### Response (200 OK)
```json
{
  "data": [
    {
      "id": "evt-2",
      "traceId": "trace-1",
      "requestId": "req-1",
      "eventType": "REQUEST_COMPLETED",
      "method": "GET",
      "url": "/users",
      "route": "/users",
      "statusCode": 200,
      "durationMs": 42,
      "timestamp": "2026-01-01T00:00:01.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3. Request Detail

`GET /requests/:id`

Returns complete event details and captured metadata for the specified event ID. Masked sensitive keys remain redacted.

#### Response (200 OK)
```json
{
  "id": "evt-2",
  "traceId": "trace-1",
  "requestId": "req-1",
  "eventType": "REQUEST_COMPLETED",
  "method": "GET",
  "url": "/users",
  "route": "/users",
  "statusCode": 200,
  "durationMs": 42,
  "timestamp": "2026-01-01T00:00:01.000Z",
  "request": {
    "method": "GET",
    "url": "/users"
  },
  "response": {
    "statusCode": 200,
    "durationMs": 42
  },
  "payload": {
    "traceId": "trace-1",
    "requestId": "req-1"
  }
}
```

---

### 4. Trace Timeline

`GET /requests/:traceId/timeline`

Returns all events associated with a specific trace ID in chronological order.

#### Response (200 OK)
```json
{
  "traceId": "trace-1",
  "events": [
    {
      "id": "evt-1",
      "traceId": "trace-1",
      "requestId": "req-1",
      "eventType": "REQUEST_STARTED",
      "timestamp": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "evt-2",
      "traceId": "trace-1",
      "requestId": "req-1",
      "eventType": "REQUEST_COMPLETED",
      "timestamp": "2026-01-01T00:00:01.000Z"
    }
  ]
}
```

---

## Error Response Format

Errors return consistent JSON error objects:

```json
{
  "error": "Invalid request",
  "details": "invalid sort"
}
```

### Common HTTP Status Codes

- **400 Bad Request**: Invalid pagination (`page < 1`, `limit > 100`), unapproved sort field, or malformed parameters.
- **404 Not Found**: Request ID not found in storage or unknown endpoint path.
- **500 Internal Server Error**: Unexpected storage or internal server failure (no SQL statements, secrets, or stack traces exposed).
