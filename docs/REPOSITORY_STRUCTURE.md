# Repository Structure

## 1. Monorepo Overview
Traceo uses a monorepo structure to keep the platform modular while allowing independent development of applications, packages, examples, and documentation.

## 2. Top-Level Directories

### apps/
Purpose: user-facing applications such as the dashboard, documentation site, and playground.

### packages/
Purpose: reusable libraries and integrations, including core runtime logic, adapters, shared utilities, storage, and plugins.

### examples/
Purpose: runnable sample applications demonstrating usage with Express, NestJS, Prisma, and Fastify.

### docs/
Purpose: product, architecture, engineering, and contributor documentation.

### scripts/
Purpose: tooling, automation, and repository maintenance tasks.

### benchmarks/
Purpose: performance and load testing assets.

### .github/
Purpose: GitHub workflows, issue templates, labels, and milestone definitions.

## 3. Proposed Package Layout
- apps/dashboard
- apps/docs
- apps/playground
- packages/core
- packages/express
- packages/nestjs
- packages/dashboard-sdk
- packages/storage
- packages/shared
- packages/cli
- packages/plugins

## 4. Design Rationale
A monorepo improves code reuse, cross-package consistency, and contributor onboarding while reducing fragmentation across repositories.
