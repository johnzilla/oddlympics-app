---
phase: 10-confirmation-email-update
plan: 01
subsystem: email-send-lib
status: complete
tags: [email, resend, confirmation, signup, signup-04]
requires:
  - Phase 5 (vip_signups.team + vip_signups.timezone columns)
  - Phase 9 D-05 (TTL_BY_PURPOSE.unsubscribe = 1y, inherited via buildUnsubscribeHeaders)
provides:
  - "src/lib/teams.ts:teamLabel(slug) — slug → canonical label, raw-slug fallback (D-03)"
  - "src/lib/timezones.ts:tzLabel(tz) — IANA → human label, mirrors landing JS (D-02)"
  - "src/lib/email.ts:sendMagicLink(email, token, team, timezone) — 4-arg signature (D-01)"
  - "Confirmation-email body with SIGNUP-04 value-prop line + replyTo + List-Unsubscribe headers"
affects:
  - src/pages/api/signup.ts (call site widened from 2-arg to 4-arg)
tech-stack-added: []
tech-stack-patterns:
  - "Caller-passes-validated-primitives (lib never imports db.ts)"
  - "ASCII apostrophe (0x27) in all body copy — no U+2019"
  - "Mirrors-landing-JS pattern for tzLabel (cross-file byte-equivalence invariant)"
  - "Multipart text + html on Resend send (D-06)"
key-files-created: []
key-files-modified:
  - src/lib/teams.ts (+4 lines)
  - src/lib/timezones.ts (+9 lines)
  - src/lib/email.ts (+20 / -9 lines)
  - src/pages/api/signup.ts (+1 / -1 line)
decisions:
  - "Used straight ASCII apostrophe (0x27) throughout body copy — matches Phase 6 deviation log precedent and SIGNUP-04 spec verbatim"
  - "tzLabel + teamLabel land in lib/ (D-02 / D-03 preferred locations) — testable, single source of truth; smoke in Plan 10-02 will import them"
  - "replyTo on Resend send uses SDK camelCase field (verified node_modules/resend/dist/index.d.mts:551), NOT reply_to snake_case wire format"
  - "Dev-fallback gets one new console.log line printing the rendered value-prop string — preserves the existing 2-line shape, additive only"
metrics:
  duration_min: 6
  tasks_completed: 3
  files_changed: 4
  lines_added: 34
  lines_removed: 11
completed: 2026-05-15
---

# Phase 10 Plan 01: Widen sendMagicLink with team + tz copy + Resend headers — Summary

Widened `sendMagicLink()` to a 4-arg signature accepting Phase-5-validated `team` (slug) and `timezone` (IANA) primitives, rewrote subject + plain-text + HTML bodies to ship the SIGNUP-04 consumer value-prop line (e.g., "We'll email you 1 hour before every England match in Detroit time."), and wired two Mail-Tester-lifting headers (`replyTo: hello@oddlympics.app` and `List-Unsubscribe` pair via `buildUnsubscribeHeaders(email)`) onto the Resend send. Caller `/api/signup` widens to pass `(rawEmail, token, rawTeam, tz)`. `sendManageLink` and `buildUnsubscribeHeaders` are byte-identical to pre-Phase-10.

## Verification Map

