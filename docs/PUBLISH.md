# Publishing Traceo to npm

Publishable packages (under `packages/`):

| Package | Install for |
| --- | --- |
| `@traceojs/express` | Express apps (pulls server, storage, core) |
| `@traceojs/nestjs` | NestJS apps (pulls express + core) |
| `@traceojs/cli` | Terminal timeline / events |
| `@traceojs/core` | Internal / advanced |
| `@traceojs/storage` | Internal / advanced |
| `@traceojs/server` | Internal / advanced |
| `@traceojs/shared` | Shared types |

Root and `examples/*` stay `"private": true`.

## Prerequisites

1. Node.js **≥ 22** (SQLite uses `node:sqlite`)
2. An npm account with access to the `@traceojs` scope
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
pnpm --filter @traceojs/core publish --access public --no-git-checks
```

Publish order if doing it manually:

1. `@traceojs/shared`
2. `@traceojs/core`
3. `@traceojs/storage`
4. `@traceojs/server`
5. `@traceojs/express`
6. `@traceojs/nestjs`
7. `@traceojs/cli`

## After publishing — use in production

**Express:**

```bash
npm install @traceojs/express
```

**NestJS:**

```bash
npm install @traceojs/nestjs
```

See the root [README](../README.md) for `attachTraceo` and env vars.

## Version bumps

Bump every package you intend to release together (keep them aligned at `0.1.x` / `0.2.0`, etc.), then publish.
