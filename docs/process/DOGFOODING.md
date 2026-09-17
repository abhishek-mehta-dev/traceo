# Traceo Dogfooding

Phase 11 validated the current Express vertical slice against an existing production-shaped Express app. No new dashboard sections, storage engines, or event types were added.

## Application

- Application: `amity-ai-assistant-backend` (`/home/itx/projects/amity-ai-assistant-backend`)
- Node.js version: v22.23.2
- Express version: ^4.19.2
- Traceo commit/version: `9661e98` plus a dogfooding fix in `summarizeRequests` / `createTraceoErrorHandler` (4xx status no longer overwritten by a default error status)
- Environment: local Linux, MongoDB on `127.0.0.1:27017`, Amity API `http://127.0.0.1:8000`, Traceo dashboard `http://127.0.0.1:3031`, crons disabled (`ENABLE_CRONS=false`)

## Integration

- [x] Traceo middleware integrated
- [x] Traceo error handler integrated
- [x] SQLite storage working (`amity-ai-assistant-backend/traceo.sqlite`)
- [x] Dashboard accessible

Integration uses the same production shape locally: `attachTraceo(app)` from `@traceojs/express` (installed as a normal dependency). With `TRACEO_ENABLED=true`, capture and the dashboard run on the Amity Express port under `/traceo`. No separate dashboard process and no `TRACEO_ROOT` loader. Nginx only exposes that path publicly in production.

## Request Tests

- [x] GET request (`GET /api/jsnhere` → 200 `Success`)
- [x] POST request (`POST /api/auth/login`, `POST /traceo-dogfood/echo`)
- [x] 2xx response
- [x] 4xx response (`POST /api/auth/login` → 422)
- [x] 404 request (`GET /api/traceo-test-route-that-does-not-exist` → 404)
- [x] 5xx error (`GET /traceo-dogfood/error` → 500, message `Traceo dogfooding test error`)
- [x] Request body
- [x] Response body

Captured fields that worked: method, URL, request id, trace id (same value as request id in the current core factories), timestamp, duration, status code (after the summary fix), client IP, user agent, request/response headers, request/response bodies when capture is enabled.

## Dashboard Tests

- [x] Request list
- [x] Request detail
- [x] Search (`search=jsnhere`, `search=health`)
- [x] Status filtering (`statusFamily=2|4|5`)
- [x] Fault filtering (`faults=1`)
- [x] Pagination
- [x] Timeline (`REQUEST_STARTED` → `REQUEST_COMPLETED`; errors insert `error` between them)
- [x] Error section (`/errors` correlated by request id, stack present)
- [x] JSON tree
- [x] Raw JSON
- [x] Live polling (newest request id changed after a new hop without restart)
- [x] Pause
- [x] Refresh

Pause, refresh, JSON tree, and raw JSON were confirmed present in the served dashboard UI. List/search/filter/pagination/timeline/errors/live updates were exercised through the dashboard HTTP API that the UI uses.

## Security Tests

- [x] Authorization header redaction (`authorization: [REDACTED]`)
- [x] Cookie redaction (header and `cookies.session`)
- [x] API key redaction (`x-api-key: [REDACTED]`)
- [x] Body redaction where applicable (`password` and `token` → `[REDACTED]`, `note` left intact)
- [x] No unexpected secret exposure (`test-secret-token`, `test-secret`, `test-api-key`, `super-secret-password`, `body-secret-token` were absent from stored timelines)

The application still received the real secrets and returned them in its own HTTP response. Traceo storage/dashboard did not persist them.

## Persistence

- [x] Data survives restart (9 requests still present after killing and restarting Amity + Traceo against the same SQLite file)

## Volume Test

- [x] 100 requests
- [x] 500 requests

Volume used `GET /traceo-dogfood/health` so Amity's `/api` rate limit (100/min) did not block the product test.

| Burst | Time | Approx RPS | RSS delta | SQLite delta | Dashboard |
| --- | --- | --- | --- | --- | --- |
| 100 | 0.74s | 136 | +4.2 MB | +200 KB | count 113, page 2 worked, search `health` = 102 |
| 500 | 3.78s | 133 | +30 MB | +983 KB | count 613, 62 pages, search `health` = 602 |

Starting RSS ~135 MB; ending RSS ~174 MB; SQLite ~1.2 MB. The app and dashboard stayed responsive. This is not a leak proof, only a short observation.

## Issues Found

### Issue 1

Description: Request summaries showed 4xx traffic as status 500. `createTraceoErrorHandler` recorded `statusCode: 500` before the app set the real status, and `summarizeRequests` let that overwrite `REQUEST_COMPLETED.response.statusCode`.

Steps to reproduce: `POST /api/auth/login` with an invalid body (HTTP 422) or `GET` a missing `/api` route (HTTP 404), then open `/requests`.

Expected: List status matches the HTTP response (422 / 404).

Actual: Before the fix, both appeared as 500 with `errorCount: 1`. After the fix, 422 and 404 are shown correctly.

Severity: High for dashboard correctness. Fixed during dogfooding without changing the error event schema.

### Issue 2

Description: Amity's 404 and validation failures call `next(ApiError)`, so Traceo records an `error` event. Those hops have `errorCount: 1` and appear under Faults / Errors even when the HTTP status is 4xx.

Steps to reproduce: Hit a missing route or fail Joi validation; open Faults.

Expected: Product-wise, some teams would treat 404/422 as requests only.

Actual: This matches the current error-handler design (any `next(error)` is an error event). Not changed.

Severity: Medium / product decision. Do not silently drop 4xx errors without an explicit phase.

### Issue 3

Description: Amity `/api` is globally rate-limited at 100 requests/minute. A 500-request burst against real `/api` routes would mostly return 429.

Steps to reproduce: Send >100 `/api/*` requests in one minute from one IP.

Expected: Volume test of capture, not of Amity's limiter.

Actual: Volume was run on `/traceo-dogfood/health`, which is mounted outside `/api`.

Severity: Low. Documented, not a Traceo defect.

## Observations

- Middleware order matters: Traceo must run after `cookie-parser` and `express.json` or cookies/bodies are empty at start.
- Default body cap (2048 bytes) truncated a ~5 KB JSON body (`bodyTruncated: true`, stored body length 2048). The app still returned the full 5034-byte response.
- `requestId` and `traceId` are currently the same `trace-…` value from core factories.
- Dashboard pagination and search stayed usable at 613 hops (page size 10/25, `hasPrev`/`hasNext` correct).
- SQLite on `node:sqlite` is experimental on Node 22 (runtime warning only).
- RSS rose ~38 MB across ~600 extra GETs. Worth watching in a later performance phase; not treated as an architecture rewrite here.

## Conclusion

The current Traceo Express vertical slice works with a real existing Express application. Capture, dashboard inspect, timeline, errors, redaction, body limits, SQLite restart persistence, search/filter/pagination, and live updates all functioned. One summary bug (4xx shown as 500) was fixed. The main product follow-up is whether 4xx `next(error)` hops should count as Faults.

Recommended next phase: decide Faults vs 4xx error-event policy, then consider CLI `bin`, memory-growth measurement, or Nest dogfooding — not new storage engines.