| Plan Success Criterion | Evidence |
|---|---|
| `src/lib/teams.ts` exports `teamLabel(slug: string): string` | `grep -nF "export function teamLabel(slug: string): string" src/lib/teams.ts` → 1 match (line 16) |
| `src/lib/timezones.ts` exports `tzLabel(tz: string): string` | `grep -nF "export function tzLabel(tz: string): string" src/lib/timezones.ts` → 1 match (line 19) |
| `sendMagicLink` 4-arg signature `(email, token, team, timezone): Promise<void>` | `src/lib/email.ts:17-22` shows widened signature; `grep -nF "team: string,"` + `"timezone: string,"` both present |
| New subject + body + replyTo + headers fields | `grep -nFc "Confirm your World Cup alerts — oddlympics" src/lib/email.ts` → 1; `grep -nF "We'll email you 1 hour before every" src/lib/email.ts` → 2 hits (text + html); `replyTo: 'hello@oddlympics.app'` + `headers: buildUnsubscribeHeaders(email)` both present |
| `sendManageLink` + `buildUnsubscribeHeaders` byte-identical | `grep -nFc "Pick your World Cup teams — oddlympics"` → 1 (Phase 9 D-01 subject preserved); manual diff of lines 75-120 vs pre-Phase-10 confirms identity |
| `/api/signup:109` passes `(rawEmail, token, rawTeam, tz)` | `grep -nF "sendMagicLink(rawEmail, token, rawTeam, tz)"` → 1 match; old 2-arg `sendMagicLink(rawEmail, token);` removed (grep -c → 0) |
| `npm run build` passes | Built `dist/server/entry.mjs` + 6 prerendered pages in 918ms — see Build Output section below |
| LAND-02 source grep (no bitcoin/lightning/crypto/world domination/personal olympics) | `! grep -iE '[b]itcoin\|[l]ightning\|[c]rypto\|[w]orld domination\|[p]ersonal olympics' src/lib/email.ts` → PASS (exit 0) |
| U+2019 negative check (no curly apostrophe) | `! grep -F "$(printf '\xe2\x80\x99')" src/lib/email.ts` → PASS (exit 0) |
| Manual dev-mode POST → extended dev-fallback log including `body: every <Team> match in <TzLabel>` line | Captured verbatim below — three POSTs against `npm run dev` show the new 3-line block end-to-end |

## Tasks Completed

### Task 1: teamLabel + tzLabel helpers
- **Commit:** `49bdc41` — `feat(10-01): add teamLabel + tzLabel helpers for email copy`
- **Files:** `src/lib/teams.ts` (+4), `src/lib/timezones.ts` (+9)
- **Result:** Two new exported pure-data helpers, no JSDoc, one earned why-comment on `tzLabel` flagging the cross-file byte-equivalence with `src/pages/index.astro:204-210`. Both return-type annotated per CLAUDE.md TS conventions.

### Task 2: Widen sendMagicLink + rewrite subject + body + wire headers
- **Commit:** `2c82626` — `feat(10-01): widen sendMagicLink with team+tz copy + Resend headers`
- **Files:** `src/lib/email.ts` (+29 / -9)
- **Result:** Signature widened to 4 args; subject swapped to `'Confirm your World Cup alerts — oddlympics'`; plain-text + HTML bodies rewritten with the SIGNUP-04 value-prop line and the "No spam. No ads. Unsubscribe anytime." disclaimer; multipart preserved (text + html both sent); `replyTo` + `headers` fields added to the Resend send call; dev-fallback log extended with a third line printing the rendered value-prop. `sendManageLink` (lines 87-120) and `buildUnsubscribeHeaders` (lines 75-85) byte-identical to pre-Phase-10.

### Task 3: Widen /api/signup call site
- **Commit:** `810e4f9` — `feat(10-01): widen sendMagicLink call site to pass rawTeam + tz`
- **Files:** `src/pages/api/signup.ts` (+1 / -1)
- **Result:** Single-line change at line 109 — `await sendMagicLink(rawEmail, token);` → `await sendMagicLink(rawEmail, token, rawTeam, tz);`. Both `rawTeam` (validated against `VALID_TEAMS`) and `tz` (validated against `VALID_TZ` or backfilled to `FALLBACK_TZ`) already in scope from the Phase 5 chain at lines 75-90. try/catch shape, `[signup] email error` log tag, `back('email')` redirect — all preserved (COMPAT-02).

## Shipped Strings (verbatim — downstream Plan 10-02 byte-equivalence reference)

**Subject literal** (D-05; em-dash U+2014 preserved):

```
Confirm your World Cup alerts — oddlympics
```

**Plain-text body shape** (D-04 / D-06; ASCII apostrophe 0x27, em-dash U+2014 in final line):

