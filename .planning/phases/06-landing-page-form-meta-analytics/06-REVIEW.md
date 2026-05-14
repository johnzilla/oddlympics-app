---
phase: 06-landing-page-form-meta-analytics
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/pages/index.astro
  - scripts/smoke-landing.mjs
  - package.json
  - DEPLOY.md
  - .gitignore
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 6 ships a full rewrite of the public landing (`src/pages/index.astro`, 607 lines), a new evidence smoke harness (`scripts/smoke-landing.mjs`, 217 lines), two new npm scripts, a Day-2-ops row in `DEPLOY.md`, and one new entry in `.gitignore`. The work is read by users on the public internet (XSS surface) and consumed by an automated smoke gate before ship — both surfaces need to hold up.

**No BLOCKER issues found.** The inline-script XSS surface is clean: every dynamic text path uses `.textContent` (never `innerHTML`), `Intl.DateTimeFormat().resolvedOptions().timeZone` returns IANA-format strings only, and the `?error=` code lookup goes through a closed `COPY` dictionary with a hard fallback string — no attacker-controlled value can reach the DOM as HTML. The honeypot, Origin, email regex, team allow-list and timezone-fallback wires in `/api/signup` are unchanged from Phase 5 (out of phase scope; verified intact via cross-read).

**4 WARNING issues** — all in `scripts/smoke-landing.mjs` and `package.json`. The smoke harness has two concrete failure modes that will cause spurious FAILs in real operator runs (shared rate-limit-IP collision with `smoke-signup.mjs`, and Resend-rejected `@example.invalid` addresses when `RESEND_API_KEY` is set); a substring-collision bug in the `FORM-02-confederation-order` check that currently passes by luck; and a fragile assertion strategy in `META-01-og-tags` that depends on Astro preserving HTML attribute order. The `check:land-02` npm script also has a portability concern that is worth noting.

**4 INFO items** — Plausible analytics script is loaded without SRI; the cleanup hint in `smoke-landing.mjs` is inconsistent with `smoke-signup.mjs` (different email pattern); the comment block in `index.astro` references "v1" verbatim which may confuse future readers; and the `og:image` URL points at `/og-image.png` which (per phase plan) is not yet committed.

## Warnings

### WR-01: Smoke harness shares rate-limit IP with `smoke-signup.mjs` — collision causes spurious FAIL

**File:** `scripts/smoke-landing.mjs:43`, `scripts/smoke-landing.mjs:185-206`
**Issue:** `SMOKE_IP = '192.0.2.42'` is the **same** RFC 5737 address used by `scripts/smoke-signup.mjs` (line 39 of that file). `src/lib/rate-limit.ts` keys on `ip:<ip>` with `MAX_PER_WINDOW = 5` per hour and the comment in `smoke-signup.mjs:282-287` documents that script intentionally exhausts the IP slot (firing 7+ valid POSTs in the rate-limit case). The state is in-memory in the running server process and only resets on restart. Concrete failure path: an operator runs `npm run smoke -- signup` followed by `npm run smoke:landing` against the same dev server within an hour → both POSTs in `smoke-landing.mjs` (FORM-01-post-303 and FORM-01-bad-team-303-error) hit the rate limit BEFORE the team allow-list check, so they 303 to `/?error=rate-limited` instead of `/pending` and `/?error=bad-form`. Both cases FAIL with an exit-1, even though the landing page and backend are functioning correctly. This is the canonical "smoke flake" failure mode and will erode trust in the gate.
**Fix:** Use a distinct test-net IP for the landing smoke so the two harnesses don't collide. Suggested:
```javascript
const SMOKE_IP = '192.0.2.43'; // RFC 5737 TEST-NET-1; distinct from smoke-signup.mjs (192.0.2.42)
```
Add a one-line comment cross-referencing `smoke-signup.mjs`'s IP so future smokes default to a fresh address.

### WR-02: Smoke POSTs use `@example.invalid` — fails when `RESEND_API_KEY` is configured

