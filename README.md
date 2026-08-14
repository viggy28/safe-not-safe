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
- `@libpg-query/parser` for real Postgres parsing
- Browser Web Worker for parser/rules execution
- TypeScript rules catalog for migration risk checks
- No backend, no database, no SQL logging

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
