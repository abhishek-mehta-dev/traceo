# Traceo Dashboard Architecture & Design

The Traceo Dashboard (`apps/dashboard`) is a React-based web application providing a developer-focused inspection interface for Node.js request traces and telemetry.

## Architecture

```text
React Dashboard (apps/dashboard)
      ↓
API Integration Layer (services/api.ts)
      ↓
@traceo/dashboard-sdk (TraceoClient)
      ↓
@traceo/server (Traceo HTTP API)
      ↓
TraceoStorage (SQLiteTraceStore / InMemoryTraceStore)
```

## Core Modules & Pages

1. **Overview Page (`src/pages/OverviewPage.tsx`)**:
   - Metrics cards derived from captured event data: Total Requests, Successful (2xx) count, Errors (4xx/5xx) count, Average Response Time (ms).
   - Recent activity list with quick navigation to request detail.

2. **Requests Page (`src/pages/RequestsPage.tsx`)**:
   - Filter bar: Method (GET, POST, PUT, DELETE, PATCH), Status Code, Event Type (`REQUEST_STARTED`, `REQUEST_COMPLETED`), and 300ms debounced free-text Search input.
   - Server-side sorting selectors (`timestamp`, `duration`, `statusCode` with `ASC`/`DESC` toggle).
   - Information-dense data table with `HttpMethodBadge` and `StatusBadge`.
   - Pagination bar with page size selection and total page metadata.
   - Synchronizes state to `URLSearchParams` for deep linking and refresh preservation.

3. **Request Detail Page (`src/pages/RequestDetailPage.tsx`)**:
   - Metadata grid: Request ID, Trace ID, Event Type, Timestamp, Duration.
   - Tabbed inspector:
     - **Request**: Headers, Query Parameters, Cookies, Request Body.
     - **Response**: Status Code, Response Headers, Response Body.
     - **Timeline**: Chronological events belonging to the trace ID.
   - Rendered using safe, syntax-highlighted `JsonViewer` with copy-to-clipboard functionality. Redacted sensitive keys (`[REDACTED]`) are preserved.

4. **Settings Page (`src/pages/SettingsPage.tsx`)**:
   - Configuration summary and placeholder for future storage/alert settings.

## Design Tokens & Styling

- Styling is built using Vanilla CSS with CSS variables (`src/index.css`).
- Dark mode developer theme (Slate/Zinc palette) using Inter for UI text and JetBrains Mono for code, payloads, paths, and status badges.
- Accessible status indicators using both color codes and textual values.

## Security Considerations

- All API payload data is rendered as text inside standard DOM nodes (`JsonViewer`). No `dangerouslySetInnerHTML` is used.
- Masked sensitive data (`[REDACTED]`) produced by core/storage normalization is strictly preserved.
- Dashboard authentication is intentionally deferred to a future dedicated security phase.
