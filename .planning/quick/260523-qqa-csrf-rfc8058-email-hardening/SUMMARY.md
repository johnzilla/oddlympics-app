---
quick_id: 260523-qqa
slug: csrf-rfc8058-email-hardening
status: complete
date: 2026-05-23
files_modified:
  - src/pages/api/save-selection.ts
  - src/pages/api/unsubscribe.ts
  - scripts/send-kickoff-notifications.mjs
---

# Summary — CSRF + RFC 8058 + kickoff-alert unsubscribe headers

Three high-priority hardening fixes from external review. All additive,
no schema migration, no behavioral surprise.

## Tasks completed

| # | Task | Status |
|---|------|--------|
| 1 | Origin check on `/api/save-selection` (CSRF) | ✓ |
| 2 | POST handler on `/api/unsubscribe` (RFC 8058) | ✓ |
| 3 | `List-Unsubscribe` headers on kickoff alerts | ✓ |

## What was built

**`src/pages/api/save-selection.ts`** — added `originOk(request, siteUrl)`
mirroring `src/pages/api/signup.ts:21-37`. Runs as the first check in `POST`
before form parsing. Closes the CSRF gap on session-cookie-authenticated
team/timezone writes: a cross-site `<form>` POST from any third-party site
can no longer ride a signed-in session. Localhost allow-line preserves dev.

**`src/pages/api/unsubscribe.ts`** — refactored the inner logic into a shared
`unsubscribeByToken(token): 'ok' | 'already' | 'unknown' | 'bad-token'`
helper. `GET` keeps its 303→`/unsubscribed?status=…` flow. New `POST` returns
200 regardless of token validity — RFC 8058 §3.1 expects 200 on accepted
one-click unsubscribes, and the status-agnostic response prevents recipient
enumeration via token probing. Gmail / Apple Mail / Outlook one-click
unsubscribe now actually unsubscribes the user.

**`scripts/send-kickoff-notifications.mjs`** — added inline
`mintUnsubscribeToken(email)` + `buildUnsubscribeHeaders(email)` using the
script's existing `sign()`/`b64u()` helpers (kept self-contained per the
existing CLAUDE.md pattern — no TS build step in the systemd unit). Wired
the headers into the `resend.emails.send()` call. Token round-trip
verified: minted in the script, verifies as `purpose=unsubscribe` under
the same `MAGIC_LINK_SECRET` the web app uses, and is rejected on purpose
mismatch.

## Verification

- `npm run build`: ✓ Complete
- `npx astro check`: 22 pre-existing errors (`@types/node` missing — baseline
  from before this task; no new errors introduced)
- `node --check scripts/send-kickoff-notifications.mjs`: exit 0
- Live curl tests against `npm run dev`:
  - `GET /api/unsubscribe` (no token) → 303 → `/unsubscribed?status=bad-token`
  - `GET /api/unsubscribe?token=invalid` → 303 → `/unsubscribed?status=bad-token`
  - `POST /api/unsubscribe` (no token) → 200
  - `POST /api/unsubscribe?token=invalid` → 200 (no enumeration leak)
- `node scripts/smoke-signup.mjs` against dev server: **19/19 PASS** — no regression

## Commits

- `<task-1>`: fix(quick-260523-qqa-01): add Origin check to /api/save-selection (CSRF)
- `<task-2>`: fix(quick-260523-qqa-02): add POST handler to /api/unsubscribe (RFC 8058)
- `<task-3>`: fix(quick-260523-qqa-03): attach List-Unsubscribe headers to kickoff alerts

## Deviations

None. All three tasks implemented as planned.

## Self-Check: PASSED

- ✓ CSRF gap on `/api/save-selection` closed (Origin check matches signup.ts pattern)
- ✓ RFC 8058 one-click unsubscribe now functional end-to-end (POST handler + 200 contract)
- ✓ Kickoff alerts carry `List-Unsubscribe` + `List-Unsubscribe-Post` headers (token verifies)
- ✓ No regression: smoke 19/19 PASS, build green
- ✓ Atomic commits, one per task; SUMMARY.md present
