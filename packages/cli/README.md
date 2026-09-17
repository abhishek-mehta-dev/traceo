# @traceojs/cli

Command-line interface for [Traceo](https://github.com/abhishek-mehta-dev/traceo). Inspect stored request timelines and query captured events from the terminal.

## Requirements

- Node.js 22 or newer

## Installation

Global:

```bash
npm install -g @traceojs/cli
```

Or run via `npx`:

```bash
npx @traceojs/cli timeline <requestId>
```

## Getting started

Point the CLI at the same storage your app uses:

```bash
export TRACEO_STORAGE=sqlite
export TRACEO_SQLITE_FILE=./traceo.sqlite
```

Then:

```bash
# Show correlated events for one request
traceo timeline <requestId>

# List / filter events
traceo events
traceo events --method GET --status 500 --limit 20
traceo events --type error --search payment
```

## Commands

### `traceo timeline <requestId>`

Prints the event timeline for a single request id (oldest first).

### `traceo events [options]`

Queries stored events.

| Option | Description |
| --- | --- |
| `--type <type>` | Event type filter |
| `--method <method>` | HTTP method filter |
| `--status <code>` | Status code filter |
| `--search <term>` | Text substring |
| `--limit <count>` | Max results |

## Configuration

Uses the same storage environment variables as `@traceojs/storage`:

| Variable | Description |
| --- | --- |
| `TRACEO_STORAGE` | `sqlite`, `json`, or `memory` |
| `TRACEO_SQLITE_FILE` | SQLite path |
| `TRACEO_DATA_FILE` | JSON file path |

## Related packages

- [`@traceojs/express`](https://www.npmjs.com/package/@traceojs/express)
- [`@traceojs/storage`](https://www.npmjs.com/package/@traceojs/storage)

## License

[MIT](https://github.com/abhishek-mehta-dev/traceo/blob/main/LICENSE)
