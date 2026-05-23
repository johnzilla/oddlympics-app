---
quick_id: 260523-qqa
slug: csrf-rfc8058-email-hardening
date: 2026-05-23
description: |
  Three high-priority hardening fixes surfaced by external review:
  (1) add Origin check to /api/save-selection to block cross-site CSRF
  against signed-in sessions, (2) add a POST handler to /api/unsubscribe
  so RFC 8058 one-click unsubscribe (List-Unsubscribe-Post) actually works,
  and (3) attach buildUnsubscribeHeaders to outbound kickoff alerts so
  every match notification carries List-Unsubscribe headers (spam
  mitigation).
files_modified:
  - src/pages/api/save-selection.ts
  - src/pages/api/unsubscribe.ts
  - scripts/send-kickoff-notifications.mjs
---

# Plan: CSRF + RFC 8058 + kickoff-alert unsubscribe headers

## Objective

Close three deliverability / CSRF gaps before launch (2026-06-11). All three are independent additive changes to existing handlers; no schema migration, no behavioral surprise.

## Task 1 — Origin check on `/api/save-selection` (CSRF)

**File:** `src/pages/api/save-selection.ts`

The endpoint authenticates via either a form token (purpose=manage) or a 30-day session cookie. The form-token path is single-use and self-protecting against cross-site replay, but the session-cookie path is browser-ambient — a cross-site `<form action="/api/save-selection" method="POST">` from any third-party site can ride the user's session and overwrite their team selection or timezone.

**Action:** Mirror `originOk(request, siteUrl)` from `src/pages/api/signup.ts:21-37` (already proven via the rate-limit + landing-page POST tests). Place it as the very first check in the `POST` handler — before form parsing — and redirect to `/manage?error=bad-origin` on failure.

**Acceptance:**
- A POST with no `Origin` header → 303 → `/manage?error=bad-origin`
- A POST with `Origin: https://evil.example` → 303 → `/manage?error=bad-origin`
- A same-origin POST (browser submit from `/manage`) → unchanged behavior, saves selection
- `npx astro check` clean
- Existing `smoke-manage.mjs` cases still PASS (they use a same-origin localhost POST, which matches the `o.hostname === 'localhost'` allow-line)

## Task 2 — POST handler on `/api/unsubscribe` (RFC 8058)

**File:** `src/pages/api/unsubscribe.ts`

We emit `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on confirmation emails (via `buildUnsubscribeHeaders` at `src/lib/email.ts:98-108`), which advertises RFC 8058 one-click unsubscribe to MTAs. Gmail and Apple Mail fire an unauthenticated `POST` to the `List-Unsubscribe` URL when the user clicks unsubscribe. Today that URL points at `/api/unsubscribe?token=...` which is GET-only; the MTA gets a 404/405 and the user stays subscribed.

**Action:** Export a `POST` handler that performs the same unsubscription logic as `GET`. Per RFC 8058 the body is `application/x-www-form-urlencoded` with `List-Unsubscribe=One-Click`, but the token is the unsubscribe URL's `?token=` query param (the MTA POSTs to the same URL it was given). Both verbs should call the same internal unsubscribe function.

Refactor: extract the GET body into a shared `unsubscribe(token: string | null): Response` helper; both `GET` and `POST` call it after extracting the token from `url.searchParams`. POST returns 200 (per RFC 8058 §3.1: "the server returns a 200 status code if the request was accepted") with an empty body rather than 303 — MTAs don't follow redirects.

**Acceptance:**
- `GET /api/unsubscribe?token=<valid>` → unchanged behavior, 303 to `/unsubscribed?status=ok`
- `POST /api/unsubscribe?token=<valid>` → 200 OK, body empty, row marked unsubscribed
- `POST /api/unsubscribe?token=<invalid>` → 200 OK (per RFC: don't leak whether the token was valid) **OR** 400 — match the GET handler's behavior (it 303s to `bad-token`), which is information leak; for POST we just 200 always so a probe can't enumerate
- Idempotent: a second POST with the same token returns 200 and does not error
- `npx astro check` clean

## Task 3 — Attach `List-Unsubscribe` headers to kickoff alerts

**File:** `scripts/send-kickoff-notifications.mjs`

`buildUnsubscribeHeaders` lives in `src/lib/email.ts` (a `.ts` file inside the bundled Astro app). The kickoff script is a standalone `.mjs` that duplicates the token machinery from `src/lib/token.ts` (see `mintManageToken` at line 52). To stay self-contained, we add a parallel `mintUnsubscribeToken` + `buildUnsubscribeHeaders` inline in the script using its existing `sign()`/`b64u()` helpers — same pattern, different purpose claim.

**Action:** Add the two helpers near `mintManageToken` and pass the headers to the `resend.emails.send` call at line 236.

**Acceptance:**
- Every outbound kickoff email carries `List-Unsubscribe: <https://oddlympics.app/api/unsubscribe?token=...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- The token in the header decodes to the recipient's email with `purpose=unsubscribe` (verifiable by running `verifyToken` on the header value against the script's secret)
- Dry-run mode unchanged (no Resend call → no header check needed)
- `node --check scripts/send-kickoff-notifications.mjs` exits 0
- Existing kickoff smoke (if any) still passes; the script's import surface didn't change

## Verification

After all three tasks:
1. `npm run build` exits 0
2. `npx astro check` reports 0 errors
3. `node scripts/smoke-signup.mjs` against a running dev server: 19/19 PASS (no regression on the signup smoke; save-selection is exercised indirectly via the new origin check semantics matching signup.ts)
4. `node --check scripts/send-kickoff-notifications.mjs` exits 0

## Commits

Three atomic commits — one per task — plus a final docs commit for SUMMARY.md.

## Out of scope

- Adding CSRF tokens beyond the Origin check (out of pattern with the rest of the codebase; same-origin Origin matches the project convention)
- Refactoring the kickoff script to share code with `src/lib/email.ts` (introduces a build step; explicitly avoided per the inline comment "duplicates src/lib/token.ts so the script is self-contained")
- The `buildEmail()` HTML/text body changes (the unsubscribe footer link already exists at line 184)
