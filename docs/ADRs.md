# Architecture Decision Records

## ADR-001: Why TypeScript
**Context**  
Traceo targets Node.js developers and requires strong typing for maintainability and contributor experience.

**Decision**  
Use TypeScript as the primary implementation language.

**Alternatives Considered**  
- JavaScript only
- Flow

**Pros**  
- Better editor support
- Safer refactoring
- Improved maintainability

**Cons**  
- Slightly higher setup overhead

**Consequences**  
The codebase will be easier to reason about and evolve over time.

## ADR-002: Why Plugin Architecture
**Context**  
The platform needs to support many integrations without coupling the core to specific frameworks.

**Decision**  
Adopt a plugin-based architecture with explicit contracts.

**Alternatives Considered**  
- Monolithic framework-specific integration
- Hard-coded adapters

**Pros**  
- Extensibility
- Cleaner boundaries
- Easier community contribution

**Cons**  
- More architectural complexity

**Consequences**  
Core behavior remains reusable across integrations.

## ADR-003: Why Event Bus
**Context**  
Traceo needs to decouple capture, processing, persistence, and dashboard consumption.

**Decision**  
Introduce an internal event bus for asynchronous processing.

**Alternatives Considered**  
- Direct service calls
- Queue-only approach

**Pros**  
- Decoupling
- Better extensibility
- Easier background processing

**Cons**  
- Additional complexity

**Consequences**  
The platform can scale processing independently of ingestion.

## ADR-004: Why SQLite Default Storage
**Context**  
The initial release should be simple to adopt and easy to self-host.

**Decision**  
Use SQLite as the default storage backend.

**Alternatives Considered**  
- PostgreSQL first
- In-memory storage

**Pros**  
- Zero-config setup
- Works well for local and small deployments
- Low operational overhead

**Cons**  
- Less suitable for very large scale deployments

**Consequences**  
Early adopters get a frictionless setup experience.

## ADR-005: Why Background Processing
**Context**  
Instrumentation must avoid adding significant latency to request handling.

**Decision**  
Use background processing and batching for persistence and enrichment tasks.

**Alternatives Considered**  
- Synchronous persistence
- Blocking writes per event

**Pros**  
- Lower request overhead
- Better throughput

**Cons**  
- Event delivery may be slightly delayed

**Consequences**  
The platform can remain responsive while still preserving observability data.

## ADR-006: Why Modular Packages
**Context**  
A monorepo should remain maintainable and allow independent evolution of subsystems.

**Decision**  
Split the platform into modular packages with clear responsibilities.

**Alternatives Considered**  
- Single package for everything
- Hybrid package structure with unclear boundaries

**Pros**  
- Clear ownership
- Easier testing
- Better scaling of contribution

**Cons**  
- Requires discipline in package boundaries

**Consequences**  
The project can grow without becoming tightly coupled.
