# Concerns

**Last mapped:** 2026-05-08

Tech debt, bugs, security trade-offs, and fragile areas worth knowing before
making changes. Severity is from the perspective of "we're about to email
real users and ask them to confirm."

## CRITICAL

### `confirmed.astro` reads `searchParams` at build time → all status codes look like success

`src/pages/confirmed.astro:3` does:

```ts
export const prerender = true;
const status = Astro.url.searchParams.get('status') ?? 'ok';
```

Because the page is prerendered, `Astro.url.searchParams` is empty at build
time. The page is baked with `status === 'ok'` and renders the "Confirmed"
copy regardless of the actual redirect from `/api/confirm`. The four redirect
targets — `?status=ok`, `?status=already`, `?status=bad-token`,
`?status=unknown` — all show the user the success page.

**User-visible impact:** someone who clicks an expired magic link is told
they're confirmed; someone whose token is malformed is told they're
confirmed; someone who never signed up but clicked any random
`/confirmed?status=xxx` URL is told they're confirmed. The
`COPY['bad-token']`, `COPY.already`, and `COPY.unknown` branches at
`confirmed.astro:11-26` are dead code in the deployed build.

**Fix pattern is already in the codebase:** `index.astro:61-78` and
`pending.astro:28-35` both read URL params client-side via
`<script is:inline>`. Apply the same pattern to `confirmed.astro` —
move the `COPY` map and `status` read into an inline script that swaps the
banner/headline/sub text at runtime.

## HIGH

### Origin header missing → cross-origin POST allowed

`src/pages/api/signup.ts:22`:

```ts
if (!origin) return true; // some same-origin form posts omit Origin; fall back to allow
```

