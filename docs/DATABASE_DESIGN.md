# Database Design

## 1. Goals
The storage layer must support efficient event capture, indexing, retention, and future extensibility.

## 2. Core Tables

### events
Stores normalized events for requests, errors, auth events, and other telemetry.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| event_type | TEXT | Request, Error, Query, Auth |
| timestamp | DATETIME | Event time |
| correlation_id | TEXT | For correlating related events |
| source | TEXT | Adapter or plugin name |
| payload | JSON | Event-specific payload |
| metadata | JSON | Context metadata |

### requests
Stores request-specific fields for fast query and dashboard access.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| event_id | TEXT | Foreign key to events |
| method | TEXT | HTTP method |
| url | TEXT | Request URL |
| route | TEXT | Route path |
| status_code | INTEGER | Response code |
| duration_ms | REAL | Request latency |

### errors
Stores error-related metadata.

| Column | Type | Notes |
|---|---|---|
| id | TEXT | Primary key |
| event_id | TEXT | Foreign key to events |
| message | TEXT | Error summary |
| stack | TEXT | Stack trace |
| severity | TEXT | low/medium/high |

## 3. Indexes
- index on timestamp
- index on event_type
- index on correlation_id
- index on route and status_code

## 4. Constraints
- Event payloads should be stored as JSON where possible.
- Sensitive values should be masked before persistence.

## 5. Retention Strategy
- Default retention window: 30 days
- Cleanup jobs remove older data based on configuration

## 6. Cleanup Jobs
- Scheduled retention cleanup
- Optional manual cleanup operation

## 7. Performance Considerations
- Use batched inserts for high-volume telemetry
- Keep frequently queried fields denormalized where useful
- Use pagination and indexing for dashboard queries
