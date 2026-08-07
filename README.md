# Traceo

Traceo is an open-source developer observability platform for Node.js applications. It helps teams inspect requests, responses, errors, database activity, authentication events, and runtime behavior from a self-hosted web dashboard without relying on SSH access or expensive third-party observability tools.

## What is Traceo?
Traceo is a lightweight, developer-first debugging and observability toolkit for Node.js. It is designed to make backend inspection simple by bringing request-level insights into one place.

## Why does it exist?
Debugging modern Node.js applications often means stitching together logs, terminal output, and cloud dashboards. Traceo exists to give developers a unified, self-hosted way to understand what is happening inside their applications in real time.

## Features
- Request and response monitoring
- Error tracking with stack context
- Database query inspection
- External API monitoring
- Authentication event visibility
- Framework integrations for Express and NestJS
- Extensible plugin and storage architecture
- A web dashboard for local and production debugging

## Installation
Install the core package with:

```bash
npm install traceo
```

For framework-specific setup, install the relevant adapter such as:

```bash
npm install @traceo/express
```

## Roadmap
Traceo is currently in its initial milestone focused on project setup, documentation, and repository structure. Upcoming milestones will introduce core packages, framework integrations, CLI tooling, and richer dashboard experiences.

## Contributing
Contributions are welcome. If you would like to help shape Traceo, start by reviewing the documentation, opening an issue, or proposing a feature. The project is intended to grow through community feedback and collaborative development.

## License
Traceo is licensed under the MIT License.
