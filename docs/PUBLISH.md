# Publishing Traceo to npm

Publishable packages (under `packages/`):

| Package | Install for |
| --- | --- |
| `@traceo/express` | Express apps (pulls server, storage, core) |
| `@traceo/nestjs` | NestJS apps (pulls express + core) |
| `@traceo/cli` | Terminal timeline / events |
| `@traceo/core` | Internal / advanced |
| `@traceo/storage` | Internal / advanced |
| `@traceo/server` | Internal / advanced |
| `@traceo/shared` | Shared types |

Root and `examples/*` stay `"private": true`.

## Prerequisites

1. Node.js **≥ 22** (SQLite uses `node:sqlite`)
2. An npm account with access to the `@traceo` scope
3. Logged in: `npm login`
4. Create the org if needed: https://www.npmjs.com/org/create

## One-time: claim the scope

```bash
npm login
# Ensure you can publish public scoped packages
```

## Publish all packages

From the repo root:

```bash
pnpm install
pnpm build
pnpm test
pnpm pack:check          # optional dry-run of tarball contents
pnpm publish:packages    # publishes packages/* in dependency order
```

`workspace:^` deps are rewritten to real versions by pnpm on publish.

## Publish a single package

```bash
pnpm --filter @traceo/core publish --access public --no-git-checks
```

Publish order if doing it manually:

1. `@traceo/shared`
2. `@traceo/core`
3. `@traceo/storage`
4. `@traceo/server`
5. `@traceo/express`
6. `@traceo/nestjs`
7. `@traceo/cli`

## After publishing — use in production

**Express:**

```bash
npm install @traceo/express
```

**NestJS:**

```bash
npm install @traceo/nestjs
```

See the root [README](../README.md) for `attachTraceo` and env vars.

## Version bumps

Bump every package you intend to release together (keep them aligned at `0.1.x` / `0.2.0`, etc.), then publish.