```
Confirm your World Cup alerts for oddlympics.

Click below to confirm:
{url}

We'll email you 1 hour before every {teamHuman} match in {tzHuman}.

No spam. No ads. Unsubscribe anytime.

If you didn't request this, ignore this email.

— oddlympics
```

**HTML body shape** (D-04 / D-06; structural shell preserved from pre-Phase-10, only inner copy swapped):

```html
<!doctype html>
<html><body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Confirm your alerts</h1>
  <p style="margin:0 0 20px;line-height:1.55">We'll email you 1 hour before every <strong>${teamHuman}</strong> match in ${tzHuman}.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam. No ads. Unsubscribe anytime. If you didn't request this, ignore this email.</p>
</div>
</body></html>
```

**Resend send call (added fields):**

```ts
const { error } = await resend.emails.send({
  from: FROM,
  to: email,
  subject,
  text,
  html,
  replyTo: 'hello@oddlympics.app',
  headers: buildUnsubscribeHeaders(email),
});
```

Note: the SDK typed field is `replyTo` (camelCase per `node_modules/resend/dist/index.d.mts:551`), NOT `reply_to` snake_case. The SDK translates to wire format internally.

## Build Output

`npm run build` succeeded:

```
09:05:50 [build] ✓ Completed in 835ms.
 prerendering static routes
 ▶ src/pages/confirmed.astro    → /confirmed/index.html
 ▶ src/pages/pending.astro      → /pending/index.html
 ▶ src/pages/privacy.astro      → /privacy/index.html
 ▶ src/pages/terms.astro        → /terms/index.html
 ▶ src/pages/unsubscribed.astro → /unsubscribed/index.html
 ▶ src/pages/index.astro        → /index.html
09:05:50 [build] Server built in 918ms
09:05:50 [build] Complete!
```

`dist/server/entry.mjs` produced. Zero build errors; the 19 pre-existing `astro check` ts(2580) "Cannot find name 'process' / 'Buffer'" errors are environmental (`@types/node` not installed in dev environment) — present on `HEAD` before this plan and confirmed unchanged after this plan via `git stash && npx astro check && git stash pop`. Out of scope per executor scope-boundary rule (pre-existing, unrelated to files touched).

## Manual Dev-Mode Smoke (verbatim from `npm run dev` console)

Started dev server with `npm run dev` (came up on port 4322 because 4321 was already in use by an existing user dev server). POSTed three signups via `curl` and observed the extended `[email-dev-fallback]` 3-line log block. All three POSTs returned `HTTP 303 → /pending?email=...` as expected. DB rows cleaned up afterwards with `DELETE FROM vip_signups WHERE email LIKE 'dev-10-01%'`.

```
[email-dev-fallback] Magic link for dev-10-01@example.com
   http://localhost:4321/api/confirm?token=eyJlbWFpbCI6...

   body: every England match in Detroit time

09:09:04 [303] POST /api/signup 8ms
[signup] tz-fallback email=dev-10-01b@example.com input=""

[email-dev-fallback] Magic link for dev-10-01b@example.com
   http://localhost:4321/api/confirm?token=eyJlbWFpbCI6...

   body: every United States match in New York time

09:09:16 [303] POST /api/signup 3ms
[signup] tz-fallback email=dev-10-01c@example.com input="Etc/UTC"

[email-dev-fallback] Magic link for dev-10-01c@example.com
   http://localhost:4321/api/confirm?token=eyJlbWFpbCI6...

   body: every Germany match in New York time

09:09:17 [303] POST /api/signup 1ms
```

Three observations from the smoke:

