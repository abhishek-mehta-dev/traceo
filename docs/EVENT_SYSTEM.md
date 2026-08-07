# Event System Design

## 1. Overview
Traceo uses an internal event-driven architecture to decouple instrumentation, enrichment, persistence, and dashboard consumption.

## 2. Event Bus
The event bus provides publish/subscribe capabilities with asynchronous dispatch and plugin hooks.

## 3. Event Types
- RequestCaptured
- ResponseCaptured
- ErrorCaptured
- QueryCaptured
- AuthEventCaptured
- PluginLifecycleEvent

## 4. Publishers
- Framework adapters
- Middleware and interceptors
- Plugin hooks

## 5. Subscribers
- EventProcessorService
- StorageService
- Dashboard sync components
- Alerting or notification integrations

## 6. Lifecycle Events
- plugin:initialized
- plugin:enabled
- plugin:disabled
- plugin:teardown

## 7. Event Ordering
- Preserve event ordering within a single request context when possible.
- Use correlation IDs for cross-event association.

## 8. Retry Strategy
- Retry transient failures with exponential backoff.
- Persist failed events to a retry queue where appropriate.

## 9. Design Rationale
An event bus improves extensibility and allows the platform to evolve without hard-coding every integration path into the core engine.
