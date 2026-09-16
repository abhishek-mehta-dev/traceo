# Express basic example

This example captures Express requests, responses, and errors into SQLite and serves the Traceo dashboard.

## Run

From the repository root, after `pnpm install` and `pnpm build`:

```bash
pnpm start
```

Then:

1. Open [http://127.0.0.1:3000/orders](http://127.0.0.1:3000/orders)
2. Optionally open [http://127.0.0.1:3000/fail](http://127.0.0.1:3000/fail) to capture an error
3. Inspect the timeline at [http://127.0.0.1:3030/](http://127.0.0.1:3030/)

The API and dashboard bind to localhost only.
