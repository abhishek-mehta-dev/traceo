# Traceo Dashboard API

## Base URL

The Traceo server exposes a lightweight HTTP API for dashboard consumption.

Default base URL:

- http://127.0.0.1:3030

## Endpoints

### Health

GET /health

Response:

```json
{
  "status": "ok"
}
```

### Request list

GET /requests

Supported query parameters:

- page: positive integer, default 1
- limit: positive integer up to 100, default 25
- sort: timestamp | duration | statusCode
- order: ASC | DESC
- method: HTTP method filter
- status: numeric status code filter
- eventType: Traceo event type filter
- traceId: trace identifier filter
- requestId: request identifier filter
- search: free-text search over event content

Response:

```json
{
  "data": [
    {
      "id": "evt-1",
      "traceId": "trace-1",
      "requestId": "req-1",
      "eventType": "REQUEST_COMPLETED",
      "method": "GET",
      "url": "/users",
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

### Request detail

GET /requests/:id

Returns the stored event payload and metadata for the requested event ID.

### Trace timeline

GET /requests/:traceId/timeline

Returns all events that belong to the requested trace ID in chronological order.

## Error responses

- 400: invalid pagination, sorting, or filtering values
- 404: missing resource
- 500: unexpected storage or server failure