A POST without an `Origin` header bypasses the cross-origin check entirely.
A malicious page could craft a form that omits the header (or use `<form>`
in a context that doesn't set it) and submit emails through a victim's
browser. Mitigated *somewhat* by the rate limiter (5/hour per IP and per
email), the honeypot, and the email-verification step before anything
material happens — but the comment's premise should be re-verified.
Modern browsers do attach `Origin` to cross-origin form submits; consider
defaulting to deny if `Origin` is absent on a `POST`.

### In-memory rate limiter resets on every restart

`src/lib/rate-limit.ts` stores hits in a process-local `Map`. Every deploy
(`systemctl restart oddlympics`) clears it. An attacker who notices a deploy
window gets a fresh quota. Also: any future move to multiple replicas
silently breaks the limiter (each replica has its own Map). The fix when
this matters is a SQLite-backed counter table or Caddy-side rate limiting at
the edge — but probably overkill for v1's scale.

### No CSP header

`deploy/Caddyfile:24-32` sets HSTS, nosniff, `X-Frame-Options: DENY`, and
`Referrer-Policy`, but no `Content-Security-Policy`. The pages load Plausible
from a third-party origin (`plausible.io/js/...`) and execute inline
`<script is:inline>` blocks, so a CSP would need
`script-src 'self' 'unsafe-inline' https://plausible.io` minimum. Worth
adding before a public push.

### No automated DB backup

`DEPLOY.md:133` lists this as deferred: "Add a daily cron + `rclone` to
S3/B2 before launch." The droplet is a single box. If it dies, the email
list is lost. Manual `sqlite3 .backup` exists in the Day 2 table
(`DEPLOY.md:110`) but isn't scheduled. **Block on this before sending the
launch announcement.**

### No unsubscribe / delete endpoint

CAN-SPAM (US), CASL (Canada), and GDPR (EU) all require a working
unsubscribe path on transactional → marketing email. The launch ping
described in `src/lib/email.ts:23` ("we'll email you when it's time") is on
the boundary. There is no `/api/unsubscribe` route and no admin command
to delete a row by email. Add before sending anything that isn't the
double-opt-in confirmation itself.

## MEDIUM

### Magic-link tokens valid for the full 7-day TTL even after use

`src/lib/token.ts` has no revocation mechanism. The token's HMAC stays
valid for 7 days; the *effect* of clicking it twice is idempotent because
`markConfirmed` only updates rows where `confirmed_at IS NULL`. But the
token itself is replayable for 7 days, which means a leaked email (e.g.
forwarded to a colleague, ending up in archived support threads) gives
anyone who sees the URL the ability to "confirm" the original signup —
which is a no-op once already confirmed, but is still a longer attack
window than necessary. Two reasonable mitigations:
1. Drop TTL from 7 days to 24 hours (simple change, `TTL_SECONDS` at
   `src/lib/token.ts:4`).
2. Track used tokens (or a token nonce) in the DB and reject reuse.

### Schema migration runs on import with no ordering guard

`src/lib/db.ts:15-26` runs `CREATE TABLE IF NOT EXISTS` and an `IF NOT EXISTS`
index at module load. Fine for the current schema. But there's no
migration framework — adding a column or backfilling data later means
either inline `ALTER TABLE … IF NOT EXISTS` (SQLite supports this only
via try/catch) or a checked-in migration script. Plan for this before the
first non-trivial schema change.

### Smoke test uses `curl -sk` (TLS verification skipped)

`.github/workflows/deploy.yml:73` uses `curl -sk` (the `k` skips cert
validation). With `DROPLET_HOST` set to `oddlympics.app`, Caddy's cert is
real and the `-k` is unnecessary; if it's ever set to a raw droplet IP, the
`-k` would mask cert misconfiguration. Drop the `-k` once the host is
guaranteed to match the cert.

### Plausible script ID is hardcoded across three pages

`pa-wRAab3seDWDDBnGbRbe0K` appears in three places
(`index.astro:20`, `pending.astro:13`, `confirmed.astro:39`). Rotating it
or pointing it at a different account means three coordinated edits. Low
urgency — but a `--analytics-id` env or a shared layout would consolidate it.

### CSS rules duplicated across all three pages

`CLAUDE.md` acknowledges this: "Refactor to a shared layout when a 4th page
lands." `--bg`, `--fg`, `--accent`, `--mono`, `.banner`, `.headline`,
`.subhead`, `.link`, the 520px media query — all duplicated in
`index.astro`, `pending.astro`, `confirmed.astro`. Fine as a deliberate
trade-off for now; tracked here so the threshold is explicit.

### `requested_sport` in `vip_signups` is captured but never used

The form at `src/pages/index.astro:42` hardcodes
`<input type="hidden" name="requested_sport" value="world_cup" />`. The
backend allows `world_cup`, `olympics`, `strongman`, `cubing`, `other`
(`src/pages/api/signup.ts:10`) but the only path that exercises the others
is a hand-crafted POST. Either the field is meant for a future "VIP cue"
flow (alluded to at `index.astro:58`) or it's dead. Decide before the
schema gets immutable.

## LOW

### `.env` file present in working tree but gitignored

`.gitignore:15` excludes `.env`, and the file exists locally. Verified not
tracked by git. Listed as low because the discipline is correct, but worth
periodic verification (`git check-ignore .env`).

### No `Content-Type` validation on `POST /api/signup`

The route calls `request.formData()` which throws on non-form bodies, and
the catch redirects to `bad-form` (`src/pages/api/signup.ts:48-53`). Works
in practice. Strict `Content-Type: application/x-www-form-urlencoded` or
`multipart/form-data` enforcement would short-circuit junk requests before
the parse.

### `setInterval` in `rate-limit.ts` lifecycle

`src/lib/rate-limit.ts:20-27` schedules a 1-hour cleanup interval at module
load. `unref?.()` keeps it from blocking shutdown, but the interval never
gets cleared, so re-importing the module in tests would leak timers. Not
a runtime bug — just something to be aware of when adding a test runner.

### `EMAIL_FROM` defaults to Resend's shared sandbox sender

`src/lib/email.ts:4` falls back to `oddlympics <onboarding@resend.dev>`.
If the production env file is misconfigured and `EMAIL_FROM` is unset,
emails go out from `onboarding@resend.dev` rather than an oddlympics-branded
address. Consider failing on missing `EMAIL_FROM` in prod the same way
`RESEND_API_KEY` already does.

## What's NOT a concern (despite looking like one)

- **`security: { checkOrigin: false }`** — this is intentional and replaced
  by a stricter custom check (`src/pages/api/signup.ts:18-34`). Documented
  in `astro.config.mjs:8-10` and `CLAUDE.md`. The custom check has the
  Origin-missing edge case noted above, but the disabled built-in check
  itself is not the problem.
- **Native `better-sqlite3` rebuild on deploy** — required because
  GitHub-runner glibc differs from the droplet. Already handled by
  `.github/workflows/deploy.yml:62`.
- **No tests** — known and accepted at this stage. See TESTING.md for what
  to add when the time comes.
- **Single droplet, no HA** — explicit v1 trade-off. Restart cost is ~2s.
