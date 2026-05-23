---
phase: 14-share-experience
verified: 2026-05-23T22:15:00Z
status: human_needed
score: 4/4 must-haves verified (all SC + all REQ programmatically green; SC3 native share sheet behavior + email cross-client rendering require human walk-through)
overrides_applied: 0
human_verification:
  - test: "Native share sheet on mobile (SC3, D-20)"
    expected: "Tap Share on /pending?email=...&rc=<real>&team=brazil on iOS Safari and Android Chrome → OS share sheet opens with text 'I'm following Brazil — get your team's World Cup kickoff alerts.' and URL '<origin>/?ref=<rc>' pre-populated. Cancel the share sheet → button does NOT swap to 'Copied!' (T-14-17 AbortError no-fall-through). Repeat on /confirmed?status=ok&rc=<real> and on /manage after sign-in."
    why_human: "navigator.share is browser-API behavior on a real touch device; no automated equivalent without Playwright/Puppeteer. D-20 explicitly defers this to operator walk-through."
  - test: "Clipboard fallback on desktop (SC3, D-20)"
    expected: "Click Share on the same three pages in desktop Chrome / Safari / Firefox → button text flashes 'Copied!' for ~1.5s then restores; paste into a new tab address bar to confirm the URL was copied to the clipboard. On Firefox (no navigator.share), confirm fallback fires on first click."
    why_human: "navigator.clipboard.writeText is gated by browser permissions and requires real OS clipboard; no automated equivalent."
  - test: "Hidden-when-empty branches (D-03, D-16)"
    expected: "GET /pending directly (no ?rc=) → share card invisible. GET /confirmed directly (no params) → share card invisible. GET /confirmed?status=bad-token → share card invisible. GET /confirmed?status=unknown → share card invisible. Confirmed visually (hidden attribute) in browser DevTools or by absence of the card on the rendered page."
    why_human: "Verifying the inline script's runtime guard (does NOT remove the hidden attribute) requires either a headless browser to execute the JS or visual inspection — the static markup ships in both cases, so a curl grep is a false-positive (WR-01 from REVIEW)."
  - test: "Cross-client email rendering (SC2, D-20)"
    expected: "With RESEND_API_KEY configured (or production), trigger a real signup and inspect the confirmation email in Apple Mail (iOS + macOS), Gmail (web + Android), Outlook (web), Proton Mail. Verify: (a) the muted share <p> 'Know someone else following <team>? Share your link: <url>' renders below the Confirm-email button; (b) the <strong> team name renders bold; (c) the <a href> link is clickable and points at <origin>/?ref=<rc>; (d) the plaintext fallback shows the shareLine; (e) no visual collision with the accent-colored NO_ACCOUNT callout (D-12)."
    why_human: "Email-body rendering is cross-client and depends on each MTA's HTML sanitizer + dark-mode handling. Smoke does NOT exercise email bodies (D-20)."
  - test: "/manage share card visibility per branch (D-17)"
    expected: "Sign in to /manage as a confirmed non-unsubscribed user → share card visible between 'Save selection' button and schedule list. Trigger unsubscribe via the email link → re-visit /manage with the same session → unsubscribed branch shown; share card NOT visible. Sign out → /manage shows signed-out branch; share card NOT visible. Visit /manage with an expired/invalid token → share card NOT visible."
    why_human: "Multi-state UI walk-through (signed-in / signed-out / expired-token / unsubscribed) requires either a session cookie management script or human navigation. Markup-level branching is verified programmatically (awk-bracketed grep in plan acceptance criteria) but the rendered states need human eyes."
---

# Phase 14: Share Experience Verification Report

**Phase Goal:** A user who has signed up is prompted, in every natural place, to share their personalized referral link with team-named copy and a native share sheet — closing the referral loop the codes from Phase 13 enable.

