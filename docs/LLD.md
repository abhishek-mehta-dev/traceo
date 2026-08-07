# Low Level Design (LLD)

## 1. Objective
The low-level design defines the internal structure of Traceo packages, services, interfaces, and data contracts required to implement the platform in a maintainable and extensible way.

## 2. Package Overview

### 2.1 packages/core
**Responsibility**
- Own the shared domain model and core abstractions.

**Public APIs**
- Event envelope interfaces
- Trace context model
- Base plugin contract
- Configuration schema

**Internal Components**
- EventNormalizer
- EventCorrelator
- MaskingService
- ValidationService

**Dependencies**
- packages/shared
- packages/storage

**Extension Points**
- Custom event processors
- Additional masking rules

### 2.2 packages/express
**Responsibility**
- Provide Express integration for request and response capture.

**Public APIs**
- createTraceoMiddleware()
- Express adapter registration API

**Internal Components**
- RequestCaptureMiddleware
- ResponseCaptureMiddleware
- ContextExtractor

**Dependencies**
- packages/core
- packages/shared

**Extension Points**
- Custom middleware hooks
- Request body policies

### 2.3 packages/nestjs
**Responsibility**
- Provide NestJS integration for application-level observability.

**Public APIs**
- TraceoModule
- TraceoInterceptor

**Internal Components**
- InterceptorPipeline
- ExceptionHandlerBridge

**Dependencies**
- packages/core

**Extension Points**
- Custom filters and guards

### 2.4 packages/storage
**Responsibility**
- Provide persistence abstractions and storage adapters.

**Public APIs**
- StorageAdapter interface
- EventRepository
- RetentionPolicy

**Internal Components**
- SQLiteStore
- RepositoryImpl
- CleanupJob

**Dependencies**
- packages/core

**Extension Points**
- PostgreSQL adapter
- MongoDB adapter

### 2.5 packages/shared
**Responsibility**
- Provide shared utilities, DTOs, and contracts.

**Public APIs**
- Common DTOs
- Error codes
- Utility functions

**Dependencies**
- None

## 3. Core Domain Models

### EventEnvelope
```ts
interface EventEnvelope {
  id: string;
  type: EventType;
  timestamp: string;
  source: string;
  correlationId?: string;
  metadata: Record<string, unknown>;
  payload: Record<string, unknown>;
}
```

### RequestEvent
```ts
interface RequestEvent extends EventEnvelope {
  method: string;
  url: string;
  route?: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body?: unknown;
  user?: Record<string, unknown>;
}
```

### ErrorEvent
```ts
interface ErrorEvent extends EventEnvelope {
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high';
}
```

## 4. Service Layer Design

### EventDispatcherService
**Responsibility**
- Route normalized events to subscribers.

**Responsibilities**
- Accept normalized events
- Publish to event bus
- Trigger plugin hooks

### EventProcessorService
**Responsibility**
- Apply masking, normalization, and correlation rules.

### StorageService
**Responsibility**
- Persist events and support queries.

## 5. Event Bus Design
The event bus will provide asynchronous publish/subscribe behavior with support for:
- synchronous and asynchronous subscribers
- retry policies
- backpressure-aware buffering
- plugin hooks

## 6. Repository Layer
The repository layer abstracts storage operations for:
- requests
- errors
- queries
- auth events
- system events

## 7. API Layer
The API layer will expose REST endpoints for:
- dashboard overview
- requests
- errors
- search
- plugins
- settings

## 8. Middleware Design
Framework adapters will use middleware or interceptors to capture request lifecycle events with minimal intrusion.

## 9. Dashboard Design
The dashboard will consume API responses for list and detail views. Each domain type will have its own module and detail panel.

## 10. Plugin Interfaces
```ts
interface TraceoPlugin {
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  destroy?(): Promise<void>;
}
```

## 11. Future Extension Points
- Additional framework adapters
- Custom storage backends
- GraphQL or WebSocket interfaces
- Team-based workspace support
