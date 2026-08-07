# Development Standards

## 1. Folder Conventions
- Use lowercase folder names.
- Keep package-specific code inside the relevant package folder.
- Preserve a clear separation between apps, packages, examples, and docs.

## 2. Naming Conventions
- Use PascalCase for classes and interfaces.
- Use camelCase for methods and variables.
- Use kebab-case for package names and folder names.
- Use SCREAMING_SNAKE_CASE for constants where appropriate.

## 3. TypeScript Rules
- Prefer strong typing and explicit return types.
- Avoid any unless absolutely necessary.
- Use interfaces for public contracts.
- Favor composition over inheritance.

## 4. Import Rules
- Prefer path aliases over deep relative imports.
- Keep imports grouped by external and internal dependencies.
- Avoid circular dependencies.

## 5. Dependency Rules
- Keep dependencies minimal and purposeful.
- Avoid leaking implementation details across package boundaries.
- Respect package ownership and architecture layers.

## 6. Error Handling Standards
- Use typed errors where possible.
- Do not swallow errors silently.
- Ensure failures degrade safely.

## 7. Logging Standards
- Use structured logs.
- Avoid logging secrets or sensitive payloads.
- Include correlation IDs in logs when available.

## 8. Testing Standards
- Write unit tests for business logic.
- Write integration tests for adapters and storage interactions.
- Add end-to-end tests for dashboard and request capture flows.

## 9. Documentation Standards
- Keep public APIs documented.
- Update documentation when behavior changes.
- Prefer concise and actionable guidance.

## 10. Git Conventions
- Use clear commit messages.
- Keep commits focused and atomic.
- Prefer feature branches for new work.

## 11. Branching Strategy
- main for stable releases
- develop for integration
- feature/* for new work

## 12. Pull Request Guidelines
- Keep PRs scoped and reviewable.
- Include context, motivation, and testing details.
- Ensure CI and validation checks pass.

## 13. Versioning Strategy
- Follow semantic versioning.
- Preserve backward compatibility where feasible.
- Document breaking changes clearly.

## 14. Code Review Checklist
- Does the change match the architecture?
- Is the code clear and maintainable?
- Are tests included where needed?
- Are security and privacy concerns addressed?