**File:** `scripts/smoke-landing.mjs:188`, `scripts/smoke-landing.mjs:200`
**Issue:** Both POST cases send `smoke-landing-${Date.now()}@example.invalid`. The happy-path case (`FORM-01-post-303`) traverses the full `/api/signup` pipeline including `await sendMagicLink(rawEmail, token)` at `src/pages/api/signup.ts:109`. When `RESEND_API_KEY` is **unset** the email module short-circuits to the dev-console fallback (`src/lib/email.ts:43-49`) and the POST 303s to `/pending` as the assertion expects. When `RESEND_API_KEY` **is** set — which is the case for any operator running the smoke via `npm run serve` after exporting their `.env`, OR running it against the production-localhost on the droplet as DEPLOY.md instructs for `smoke-signup.mjs` — Resend will reject `@example.invalid` (RFC 6761 reserved, no MX) with an API error. That error is caught at `src/pages/api/signup.ts:111-113` and 303s to `/?error=email`. The smoke FAILs with no real defect in the code under test. Note that `scripts/smoke-signup.mjs` uses `@example.com` precisely to keep this from happening (the cleanup hint there is `LIKE 'smoke-%@example.com'`).
**Fix:** Match the working pattern from `smoke-signup.mjs` — use `@example.com` and document that Resend can accept-then-discard mail to that domain (or that the dev-fallback path is the intended smoke target):
```javascript
email: `smoke-landing-${Date.now()}@example.com`,
```
Also update the comment at line 38-40 and the cleanup hint at line 212 to match. If `@example.invalid` is a deliberate choice (because operators MUST run with `RESEND_API_KEY` unset), document that constraint explicitly at the top of the file and assert it at startup with a fast-fail.

### WR-03: `FORM-02-confederation-order` check has a substring-collision bug — passes by luck

**File:** `scripts/smoke-landing.mjs:127-135`
**Issue:** The check computes `positions = order.map((c) => html.indexOf(c))` for `['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']`, then asserts strictly increasing positions. Problem: `indexOf('CAF')` finds the substring "CAF" — but "CAF" appears **inside** "CONCACAF" before it appears in "CAF — Africa". So `positions[3]` resolves to a location 4 characters inside the CONCACAF optgroup label, not the actual CAF label. The check currently passes only because that intra-CONCACAF "CAF" position is still numerically greater than `positions[2]` (the start of "CONCACAF"). The test is asserting something it doesn't claim to assert; any future re-ordering or copy edit (e.g., dropping CONCACAF, or moving the CAF group before CONCACAF) would either silently pass or fail for the wrong reason. This is brittle and misleading — exactly the kind of "evidence" that erodes trust when caught.
**Fix:** Anchor the search on a unique fragment of each confederation row. The optgroup labels include the full name (`UEFA — Europe`, `CAF — Africa`, etc.), which is unique:
```javascript
await runCase('FORM-02-confederation-order', () => {
  const order = ['UEFA — Europe', 'CONMEBOL — South America', 'CONCACAF — North & Central America', 'CAF — Africa', 'AFC — Asia', 'OFC — Oceania'];
  const positions = order.map((c) => html.indexOf(c));
  if (positions.some((p) => p === -1)) return false;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] <= positions[i - 1]) return false;
  }
  return true;
});
```
This also gives a clearer failure mode (a missing or renamed confederation label fails by `indexOf === -1` instead of by ordering arithmetic).

### WR-04: `check:land-02` npm script is non-portable and shadows the same false-positive as a source-text check

**File:** `package.json:14`
**Issue:** `"check:land-02": "! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html"`. Two concerns:
1. **Portability:** the leading `!` is a POSIX shell negation that works under `bash`/`zsh`/`sh` on Linux + macOS, but if the script is ever invoked via `cmd.exe` on Windows (e.g., a future contributor without WSL), the `!` is interpreted as the history-expansion operator and the command silently mis-runs. Also `! cmd` is not part of strict POSIX — it's only required to work as the first word; chaining via npm wraps it through `sh -c` on POSIX, which is fine, but Windows `npm` uses `cmd.exe` and will break. Low blast radius (project is Linux/macOS only today) but worth a one-line guard.
2. **Self-shadowing:** the same prohibited terms (`bitcoin|lightning|crypto|world domination|personal olympics`) appear **literally in the grep pattern itself** inside `package.json`. If anyone ever runs the same check against the repo source (not just `dist/`), `package.json` itself flags. The smoke harness at `scripts/smoke-landing.mjs:118` already worked around this with bracket char-classes (`[b]itcoin`, etc.). `package.json` does not get the same treatment, which is internally inconsistent. Not a runtime bug, but a maintenance trap — a future "scan the whole repo for prohibited terms" task will trip.
**Fix:** Apply the same bracket-class trick used in the smoke script, for consistency and to future-proof full-repo scans:
```json
"check:land-02": "! grep -iE '[b]itcoin|[l]ightning|[c]rypto|[w]orld domination|[p]ersonal olympics' dist/client/index.html"
```
For the portability concern, consider moving the check into `scripts/smoke-landing.mjs` (which already runs the same grep against the live HTML body at line 117-118) and dropping the npm-script entry, OR document that the project targets POSIX shells only.