**Verified:** 2026-05-23T22:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria SC1–SC4)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| SC1 | /pending, /confirmed, and /manage each show a share prompt containing the user's referral link (/?ref=CODE) | VERIFIED | `pending.astro:52-66` `<section id="share-card">` with `<input id="share-url">`; `confirmed.astro:18-32` same; `manage.astro:310-336` `{shareUrl && (<section class="share-card">...)}`; live curl shows markup on all three pages; smoke SHARE-pending-card + SHARE-confirmed-card pass against running server; /manage share card sits inside `{valid && !isUnsubscribed && (...)}` branch at lines 233-373 (verified by reading the JSX tree directly) |
| SC2 | The confirmation email body includes a personalized share line plus the user's referral link | VERIFIED | `email.ts:69` HTML body contains `<p>Know someone else following <strong>${teamHuman}</strong>? Share your link: <a href="${shareUrl}">${shareUrl}</a></p>`; `email.ts:43` plaintext array includes `shareLine`; dev-fallback log shows `share: http://localhost:4321/?ref=<8-char>` for every signup during live smoke run |
| SC3 | The share action opens the native share sheet on supporting devices (Web Share API) and falls back to a visible copy-link control where the API is unavailable | VERIFIED (code path) + HUMAN NEEDED (runtime behavior) | All three pages feature-detect `typeof navigator.share === 'function'` and call `navigator.share({ text, url })` when present; fall through to `navigator.clipboard.writeText(shareTextStr + '\n' + shareUrl)` with "Copied!" 1500ms flash on every page (`pending.astro:99-125`, `confirmed.astro:107-133`, `manage.astro:492-516`); AbortError correctly suppressed in all three (T-14-17). Browser-API behavior is operator-UAT per D-20. |
| SC4 | The shared message names the user's team — e.g. "I'm following USA — get your team's World Cup kickoff alerts" — sourced from the same references/teams.json label data used elsewhere | VERIFIED | `copy.ts:6-8` `shareText(teamLabel, url)` returns the locked D-08 template; `email.ts:27,30` calls `teamLabel(team)` via `teamHuman` and passes to `shareText`; `manage.astro:71-72` resolves via `teamLabel(user.team)` server-side then `shareText(...)`; `pending.astro:8-10` serializes the full 48-entry TEAM_LABEL_JSON at build time, runtime resolves `labels[teamSlug]`; `confirmed.astro` intentionally generic per D-16 (no team carry-through on confirm 303) |

**Score:** 4/4 SC programmatically verified; SC3 runtime requires human walk-through

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| SHARE-01 | 14-02, 14-04, 14-05 | A share prompt with the user's referral link appears on /pending, /confirmed, and /manage | SATISFIED | Same as SC1; smoke SHARE-pending-card + SHARE-confirmed-card pass; /manage share card scoped to signed-in non-unsubscribed branch (D-17 honored — confirmed by reading branch boundaries at manage.astro:221, 233) |
| SHARE-02 | 14-03 | The confirmation email includes a personalized share line + referral link | SATISFIED | Same as SC2; email body source verified (lines 69 HTML + 43 plaintext); dev-fallback share URL log line present for every signup in smoke run |
| SHARE-03 | 14-04 | The share action offers the native share sheet (Web Share API) with a copy-link fallback | SATISFIED (code) + NEEDS HUMAN (runtime) | Same as SC3; live runtime behavior is browser-API gated and deferred to D-20 operator walk-through |
| SHARE-04 | 14-01, 14-03, 14-04 | Shared content names the user's team (personalized message) | SATISFIED | Same as SC4; single `shareText` helper in `copy.ts` consumed by email.ts + manage.astro; pending.astro inline-resolves the team label via embedded TEAM_LABEL_JSON; confirmed.astro is intentionally generic per D-16 |