1. **Canonical case (`team=england, timezone=America/Detroit`):** body line renders `every England match in Detroit time` exactly as SIGNUP-04 spec example — proves end-to-end team + tz interpolation via the widened 4-arg signature.
2. **Empty timezone (case 2):** `[signup] tz-fallback` log fires (Phase 5 fallback path), `tz` becomes `FALLBACK_TZ = 'America/New_York'`, body renders `every United States match in New York time` (underscore from `New_York` replaced with space by `tzLabel`).
3. **`Etc/UTC` timezone (case 3):** Phase 5's `VALID_TZ.has('Etc/UTC')` returns false on this Node 22 build (`Intl.supportedValuesOf('timeZone')` excludes `Etc/*` aliases), so `/api/signup` falls back to `FALLBACK_TZ` before `sendMagicLink` ever sees `Etc/UTC`. Body renders `every Germany match in New York time`. The `tzLabel('Etc/UTC') → 'your local time'` branch is unreachable via `/api/signup` on this Node version; it remains correct for cron / direct-helper callers and is covered by Plan 10-02's offline smoke Case 5.

## Deviations from Plan

None of substance. Three small notes:

1. **Manual smoke ran on port 4322 instead of 4321** — port 4321 was already bound by an unrelated user dev server, so Astro auto-promoted to 4322. The magic-link URL inside the body still embeds `http://localhost:4321/api/confirm?...` because `PUBLIC_SITE_URL` defaults to `http://localhost:4321`; this is cosmetic and only affects the dev-fallback console line, not the value-prop interpolation under verification.
2. **`Etc/UTC` cannot reach `tzLabel` via `/api/signup`** — Phase 5's `VALID_TZ` allow-list (built from `Intl.supportedValuesOf('timeZone')`) does not include `Etc/UTC` on Node 22, so the `Etc/*` branch of `tzLabel` is unreachable through the signup path. It remains correct semantics for any future direct caller and for the offline smoke in Plan 10-02 — no code change needed. Documented for downstream reviewers.
3. **`astro check` reports 19 pre-existing TypeScript errors** in `db.ts`, `email.ts`, `rate-limit.ts`, `session.ts`, `token.ts` (all `ts(2580)` — `Cannot find name 'process' / 'Buffer'` due to missing `@types/node` in dev environment). Verified pre-existing via `git stash && npx astro check && git stash pop` — error count unchanged before vs. after this plan. The actual build (`npm run build`) succeeds cleanly. Out of scope per executor scope-boundary rule.

## Next Plan

**Plan 10-02:** `scripts/smoke-confirm-email.mjs` — offline byte-equivalence drift net. Re-implements `teamLabel`, `tzLabel`, and the body composer inline (per PATTERNS §"re-implementing TS helpers inline") and runs the 10 cases (canonical, multi-word, FALLBACK_TZ, underscore tz, Etc/UTC, diacritic-or-fallback, subject literal, LAND-02 grep, unknown-slug fallback, empty-tz fallthrough). Adds `npm run smoke:confirm` alias. This plan delivers the asset; 10-02 locks the byte-equivalence.

**Plan 10-03:** Deploy via GitHub Actions; operator runs Mail-Tester ≥ 8/10 (D-08 / SC3) + 3 cross-client sends to Gmail / Proton / Outlook (D-09 / SC2); commit 4 PNG screenshots under `evidence/`; close Phase 10 with `10-SUMMARY.md`.

## Self-Check: PASSED

- File `src/lib/teams.ts` exists: FOUND (16 lines, +4 from baseline)
- File `src/lib/timezones.ts` exists: FOUND (24 lines, +9 from baseline)
- File `src/lib/email.ts` exists: FOUND (120 lines, +20 net from baseline)
- File `src/pages/api/signup.ts` exists: FOUND (120 lines, unchanged line count, 1-line edit at line 109)
- Commit `49bdc41` (Task 1): FOUND in `git log --oneline -5`
- Commit `2c82626` (Task 2): FOUND in `git log --oneline -5`
- Commit `810e4f9` (Task 3): FOUND in `git log --oneline -5`
- All grep-presence assertions in per-task acceptance criteria: PASS
- LAND-02 grep on source: PASS
- U+2019 negative check: PASS
- Dev-fallback log captured with all 3 cases: PASS
- `npm run build`: PASS
