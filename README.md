# Safe / Not Safe

A local-first Postgres migration safety checker for developers.

Paste a migration, parse it in the browser with `libpg_query`, and get a clear
`SAFE`, `NOT SAFE`, or `NEEDS CONTEXT` verdict before deploy.

## Why

Schema migrations fail in boring but expensive ways: blocking indexes, table
rewrites, validating constraints, transaction-wrapped DDL, and rollout-incompatible
renames. Safe / Not Safe catches the common traps while keeping raw SQL local.

## Architecture

- Vinext + React app shell
- `@libpg-query/parser` WASM for every authoritative parse
- Eagerly initialized browser Web Worker for parser/rules execution
- Neutral loading/error states instead of heuristic safety verdicts
- TypeScript rules catalog for migration risk checks
- No backend, no database, no SQL logging

## Deployment

The production target is Cloudflare Workers. Pull requests run typechecking,
tests, and a production build; pushes to `main` run the same checks and then
deploy the existing `safe-not-safe-worker` Worker with
`.github/workflows/ci-deploy.yml`.

Before the first deployment, add these GitHub Actions repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` created with the **Edit Cloudflare Workers** template

The checked-in `wrangler.jsonc` configures the Worker entry point, static asset
binding, and Cloudflare Images binding. It intentionally has no D1, R2, KV,
auth, or application-secret bindings. Vite emits the browser parser worker and
`libpg_query` WASM into `dist/client`, which Wrangler uploads with the app.

To deploy manually with Wrangler credentials configured locally:

```bash
npm ci
npm run typecheck
npm test
npm run deploy
```

Wrangler reports the generated `*.workers.dev` URL after a successful deploy.
If the repository is already connected to Cloudflare Workers Builds, disable
that build trigger after this GitHub Actions workflow is enabled so two
pipelines do not race to deploy the same Worker. A custom domain can be attached
later in Cloudflare.

## Local Development

```bash
npm install
npm run dev
npm test
```

Useful checks:

```bash
npm run test:unit
npm run build
npx tsc --noEmit
```

## Current Rule Coverage

- regular `CREATE INDEX` vs `CREATE INDEX CONCURRENTLY`
- `CONCURRENTLY` inside transaction wrappers
- added columns with literal or expression defaults
- `ALTER COLUMN TYPE` table rewrites
- validating foreign keys without `NOT VALID`
- `VALIDATE CONSTRAINT`
- `SET NOT NULL`
- `DROP COLUMN`
- renames
- direct unique constraint builds
- `TRUNCATE`
- table rewrite commands such as `VACUUM FULL` and `CLUSTER`

## Privacy Posture

The default app performs migration analysis in the browser. There are no D1/R2
bindings, no runtime secrets, and no API route that receives pasted SQL.
