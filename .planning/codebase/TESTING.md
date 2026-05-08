# Testing

**Last mapped:** 2026-05-08

## Current state: no automated tests

There is **no test framework installed and no test files anywhere** in the
repository. `package.json` has no `"test"` script and no `devDependencies`.
Searches for `*.test.ts`, `*.spec.ts`, `__tests__/`, `vitest`, `jest`, `mocha`,
`tap`, and `node:test` all return zero results.

`CLAUDE.md` states this explicitly: "There is no formal test suite yet. Smoke
tests are done by booting `npm run serve` and curling endpoints."

## What "testing" looks like today

**Pre-deploy: local smoke test.**

```bash
npm run build
npm run serve     # → http://localhost:4321
# In another terminal:
curl -i http://localhost:4321/
curl -i -X POST -d 'email=test@example.com&requested_sport=world_cup' http://localhost:4321/api/signup
# Confirm link prints to the npm run serve console because RESEND_API_KEY is unset locally
curl -i 'http://localhost:4321/api/confirm?token=<paste>'
```

**Post-deploy: CI smoke test.**

`.github/workflows/deploy.yml:70-79` retries `curl -sk -o /dev/null -w '%{http_code}'`
against `https://$DROPLET_HOST/` up to 5 times, requiring 200. That's the
only automated check that runs on each deploy.

**Post-deploy: manual.** `DEPLOY.md` documents `journalctl -u oddlympics -f`
as the way to watch live behavior.

## What's testable as it stands

The lib modules are pure-ish and would be straightforward to unit-test if
a runner were added:

| Module | Surface | What to test |
|---|---|---|
| `src/lib/token.ts` | `mintToken(email)`, `verifyToken(token)` | round-trip, expired token, tampered signature, malformed input, wrong secret |
| `src/lib/rate-limit.ts` | `checkRateLimit(key)` | first 5 hits pass, 6th fails, 1-hour window expiry, separate keys are independent |
| `src/lib/db.ts` | exported prepared statements | upsert idempotency, `markConfirmed` only updates unconfirmed rows, returns `undefined` for missing email — would need a per-test `:memory:` DB |
| `src/lib/email.ts` | `sendMagicLink(email, token)` | dev fallback path (no API key) prints to console; prod path requires Resend mock |

API routes (`src/pages/api/*`) are testable in two ways:
1. Direct call: import the route and invoke it with a hand-built `Request`.
2. Black-box: `npm run build` + spawn `dist/server/entry.mjs` and `fetch()`
   against it.

## What a future test setup should look like

There is no precedent for a test stack here, so this is greenfield. Reasonable
options if/when tests get added:

**Option A: `node --test` (Node built-in, zero deps).** Already available on
the project's pinned Node 22. Pros: no devDependencies, no compiler config.
Cons: less ergonomic than vitest for snapshot/mocking.

**Option B: Vitest.** Idiomatic match for an Astro/Vite project. Pros:
TypeScript out of the box, fast watch mode, snapshot support. Cons: adds a
devDependency tree.

Either way, the obvious split:
- **Unit tests** for the four lib modules with a per-test `:memory:` SQLite
  for `db.ts` (`new Database(':memory:')`).
- **Integration tests** for the API routes via direct invocation with a
  built `Request` object — Astro's API route signature is a plain async
  function, so no special harness needed.
- **Smoke tests** stay in CI as `curl` checks (already there), expanded to
  POST `/api/signup` against a test inbox.

## Mocking strategy (when needed)

- **SQLite:** swap the connection string to `:memory:` per test. The schema
  in `src/lib/db.ts:15-26` is `CREATE TABLE IF NOT EXISTS`, so it migrates on
  every `new Database(...)` — no fixtures needed.
- **Resend:** stub the imported module or set `RESEND_API_KEY=''` and
  `NODE_ENV=development` to force the console-log fallback path
  (`src/lib/email.ts:42-48`).
- **Time:** `Date.now()` is referenced in `rate-limit.ts:7` and
  `token.ts:31,53`. A `vi.useFakeTimers()` (vitest) or
  `mock.timers.enable()` (node:test) lets you exercise the 1-hour window and
  the 7-day TTL without sleeping.
- **Crypto:** the HMAC secret is read from `process.env.MAGIC_LINK_SECRET` at
  module load — set it before importing `token.ts`.

## Coverage targets

Not currently measured, no tooling, no goal. **Don't introduce a coverage gate
without first introducing tests** — empty coverage on zero tests is
information-free.

## What to test first if asked

If asked to add tests, prioritize in this order based on what's actually
load-bearing for production correctness:

1. `verifyToken` — bad input, expired tokens, tampered signatures all need
   to return `null`. This is the only authentication surface in the app.
2. `markConfirmed` idempotency — the "click twice" promise depends on
   `WHERE confirmed_at IS NULL` working.
3. POST `/api/signup` happy path + each error redirect (`bad-email`,
   `rate-limited`, `bad-origin`, honeypot).
4. `confirmed.astro` rendering — currently reads `searchParams` at build
   time, so all four `?status=` values produce the same HTML. A smoke test
   would catch this. See CONCERNS.md.
