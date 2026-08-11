# Traceo Security & Access Control Guide

## Security Model Overview

Traceo captures and stores production application HTTP request/response payloads, headers, cookies, and trace metadata. Securing access to the Traceo server API and Dashboard is critical to prevent unauthorized exposure of sensitive operational data.

```text
HTTP Request
     ↓
Security Headers & CORS Checks
     ↓
TraceoAuthProvider (ApiKeyAuthProvider / NoopAuthProvider / DisabledAuthProvider)
     ↓
BruteForceProtector (Rate Limiting)
     ↓
Protected Data Route Handler
     ↓
TraceoStorage (SQLiteTraceStore)
```

---

## 1. Authentication & Access Control

Access protection is enforced at the server boundary (`@traceo/server`):

- **Protected Endpoints**: `GET /requests`, `GET /requests/:id`, `GET /requests/:traceId/timeline`, `GET /events`, `GET /timeline/:id`.
- **Authentication Header**: Clients must supply credentials via `Authorization: Bearer <api-key>` or `X-Traceo-Api-Key: <api-key>`.
- **Verification Endpoint**: `POST /auth/verify` validates credentials and returns `{ authenticated: true }` (200 OK) or `401 Unauthorized`.
- **Public Endpoints**: `GET /health` remains public for infrastructure health checks, returning `{ status: "ok" }` without exposing internal database paths, stack traces, or environment secrets.

---

## 2. Production Safety Defaults

Traceo is designed with safe production defaults:

- **Production Disabled Posture**: Setting `TRACEO_ENABLED=false` or `config.enabled = false` enforces a `DisabledAuthProvider` that blocks all dashboard API endpoints with `403 Forbidden`.
- **Environment Configuration**: Configure credentials securely via environment variables:
  - `TRACEO_API_KEY`: Secret API key for authentication.
  - `TRACEO_ENABLED`: Set to `false` in production if dashboard access should be completely disabled.
  - `TRACEO_CORS_ORIGIN`: Explicit allowed origin for CORS preflight.

---

## 3. Brute-Force & Rate Limiting Protection

To protect against brute-force credential discovery, `@traceo/server` includes an in-memory `BruteForceProtector`:
- Tracks failed authentication attempts per remote IP address.
- Exceeding maximum allowed failures (5 attempts within 60 seconds) triggers a temporary lockout (`429 Too Many Requests`).
- Successful authentication clears failure counters for the remote IP address.

---

## 4. Security Headers & CORS

Every HTTP response emitted by `@traceo/server` includes the following production security headers:

| Header | Value | Purpose |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing vulnerabilities. |
| `X-Frame-Options` | `DENY` | Protects against clickjacking. |
| `Referrer-Policy` | `no-referrer` | Prevents leaking sensitive request URLs in referrer headers. |
| `Cache-Control` | `no-store, no-cache, must-revalidate, private` | Disables caching of sensitive API telemetry. |
| `Content-Security-Policy` | `default-src 'self'` | Restricts executable script/asset sources. |

### CORS Configuration
- If `corsOrigin` is specified, `Access-Control-Allow-Origin` is restricted strictly to the configured origin.
- `Access-Control-Allow-Headers` permits `Content-Type, Authorization, X-Traceo-Api-Key`.
- Wildcard `*` origins are avoided for authenticated endpoints.

---

## 5. Sensitive Data Masking

Phase 2 & 3 redaction policies remain strictly active:
- Application keys matching sensitive patterns (`authorization`, `password`, `token`, `cookie`, `secret`) are redacted to `[REDACTED]` prior to SQLite serialization.
- Log output and error responses never echo raw API keys, bearer tokens, or database passwords.

---

## 6. Threat Model & Limitations

- **Self-Hosted Boundaries**: Traceo v0.x uses static API keys designed for internal developer team usage. Full RBAC (users, roles, permissions) and OAuth/SSO integration are deferred to future security releases.
- **In-Memory Rate Limiting**: The brute-force protector uses per-instance in-memory tracking suitable for single-process deployments.
