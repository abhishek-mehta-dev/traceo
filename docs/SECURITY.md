# Security Policy

## Reporting a Vulnerability
Please report suspected security issues privately through GitHub rather than opening a public issue.

## Runtime defaults
- The Traceo server binds to `127.0.0.1` unless `TRACEO_HOST` is set.
- The dashboard is disabled when `NODE_ENV=production` unless `TRACEO_DASHBOARD=1`.
- `/health` is public. Event, timeline, and dashboard routes require `TRACEO_BASIC_AUTH` or `TRACEO_API_KEY` when those variables are set.
- Request headers, cookies, and bodies are off by default. Sensitive query values and URLs are redacted before storage.

## Expectations
- Do not publicly disclose vulnerabilities before they are addressed.
- Provide as much detail as possible to help reproduce and remediate the issue.
