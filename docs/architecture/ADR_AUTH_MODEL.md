# ADR 001: Authentication Model Selection

## Status

Accepted

## Context

Traceo is an open-source developer observability platform designed for self-hosted Node.js application monitoring. Prior to Phase 6, server APIs and dashboard endpoints operated without authentication boundaries. The PRD requires that the dashboard be protected, disabled in production by default, and capable of supporting multiple authentication strategies (Basic Auth, JWT, API Keys, Custom Middleware).

## Decision

We adopt **Static API Key / Bearer Token Authentication** as the initial self-hosted authentication mechanism for Traceo v0.x, backed by an extensible `TraceoAuthProvider` provider abstraction interface.

### Key Architecture Components:

1. **`TraceoAuthProvider` Contract**:
   ```ts
   export interface AuthResult {
     authenticated: boolean;
     principal?: { id: string; role?: string };
     reason?: string;
     statusCode?: number;
   }

   export interface TraceoAuthProvider {
     authenticate(req: IncomingMessage): Promise<AuthResult> | AuthResult;
   }
   ```
2. **Standard Provider Implementations**:
   - `ApiKeyAuthProvider`: Validates `Authorization: Bearer <key>` or `X-Traceo-Api-Key: <key>` against deployment configuration (`TRACEO_API_KEY` / `config.apiKey`).
   - `NoopAuthProvider`: Allows unauthenticated access when authentication is explicitly disabled in development.
   - `DisabledAuthProvider`: Enforces a 403 Forbidden response when Traceo access is disabled in production (`TRACEO_ENABLED=false`).
3. **Brute-Force Protector**:
   - In-memory rate limiter (`BruteForceProtector`) tracking failed authentication attempts per IP address, enforcing a temporary lockout (429 Too Many Requests) after repeated failed attempts.

## Rationale & Alternatives Considered

- **Why Static API Key / Bearer Token?**
  - Zero database dependency: Does not require user tables, ORMs, email servers, or external identity providers.
  - Aligns with self-hosted developer tools (e.g. Laravel Telescope secret keys, Grafana admin tokens, Prometheus HTTP auth).
  - Simple deployment configuration via environment variables (`TRACEO_API_KEY`).
- **Alternatives Considered**:
  - *Full User DB & Passwords*: Rejected for v0.x due to unnecessary complexity and database maintenance.
  - *OAuth / Identity Provider*: Rejected as a mandatory requirement for basic self-hosted usage.
  - *JWT*: Available as a future provider implementation under the `TraceoAuthProvider` contract.

## Consequences

- The server API endpoints (`/requests`, `/requests/:id`, `/requests/:traceId/timeline`, `/events`) reject unauthenticated requests with `401 Unauthorized` or `403 Forbidden`.
- Health check `GET /health` remains public for infrastructure monitoring without exposing environment variables or internal paths.
- Future authentication methods (JWT, OAuth, Basic Auth, RBAC roles) can be added cleanly by implementing new `TraceoAuthProvider` classes without modifying core route handlers or storage engines.