REQUIREMENTS.md already marks all four SHARE-* as `[x] Complete` and maps them to Phase 14 only (no orphans).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/copy.ts` | `shareText(teamLabel, url)` exported helper (D-08 template verbatim) | VERIFIED | Line 6-8: `export function shareText(teamLabel: string, url: string): string { return \`I'm following ${teamLabel} — get your team's World Cup kickoff alerts.\n${url}\`; }`; em-dash (U+2014) and LF newline confirmed; 3 existing exports preserved (NO_ACCOUNT_TITLE, NO_ACCOUNT_BODY, REENTRY_CTA) |
| `src/pages/api/signup.ts` | 303 Location carries &rc=<code>&team=<slug> on success only | VERIFIED | Line 174: `\`/pending?email=${encodeURIComponent(rawEmail)}&rc=${encodeURIComponent(row.referral_code)}&team=${encodeURIComponent(rawTeam)}\``; live curl returned `Location: /pending?email=verify14%40example.com&rc=rhz4j46o&team=brazil`. Honeypot (line 61: `Location: '/pending'`) and `back()` (line 42: `/?error=...`) unchanged. Defensive null-guard at line 157-160. |
| `src/pages/api/confirm.ts` | 303 Location carries &rc= on status=ok and status=already (only) | VERIFIED | Lines 20-22: ok branch with rc-or-bare fallback; lines 29-31: already branch same pattern; lines 9, 12, 34: bad-token / unknown deliberately omit rc per D-02; smoke SHARE-confirm-redirect-location asserts both ok and already paths against a real DB-resolved referral_code (PASS in live run) |
| `src/lib/email.ts` | sendMagicLink accepts 5th referralCode param; composes share URL + shareLine; HTML + plaintext bodies both include share line | VERIFIED | Line 23: `referralCode: string` parameter; line 29: `shareUrl = SITE_URL + '/?ref=' + referralCode`; line 30: `shareLine = shareText(teamHuman, shareUrl)`; line 43: `shareLine` in plaintext array; line 69: muted `<p>` with `Know someone else following <strong>${teamHuman}</strong>? Share your link: <a href="${shareUrl}">${shareUrl}</a>` color:#5a5d68 / font-size:13px per D-12; line 82: dev fallback logs `share:` URL; `sendManageLink` byte-identical to pre-plan |
| `src/pages/pending.astro` | Share-card markup + defensive inline `?rc=` reader + `?team=` aware blurb + Web Share / clipboard handler | VERIFIED | Lines 52-66: `<section id="share-card" hidden>` markup; lines 8-10: TEAM_LABEL_JSON serialized at build; line 68: `<script is:inline define:vars={{ TEAM_LABEL_JSON }}>`; line 74: `/^[a-z0-9]{8}$/.test(rc)` regex gate (T-14-11); line 77: shareUrl built from `location.origin`; lines 86, 90: DOM-API value + textContent (no innerHTML); lines 99-125: copyFallback + navigator.share feature-detect + AbortError suppress (T-14-17); curl probe with `?rc=abc12345&team=brazil` returns body containing share-card, share-url, share-btn, TEAM_LABEL_JSON, Brazil, navigator.share |
| `src/pages/confirmed.astro` | Share-card on status=ok / status=already only; generic heading per D-16; NO TEAMS / TEAM_LABEL_JSON / define:vars | VERIFIED | Lines 18-32: `<section id="share-card" hidden>` markup; line 76: new `<script is:inline>` (NO define:vars); line 82: status gate `if (status !== 'ok' && status !== 'already')`; line 87: rc regex gate; lines 93-95: hardcoded `teamLabel = ''` per D-16 (note WR-05 dead-code finding — see Anti-Patterns below); lines 107-133: copyFallback + share handler; confirmed: 0 imports from `lib/teams`, 0 occurrences of `TEAM_LABEL_JSON`, 0 occurrences of `define:vars` |
| `src/pages/manage.astro` | Server-rendered share card inside `{valid && !isUnsubscribed}` branch only; uses user.referral_code + user.team directly | VERIFIED | Lines 6-7: imports `teamLabel` from `./lib/teams` and `shareText` from `./lib/copy`; lines 57-58: `shareUrl` + `shareTextStr` declared; lines 68-73: composed from `process.env.PUBLIC_SITE_URL` + `user.referral_code` + `teamLabel(user.team)` + `shareText(...)` inside the `valid && result` frontmatter branch; lines 310-336: `{shareUrl && (<section class="share-card">...)}` nested INSIDE the `{valid && !isUnsubscribed && (` branch starting at line 233; data-share-text + data-share-url attributes thread to inline script (lines 489-490); lines 480-519: inline script wraps in try/catch with copyFallback + AbortError suppress; share card NOT present in unsubscribed branch (lines 221-230) |
| `scripts/smoke-signup.mjs` | Three new SHARE-* cases; mintToken TS import; SHARE_IP separation; final pass=17 | VERIFIED | Lines 42 (mintToken TS import), 52 (SHARE_IP = '192.0.2.45'), 459 (SHARE-pending-card), 480 (SHARE-confirmed-card), 504 (SHARE-confirm-redirect-location); `node --check scripts/smoke-signup.mjs` exits 0; live run against dev server reports `pass=17 fail=0` |

### Key Link Verification (wiring)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| /api/signup upsert | success 303 Location | `row.referral_code` captured from `upsertVipSignup.get(...)` (RETURNING *) → encodeURIComponent → appended to /pending Location | WIRED | signup.ts:123-132 captures row; line 174 emits Location with &rc=&team= |
| /api/confirm markConfirmed / getByEmail | success 303 Location | result row's `referral_code` field appended to /confirmed?status=ok|already | WIRED | confirm.ts:18-22 (ok path); confirm.ts:27-31 (already path); both guarded against null referral_code |
| sendMagicLink share line | src/lib/copy.ts shareText | named import alongside NO_ACCOUNT_*, REENTRY_CTA | WIRED | email.ts:5 import; email.ts:30 call site `shareText(teamHuman, shareUrl)` |
| sendMagicLink referralCode arg | /api/signup call site | `row.referral_code ?? ''` as 5th positional arg | WIRED | signup.ts:165 `await sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code ?? '');` |
| /pending share card visibility | URL ?rc= + ?team= params | URL.searchParams.get + regex gate + DOM property assignment | WIRED | pending.astro:71-72 reads params; line 74 regex gate; line 86 input value set; line 97 card.hidden = false |
| /confirmed share card visibility | URL ?status= + ?rc= params | URL.searchParams.get + status gate + regex gate | WIRED | confirmed.astro:79 reads status; line 82 status gate; line 85 reads rc; line 87 regex gate; line 105 card.hidden = false |
| /manage share card | user.referral_code + user.team + shareText() / teamLabel() | server frontmatter composes shareUrl + shareTextStr, threaded via data-* attributes to inline script | WIRED | manage.astro:68-72 composes; lines 324, 331-332 data-attribute pass-through; lines 489-490 inline script reads dataset |
| all three pages share button | shareTextStr + shareUrl | inline JS click handler with navigator.share / clipboard fallback | WIRED | Same pattern in all three (verified by AbortError grep across all three files) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| /pending share-card URL input | `shareUrl` | `location.origin + '/?ref=' + rc` where rc passes /^[a-z0-9]{8}$/ regex gate after coming from /api/signup's RETURNING * upsert (Phase 13 column) | YES (live curl probe returned actual rc=rhz4j46o from real DB write) | FLOWING |
| /pending share-card blurb | `teamLabel` | `JSON.parse(TEAM_LABEL_JSON)[teamSlug]` where TEAM_LABEL_JSON is the build-time-serialized 48-entry slug→label map from references/teams.json | YES (live curl body contains "Brazil" when team=brazil; TEAM_LABEL_JSON includes all 48 labels) | FLOWING |
| /confirmed share-card URL input | `shareUrl` | `location.origin + '/?ref=' + rc` where rc comes from /api/confirm's 303 query string (smoke asserts real DB-resolved rc) | YES (smoke SHARE-confirm-redirect-location asserts /api/confirm Location matches `/confirmed?status=ok&rc=<real_code>`) | FLOWING |
| /manage share-card URL input | `shareUrl` | `process.env.PUBLIC_SITE_URL + '/?ref=' + user.referral_code` composed in Astro frontmatter; user.referral_code from getByEmail (DB query on verified session email) | YES (server frontmatter has full row in scope; conditional `{shareUrl && (...)}` guards null case) | FLOWING |
| /manage share-card blurb | `teamLabel(user.team)` | server-side call to teamLabel from references/teams.json | YES (verified by direct frontmatter code reading + teamLabel signature already in production use since v2.0) | FLOWING |
| Email body share line (HTML + plaintext) | `shareLine` and `<a href="${shareUrl}">` | shareText(teamHuman, shareUrl); shareUrl = SITE_URL + '/?ref=' + referralCode; referralCode passed from /api/signup as 5th arg | YES (dev-fallback log shows `share: http://localhost:4321/?ref=<actual-8-char-code>` for every smoke signup) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| /api/signup 303 carries &rc=&team= | `curl -s -i -X POST -H "Origin: http://localhost:4321" -H "X-Forwarded-For: 192.0.2.99" --data "email=verify14@example.com&team=brazil&timezone=America/Sao_Paulo" http://localhost:4321/api/signup` | `HTTP/1.1 303 See Other` + `location: /pending?email=verify14%40example.com&rc=rhz4j46o&team=brazil` | PASS |
| /pending body contains share UI markers | `curl -s "/pending?email=x@y.z&rc=abc12345&team=brazil" \| grep -oE "Brazil\|share-card\|share-url\|TEAM_LABEL_JSON\|navigator.share"` | 1 Brazil, 4 share-card, 5 share-url, 7 share-btn, 2 navigator.share, 2 TEAM_LABEL_JSON | PASS |
| /confirmed body contains share UI markers | `curl -s "/confirmed?status=ok&rc=abc12345" \| grep -cE "share-card\|share-url\|navigator.share\|status !== 'ok'"` | 7 (markup + script logic present) | PASS |
| Email dev-fallback logs share URL | grep `share:` /tmp/oddlympics-dev.log | Multiple entries: `share: http://localhost:4321/?ref=<actual-8-char-code>` for every signup | PASS |
| node --check scripts/smoke-signup.mjs | `node --check scripts/smoke-signup.mjs` | exit 0, no output | PASS |
| Full smoke E2E | `node scripts/smoke-signup.mjs` against npm run dev | `pass=17 fail=0` (including 3 new SHARE-* cases) | PASS |
| Email share line in source | `grep "Know someone else following.*<strong>" src/lib/email.ts` | Line 69 matches the locked D-12 muted `<p>` with the team `<strong>` interpolation | PASS |
| AbortError suppression on all 3 pages | `grep "AbortError" pending.astro confirmed.astro manage.astro` | All three contain `if (e && e.name === 'AbortError') return;` (T-14-17 honored) | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist in this project. The probe-equivalent is `scripts/smoke-signup.mjs` (project-specific HTTP smoke), which was run end-to-end and reported `pass=17 fail=0` — recorded under Behavioral Spot-Checks above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/confirmed.astro | 93-95 | Dead code: `const teamLabel = ''; ... (teamLabel \|\| 'my team')` always resolves to `'my team'` | Info (WR-05 from REVIEW) | The `(teamLabel \|\| 'my team')` short-circuit is intentional doctrinal placeholder per D-16, but as written it is dead branching that obscures intent. Does not impair goal — the rendered share text is correct ("my team"). Recommend collapsing to literal in a follow-up. |
| src/pages/pending.astro, src/pages/confirmed.astro | 80-81, 94-95 | Share-text template literal hand-duplicated (WR-02 from REVIEW) | Warning | D-11 mandates a single template; the two prerendered pages cannot import shareText (TS) into inline browser scripts, so the literal is duplicated. Three copies of `"I'm following … — get your team's World Cup kickoff alerts."`. Email + /manage import shareText; pending + confirmed duplicate. A future copy edit must be propagated to four places, not one. NOT a goal-blocker (current output matches), but a known drift risk. |
| scripts/smoke-signup.mjs | 459-496 | SHARE-pending-card + SHARE-confirmed-card grep substrings that exist in static markup regardless of rc presence (WR-01 from REVIEW) | Warning | The literals `share-card`, `share-url`, and even `Brazil` (embedded in TEAM_LABEL_JSON for all 48 teams) ship in the prerendered HTML regardless of `?rc=` runtime injection. A regression that deletes the entire inline `<script>` block would still pass these two cases. SHARE-confirm-redirect-location (the third new case) DOES verify real behavior — and it passes. So Phase 14 goal is verified; the smoke just has weaker coverage than its names suggest. |
| src/pages/pending.astro | 78-79 | `?team=` value resolves through `labels[teamSlug]` without `Object.hasOwn` — `?team=__proto__` could resolve to `Object.prototype` (WR-04 from REVIEW) | Warning | NOT XSS (textContent + DOM-property auto-escape), but `?team=__proto__` would render "I'm following [object Object] — …" share copy. Acceptable failure mode (visible self-XSS only, no script execution), but should be hardened with `Object.hasOwn(labels, teamSlug)` plus a slug-shape regex. |
| src/pages/api/confirm.ts | 11 | `verifyToken(token)` called without `expectedPurpose='confirm'` (IN-01 from REVIEW) | Info (pre-existing) | Pre-Phase-14 behavior. Tokens with `purpose='manage'/'unsubscribe'/'session'` could in theory be replayed as confirm-purpose. The token still requires the server secret to mint, so the attack surface is "user replays own legitimately-issued manage link as confirm" — minor impact. Not introduced by Phase 14. |
| scripts/smoke-signup.mjs | 403-429 | REF-self-ref smoke case uses `allRows[0]` without ORDER BY (WR-03 from REVIEW) | Warning (pre-existing Phase 13 code) | Stale row may be picked on subsequent runs if cleanup didn't fire. Today the case still passes because all smoke-ref-a-% rows have referred_by=NULL. Not introduced by Phase 14 — the new SHARE-confirm-redirect-location case correctly uses a per-run unique email. |

**No blocker-level anti-patterns**. No unreferenced debt markers (TBD/FIXME/XXX) in Phase 14-modified code — the three `TBD` matches in manage.astro (lines 102, 112, 352) are SQL placeholder variable / 'TBD' literal team fallback, all pre-existing.

### Human Verification Required

Five items deferred to human walk-through (see frontmatter `human_verification:` for full details):

1. **Native share sheet on mobile (SC3, D-20)** — Tap Share on /pending/confirmed/manage with real ?rc= on iOS Safari + Android Chrome; verify OS share sheet opens with team-named text + URL; cancel share → no "Copied!" fall-through.
2. **Clipboard fallback on desktop (SC3, D-20)** — Click Share on the same three pages in Chrome/Safari/Firefox; verify "Copied!" 1.5s flash + paste-back confirms URL in clipboard.
3. **Hidden-when-empty branches (D-03, D-16)** — Visit /pending and /confirmed without params + /confirmed?status=bad-token + /confirmed?status=unknown; visually verify share card is not rendered.
4. **Cross-client email rendering (SC2, D-20)** — Trigger real signup; inspect confirmation email in Apple Mail / Gmail / Outlook web / Proton; verify muted share `<p>` + `<strong>team</strong>` + clickable URL + plaintext fallback.
5. **/manage share card visibility per branch (D-17)** — Sign in / sign out / expire token / unsubscribe; verify share card only appears in signed-in non-unsubscribed branch.

These were locked in CONTEXT.md as D-20: "No new Playwright/Puppeteer dependency. The navigator.share / navigator.clipboard behavior is browser-specific and is verified manually in a checklist on /pending (the operator will exercise it during Phase 4 launch-week observation or pre-launch walk-through)."

### Gaps Summary

**No blocker gaps.** All four roadmap Success Criteria (SC1–SC4) and all four declared requirements (SHARE-01..04) are met in code:

- The transport layer (Phase 14-02) successfully threads the referral code through both 303 redirects with team slug — verified by live curl and the smoke `SHARE-confirm-redirect-location` case that asserts the Location format with a real DB-resolved code.
- The share-text helper (Phase 14-01) is the single source of truth for email and /manage; pending and confirmed inline-duplicate the literal (acknowledged WR-02 drift risk).
- The email body (Phase 14-03) renders the muted share `<p>` and plaintext shareLine, with the URL built from `SITE_URL` (D-07).
- The share UI (Phase 14-04) is wired on all three pages with regex-gated rc validation, DOM-property value assignment, textContent for blurb (no innerHTML sinks), Web Share + clipboard feature-detection, AbortError suppression on all three.
- The smoke (Phase 14-05) passes 17/17 end-to-end against a live dev server, including the three new SHARE-* cases.

**Status: human_needed** (not `passed`) because SC3 explicitly requires runtime browser-API behavior that cannot be smoke-tested without Playwright/Puppeteer; the project has chosen (D-20) to defer this to operator walk-through. The five human-verification items above are the standard pre-launch checklist for this phase. None of them are likely to fail given the code-path verification, but they are not yet executed.

Once the human walk-through completes successfully (estimated <15 minutes across iOS, Android, and 3 desktop browsers), this phase can be marked `passed` without code changes.

### Notable Observations (informational, not gating)

- **Phase 14 REVIEW.md already flagged 5 warnings and 4 info findings (zero critical)**; all five warnings are surfaced under "Anti-Patterns Found" above. The REVIEW's recommended fixes (Object.hasOwn hardening on /pending, ORDER BY on REF-self-ref smoke, dead-code collapse on /confirmed, smoke assertion strengthening, share-text DRY via define:vars) are quality improvements, not goal-blocking defects.
- **Plan 14-05 documented two Rule-1 auto-fixes** in its SUMMARY: team slug `usa` → `united_states` (the smoke as literally written would have failed because `usa` is not a slug in references/teams.json) and per-run unique email via `Date.now()` (the smoke would have been non-idempotent across runs). Both are good catches and now in the live smoke.
- **Pre-existing `@types/node` baseline noise** in `npx astro check` (~20 errors across token.ts, db.ts, session.ts, email.ts, api/*.ts) is unchanged in character from Phases 14-01..14-04 and is explicitly out of scope per each plan's `<scope_boundary>` rule. Plan 14-04 added one new `process` reference at manage.astro:69 with the same root cause. Runtime is unaffected (Node 22+ ships these built-ins natively).
- **Phase 15 covers `/r/CODE` per-team OG image work** — Phase 14 intentionally uses `/?ref=CODE` (D-14) so links continue to work even if Phase 15 is trimmed. Not a deferred Phase 14 gap.

---

_Verified: 2026-05-23T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
