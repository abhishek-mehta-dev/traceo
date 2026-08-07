# API Design

## 1. Overview
Traceo will expose REST APIs for dashboard access, search, plugin management, and settings.

## 2. Authentication APIs

### POST /api/auth/login
**Description**  
Authenticate a user and return a session token.

**Request Body**
```json
{
  "username": "admin",
  "password": "secret"
}
```

**Response**
```json
{
  "token": "jwt-token"
}
```

**Error Codes**
- 401 Unauthorized

## 3. Dashboard APIs

### GET /api/dashboard/overview
**Description**  
Return summary metrics for requests, errors, and recent activity.

**Response**
```json
{
  "requestCount": 120,
  "errorCount": 8,
  "activeUsers": 3
}
```

## 4. Request APIs

### GET /api/requests
**Description**  
List requests with filters and pagination.

**Query Parameters**
- page
- limit
- method
- status
- search

## 5. Error APIs

### GET /api/errors
**Description**  
List captured errors with optional filters.

## 6. Search APIs

### GET /api/search
**Description**  
Search across requests, errors, and query events.

## 7. Plugin APIs

### GET /api/plugins
**Description**  
List installed plugins and their status.

## 8. Settings APIs

### GET /api/settings
**Description**  
Return configuration and dashboard settings.