## Info

### IN-01: Plausible analytics script loaded without Subresource Integrity (SRI)

**File:** `src/pages/index.astro:64`
**Issue:** `<script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>` has no `integrity=` or `crossorigin=` attribute. A compromise of `plausible.io` (or a MITM upstream of TLS termination — unlikely with HTTPS but defense-in-depth) could inject arbitrary JS that runs on every landing visit, including reading the email input pre-submit. Out of scope for v1 per the CSP-already-shipped rationale, and pinning SRI on third-party analytics has a non-trivial maintenance cost (Plausible can rotate the bundle without warning). Logged for awareness.
**Fix:** Either add `integrity` + `crossorigin="anonymous"` and document the rotation process, or accept the risk and note it in CLAUDE.md under Security Posture. Recommend the latter for v1 — the operational cost of SRI on third-party analytics outweighs the actual threat for a low-PII signup form.

### IN-02: Cleanup-hint email patterns differ between `smoke-landing.mjs` and `smoke-signup.mjs`

**File:** `scripts/smoke-landing.mjs:38-40`, `scripts/smoke-landing.mjs:211-213`
**Issue:** This smoke writes rows with `smoke-landing-%@example.invalid`; `smoke-signup.mjs` writes `smoke-%@example.com`. An operator running both will need two different cleanup commands. The DEPLOY.md "Phase 5 post-deploy smoke" section documents one `LIKE 'smoke-%@example.com'` cleanup but a future Phase-6-post-deploy run will leave `smoke-landing-%` rows behind that don't match. Minor; aligned with WR-02's fix would auto-resolve.
**Fix:** When applying WR-02 (switch to `@example.com`), update the cleanup hint string at line 40 and line 212 to match — and ideally update DEPLOY.md's smoke-signup cleanup to use the broader pattern `LIKE 'smoke%@example.com'` so one command covers both harnesses.

### IN-03: `?error=` COPY dictionary key `email` collides with a likely future intent

**File:** `src/pages/index.astro:215-222`
**Issue:** The COPY dictionary uses lower-cased single-word keys for the error codes from `/api/signup` (`'bad-email'`, `'bad-form'`, `'bad-origin'`, `'rate-limited'`, then bare `email` and `server`). The bare `email` and `server` keys (without the `bad-` prefix) are inconsistent with the others and shadow the much more common semantic of "is there an email field." If anyone ever introduces a new code like `email-already-confirmed` and shortens it to `email`, behavior changes silently. Cosmetic but worth aligning.
**Fix:** Rename to match the `bad-`/category-prefixed pattern when convenient (e.g., `'send-failed'` and `'server-error'`), keeping the `/api/signup` `back('email')` and `back('server')` callsites in sync. Not load-bearing for this phase; flag for the next backend-touching phase.

### IN-04: `og:image` references `/og-image.png` which isn't committed yet

**File:** `src/pages/index.astro:14`, `src/pages/index.astro:54`, `src/pages/index.astro:61`
**Issue:** `const OG_IMAGE = 'https://oddlympics.app/og-image.png';` and three meta tags reference it. The phase plan defers OG image generation to Phase 8 per `.planning/ROADMAP.md`. Before Phase 8 ships, any social-media unfurl of the landing page (Twitter/X, iMessage, Slack, Discord, etc.) will render with a broken-image placeholder or fall back to the page title only. Not a regression vs. v1.0 (which had no OG image either) but the meta tags being present *promise* an image that doesn't exist. Either intentional (the smoke tests require the META-01 tags now to validate the wiring before the asset lands) or a footgun depending on framing.
**Fix:** Two options — (a) leave as-is and document at the top of `index.astro` that the OG image is intentionally referenced ahead of its Phase-8 ship; (b) gate the three `og:image*` and `twitter:image` tags behind a build-time env flag (`PUBLIC_OG_IMAGE_READY=1`) so social previews fall back to text-only until the asset ships. (a) is fine if the gap is short; (b) is safer if Phase 8 slips.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
