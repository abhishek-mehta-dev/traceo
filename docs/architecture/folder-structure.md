# Repository Structure

The Traceo repository is organized as a monorepo to separate product surfaces, reusable packages, examples, and documentation.

## Top-level layout
- apps/: user-facing applications such as the dashboard, docs site, and playground.
- packages/: shared libraries and integrations, including core runtime pieces, SDKs, storage adapters, and plugins.
- examples/: runnable sample projects for the main supported frameworks.
- docs/: product, architecture, roadmap, PRD, SRS, and API documentation.
- scripts/: repository automation and maintenance utilities.
- benchmarks/: performance and load-testing assets.
- .github/: GitHub workflows, issue templates, and repository automation.

## Purpose of the initial structure
This layout keeps the project modular from the start and makes it easier to grow the platform without mixing concerns across packages and apps.
