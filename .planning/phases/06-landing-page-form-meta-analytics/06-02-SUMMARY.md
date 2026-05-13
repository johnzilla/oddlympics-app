---
phase: 06-landing-page-form-meta-analytics
plan: 02
subsystem: ui
tags: [astro, inline-script, plausible, analytics, timezone, form, prerender, dom-contract]

# Dependency graph
requires:
  - phase: 06-landing-page-form-meta-analytics
    plan: 01
    provides: "src/pages/index.astro DOM scaffolding — <span id=\"tz-label\">your local time</span>, <input id=\"timezone\" value=\"\">, <form id=\"signup-form\">, <p id=\"error\" hidden>, plus the Plausible global-shim in <head>"
provides:
  - "Inline <script is:inline> block at src/pages/index.astro:198-248 — three concerns: tz-label swap + hidden tz field population (CONTEXT D-03/D-04/D-05), ?error= rendering (FORM-03 / COMPAT-02 verbatim from v1), Plausible Signup Submit submit listener (ANLTC-01; D-09/D-11/D-12)"
  - "Client-side capture of Intl.DateTimeFormat().resolvedOptions().timeZone into the hidden #timezone form field — feeds POST /api/signup which already validates against VALID_TZ + falls back to FALLBACK_TZ=America/New_York (Phase 5)"
  - "Dev-only [plausible] Signup Submit console log gated by location.hostname === 'localhost' || '127.0.0.1' — mirrors src/lib/email.ts [email-dev-fallback] precedent"
affects: [06-03, 11-launch-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-concern inline <script is:inline> block, each concern wrapped in its own try{}catch{} so one thrown exception does not block the others — enables a single inline-script block to take multiple cross-cutting client responsibilities without coupling failure modes"
    - "CONTEXT D-03 city-label algorithm: tz.split('/').pop().replace(/_/g,' ') + ' time' — zero allow-list maintenance; handles 600+ IANA strings + multi-segment names like America/Indiana/Indianapolis"
    - "Fire-and-forget Plausible submit listener — no preventDefault, relies on pa-*.js sendBeacon path for unload-safe transmission (CONTEXT D-09); Phase 11 AC11 verifies dashboard side"
    - "Empty-team guard in submit listener: if (!form.team.value) return; — guarantees every dashboard event has a non-empty team prop even though HTML5 required should preempt this (CONTEXT D-11)"
    - "textContent-only DOM writes (never innerHTML) for both tz-label and ?error= rendering — XSS-safe by construction even though ?error= is user-controllable via URL"

key-files:
  created: []
  modified:
    - "src/pages/index.astro — appended 52 lines (lines 198-248: one <script is:inline> block; previous total 555 → 607)"

key-decisions:
  - "Combined block over three separate blocks — recommended in plan §Action and per RESEARCH §Open Questions #3; one fewer <script is:inline> opening/closing tag pair, equivalent CSP posture, slightly more compact for code review. The three try{}catch{} concerns inside are visually separated by blank lines + a one-line comment per concern."
  - "ASCII apostrophe (0x27) in 'email: \"We couldn\\'t send the confirmation email. Try again in a minute.\"' — the plan AC's parenthetical note '(note the curly apostrophe U+2019)' is inconsistent with (a) the AC's own grep -F search string bytes (ASCII), (b) v1 src/pages/index.astro:62 (verified hex: 0x27), and (c) Plan 01's ASCII-throughout precedent. Followed canonical sources + AC search bytes (Rule 1 deviation, see below)."
  - "Em-dash U+2014 preserved verbatim in 'That email looks off — try again.' — v1 hex verified (0xe2 0x80 0x94); plan AC tolerates either."
  - "Block placed after </footer> just before </body> — ensures all four target DOM nodes (#tz-label, #timezone, #signup-form, #error) have been parsed by the time the script runs (plan said anywhere after </form>; end-of-body is the safest position and matches the established Astro-page pattern)."

patterns-established:
  - "Three-concern try-isolated inline script — a single <script is:inline> block taking cross-cutting client responsibilities (data capture + URL-param swap + analytics event) with each concern in its own try{}catch{}. Adopt for any future page that needs >1 inline-script concern without spawning a script-block-per-concern."

requirements-completed: [ANLTC-01]

# Metrics
duration: ~2min
completed: 2026-05-13
---

# Phase 06 Plan 02: Inline JS — tz-label swap + ?error= swap + Plausible Signup Submit listener Summary

**Appended one combined `<script is:inline>` block to `src/pages/index.astro` (lines 198-248, after `</footer>`, before `</body>`) that completes Plan 01's DOM scaffolding — captures the browser timezone into the hidden form field + swaps the sub-headline city label, retains v1's `?error=` rendering verbatim, and fires the Plausible `Signup Submit` custom event on form submit (requirement ANLTC-01).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-13T23:45:03Z
- **Completed:** 2026-05-13T23:47:11Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Appended one `<script is:inline>` block to `src/pages/index.astro` at lines 198-248 (combined block holding three concerns).
- **Concern 1 (D-03/D-04/D-05):** reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, unconditionally writes raw IANA string into `#timezone.value` (server falls back at `src/lib/timezones.ts` if invalid), and applies the city-label algorithm `tz.split('/').pop().replace(/_/g,' ') + ' time'` to `#tz-label.textContent` when `tz` has a slash and is not `Etc/*`. UTC / `Etc/*` / `Intl`-missing / empty → span stays at SSR fallback `your local time`.
- **Concern 2 (FORM-03 / COMPAT-02):** verbatim port of v1's `?error=` COPY map (six keys + `'Something went wrong.'` default fallback). All bytes match v1 (em-dash U+2014 in `'bad-email'`; ASCII apostrophe in `'email'` key — see Decisions). Uses `textContent` (not `innerHTML`) on a fixed-key lookup-table — XSS-safe even though `?error=` is user-controllable.
- **Concern 3 (ANLTC-01; D-09/D-11/D-12):** submit listener on `#signup-form` that reads `form.team.value`, returns silently if empty (D-11 empty-team guard), calls `window.plausible('Signup Submit', { props: { team } })` fire-and-forget (no `preventDefault` — relies on Plausible's `pa-*.js` `sendBeacon` path for unload-safe transmission per CONTEXT D-09), and emits `console.log('[plausible] Signup Submit', { team })` only when `location.hostname` is `localhost` / `127.0.0.1` (D-12 — mirrors `[email-dev-fallback]` in `src/lib/email.ts`).
- Each concern wrapped in its own `try { ... } catch {}` so an exception in one (e.g. ancient browser missing `Intl`) does not block the others.
- All 17 plan source-level ACs PASS (Intl call, four `getElementById` targets, `addEventListener('submit', ...)`, six COPY-map strings, dev-log tag, both hostname literals).
- All 5 plan rendered-HTML ACs PASS (`! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html`, `grep -F 'Signup Submit' dist/client/index.html`, `grep -F 'getElementById' dist/client/index.html`, `grep -F 'That email looks off' dist/client/index.html`, `grep -F 'tz-label' dist/client/index.html`).
- Both negative source ACs PASS (`! grep -F 'innerHTML' src/pages/index.astro`, `! grep -F 'preventDefault' src/pages/index.astro`).
- `npm run build` exits 0. `npx astro check` reports zero errors on `src/pages/index.astro` (only the same pre-existing line-64 hint about the Plausible `<script async>` tag that Plan 01's Self-Check documented, plus 19 pre-existing `src/lib/*.ts` errors out of scope per SCOPE BOUNDARY).

## Task Commits

1. **Task 1: Append the combined inline JS block to src/pages/index.astro** — `b12044e` (feat)

**Plan metadata commit:** (next, includes this SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified

- `src/pages/index.astro` — 52 lines inserted at lines 198-248 (the new `<script is:inline>` block, positioned after `</footer>` and before `</body>`). No other lines touched. Previous file size 555 → 607 lines.

## Inline-Script Structure (per plan §output)

- **Final structure:** ONE combined `<script is:inline>` block (52 lines including outer `<script>` / `</script>` tags).
- **Rationale:** Plan §Action recommends the combined block; RESEARCH §"Open Questions" #3 notes splitting offers no measurable benefit. The three concerns inside are visually separated by blank lines + a single one-line `//` comment per concern (CLAUDE.md §"What you won't see" — only why-comments; the three comments document the canonical-source link for each concern: `CONTEXT D-03 / D-04 / D-05`, `FORM-03 / COMPAT-02 — verbatim from v1`, `ANLTC-01; CONTEXT D-09 / D-11 / D-12`).
- **Exact line range:** `src/pages/index.astro:198-248` (verified via `grep -n "<script is:inline>" src/pages/index.astro` → lines 65 and 198; the head shim is at 65-68, the new block is at 198-248).

## Decisions Made

- **Combined block over three separate blocks** — chose the combined block recommended in plan §Action. CONTEXT discretion allows three separate blocks; both are equivalent per RESEARCH §Open Questions #3. Combined is slightly more compact for code review and uses one fewer `<script is:inline>` opening/closing tag pair.
- **ASCII apostrophe (0x27) in `email: "We couldn't send the confirmation email. ..."`** — the plan AC line says "(note the curly apostrophe U+2019)" in a parenthetical, BUT the AC's own `grep -F` search string uses ASCII apostrophe AND v1 `src/pages/index.astro:62` uses ASCII (verified via `git show e7cf984:src/pages/index.astro | grep "couldn" | xxd` → bytes `27`, not `e2 80 99`) AND FORM-03 mandates verbatim retention from v1 AND Plan 01 already established the ASCII-throughout precedent for this codebase (Plan 01 Decision 1). Tracked below as Rule 1 deviation.
- **Em-dash U+2014 preserved verbatim in `'bad-email': 'That email looks off — try again.'`** — v1 hex verified (`0xe2 0x80 0x94`); plan AC tolerates either ASCII hyphen or em-dash but v1 uses em-dash, so verbatim port keeps em-dash.
- **Script placed after `</footer>` before `</body>`** — plan accepted anywhere after the form's `</form>` close; end-of-body is the safest position (guarantees all 4 target DOM nodes have parsed) and matches the established Astro-page pattern across `pending.astro` / `confirmed.astro` / `unsubscribed.astro` (inline scripts placed inside `<body>` near their target DOM).

## Manual Spot-Check (Recorded; not executable in executor environment)

The plan §AC includes a 3-zone DevTools tz-spoof + a `?error=bad-email` URL check. The executor does not have a browser. These are deferred to:

- **Plan 03 smoke script** — will curl + grep the served HTML and (where possible) headless-browser the 3 IANA zones.
- **Phase 11 AC11** — end-to-end launch gate; verifies Plausible dashboard receives `Signup Submit` events.

What the script WILL do at runtime (logic walk-through, recorded for traceability):

| DevTools tz override | `tz` value read | Algorithm trace | `#tz-label.textContent` after swap |
|---|---|---|---|
| `America/Detroit` | `"America/Detroit"` | has `/`, not `Etc/*` → `["America","Detroit"].pop()` = `"Detroit"` → `.replace(/_/g, ' ')` = `"Detroit"` → `+ ' time'` = `"Detroit time"` | `"Detroit time"` |
| `Europe/London` | `"Europe/London"` | has `/`, not `Etc/*` → `"London"` → `"London time"` | `"London time"` |
| `Africa/Lagos` | `"Africa/Lagos"` | has `/`, not `Etc/*` → `"Lagos"` → `"Lagos time"` | `"Lagos time"` |
| `America/Indiana/Indianapolis` | `"America/Indiana/Indianapolis"` | has `/`, not `Etc/*` → `.pop()` = `"Indianapolis"` → `"Indianapolis time"` | `"Indianapolis time"` |
| `America/New_York` | `"America/New_York"` | has `/`, not `Etc/*` → `"New_York"` → `.replace(/_/g, ' ')` = `"New York"` → `"New York time"` | `"New York time"` |
| `UTC` | `"UTC"` | no `/` → algorithm skipped | unchanged: `"your local time"` (D-05 fallback) |
| `Etc/GMT+5` | `"Etc/GMT+5"` | has `/` but starts with `Etc/` → algorithm skipped | unchanged: `"your local time"` (D-05 fallback) |
| (Intl missing / throws) | n/a — outer `try { } catch {}` swallows | n/a | unchanged: `"your local time"` (D-05 fallback) |

`#timezone.value` is set unconditionally to the raw IANA string in every case (including `UTC` / `Etc/GMT+5` / empty) — server-side `/api/signup` validates against `VALID_TZ` and falls back to `FALLBACK_TZ = 'America/New_York'` per Phase 5 D-03 (SIGNUP-02).

`?error=bad-email` URL: when navigated to, the `try { ... } catch {}` block reads the param, looks up `COPY['bad-email']` = `"That email looks off — try again."` (with em-dash U+2014), sets `#error.textContent` = that string, and sets `#error.hidden = false`. Bytes verified at file save.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan AC parenthetical says "curly apostrophe U+2019"; canonical source bytes + AC search string + Plan 01 precedent all use ASCII**

- **Found during:** Task 1 (when transcribing the COPY map from v1).
- **Issue:** Plan 02 §`<acceptance_criteria>` line says: `grep -F "We couldn't send the confirmation email. Try again in a minute." src/pages/index.astro` exits 0 (note the curly apostrophe U+2019). The parenthetical "(note the curly apostrophe U+2019)" contradicts: (a) the `grep -F` search string itself, which uses ASCII apostrophe; `grep -F` matches literal bytes, so a curly apostrophe in the file would NOT match an ASCII apostrophe search; (b) v1 `src/pages/index.astro:62` byte-verified `27` (ASCII) — `git show e7cf984:src/pages/index.astro | grep "couldn" | xxd` → `0x27`, not `0xe2 0x80 0x99`; (c) FORM-03 mandates verbatim retention from v1, which uses ASCII; (d) Plan 01 §Decisions Made #1 established the ASCII-throughout precedent for this codebase and explicitly cited this same inconsistency. Using curly U+2019 would (i) FAIL the AC's own `grep -F` check AND (ii) silently regress against v1 bytes.
- **Fix:** Used ASCII apostrophe (`couldn't` with `0x27`) — matches v1 bytes verbatim, satisfies the AC grep check, consistent with Plan 01.
- **Files modified:** `src/pages/index.astro`
- **Verification:** `grep -F "We couldn't send the confirmation email. Try again in a minute." src/pages/index.astro` exits 0; `git show b12044e:src/pages/index.astro | grep "couldn" | xxd` shows byte `0x27`, not `e2 80 99`.
- **Committed in:** `b12044e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — internal-inconsistency-in-plan, same class as Plan 01 deviation #1)
**Impact on plan:** Zero scope change. Fix preserves the plan's INTENT (FORM-03 verbatim retention from v1; AC grep checks pass).

## Issues Encountered

- **Pre-existing `npx astro check` errors** — 19 errors in `src/lib/{db,email,rate-limit,session,token}.ts` (missing `@types/node` etc.) and one pre-existing line-64 warning in `src/pages/index.astro` about the Plausible `<script async>` tag pattern. All exist on `main` BEFORE this plan ran (verified by Plan 01's Self-Check). Per SCOPE BOUNDARY, out of scope for this plan. Plan 01 already documented these; nothing new.

- **No new errors or warnings introduced by Plan 02** — the new 52-line `<script is:inline>` block has `is:inline` directive so it doesn't trip the same Astro 4000 hint as the head shim, and contains no TypeScript references (plain JS, no `@types/node`-dependent globals).

## User Setup Required

None. (Plausible custom-goal `Signup Submit` configuration in the dashboard is a Plan 03 / pre-deploy operator action per CONTEXT D-10 / R-4 — Plan 02 ships the firing-call code only; without the dashboard goal, events are accepted and counted as anonymous events but not surfaced on the goals page.)

## Next Plan Readiness

**Plan 03 (verification — smoke script + Lighthouse mobile) prerequisites are in place:**

- All requirements LAND-01 through ANLTC-01 (8 of 9 phase requirements) are now satisfied in source + rendered HTML. Plan 03's smoke script can curl-and-grep:
  - `Signup Submit` (in dist/client/index.html — ANLTC-01 firing-call)
  - All 6 COPY-map strings (in dist/client/index.html — FORM-03 verbatim retention)
  - `Intl.DateTimeFormat().resolvedOptions().timeZone` (in dist/client/index.html — D-04 SSR tz capture)
  - `getElementById('signup-form')` etc. (in dist/client/index.html — Plan 02 DOM hooks bound)
- LAND-02 canonical command continues to pass (`! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html`).
- The 5 DOM hooks Plan 01 shipped (`#tz-label`, `#timezone`, `#signup-form`, `#error`, the Plausible global-shim) are all now wired by Plan 02's script.

**Pre-deploy operator action (R-4 / CONTEXT D-10):** Configure the Plausible custom goal `Signup Submit` at `https://plausible.io/oddlympics.app/settings/goals` BEFORE merging the Phase 06 branch to `main`. Tracked as a Plan 03 task per plan §threat_model R-4.

**Known stubs:** None. All ANLTC-01 / FORM-03 / D-03/D-04/D-05/D-09/D-11/D-12 contracts shipped fully.

## Self-Check

Verifying all claims:

**Files modified:**
- `src/pages/index.astro` — FOUND, modified at commit `b12044e` (+52 lines: 555 → 607)

**Commit:**
- `b12044e` — FOUND in `git log` (`git log --oneline -1` shows `b12044e feat(06-02): inline JS — tz-label swap + ?error= swap + Plausible Signup Submit listener (ANLTC-01, FORM-03)`)

**Source-level ACs (per plan §acceptance_criteria):**

| AC | Command | Result |
|----|---------|--------|
| 1 | `grep -F "Intl.DateTimeFormat().resolvedOptions().timeZone" src/pages/index.astro` | PASS |
| 2 | `grep -F "getElementById('tz-label')" src/pages/index.astro` | PASS |
| 3 | `grep -F "getElementById('timezone')" src/pages/index.astro` | PASS |
| 4 | `grep -F "getElementById('signup-form')" src/pages/index.astro` | PASS |
| 5 | `grep -F "addEventListener('submit'" src/pages/index.astro` | PASS |
| 6 | `grep -F "plausible('Signup Submit'" src/pages/index.astro` | PASS (ANLTC-01) |
| 7 | `grep -F "[plausible] Signup Submit" src/pages/index.astro` | PASS (D-12) |
| 8 | `grep -F "localhost" src/pages/index.astro` | PASS |
| 9 | `grep -F "127.0.0.1" src/pages/index.astro` | PASS |
| 10 | `grep -F "That email looks off" src/pages/index.astro` | PASS (FORM-03) |
| 11 | `grep -F "Submission blocked. Please use the form on this page." src/pages/index.astro` | PASS |
| 12 | `grep -F "Too many tries. Wait an hour and try again." src/pages/index.astro` | PASS |
| 13 | `grep -F "We couldn't send the confirmation email. Try again in a minute." src/pages/index.astro` | PASS (ASCII apostrophe per Decision; see Deviation 1) |
| 14 | `grep -F "Server hiccup. Try again in a minute." src/pages/index.astro` | PASS |
| 15 | `grep -F "Something went wrong." src/pages/index.astro` | PASS (default fallback) |
| 16 | `! grep -F "innerHTML" src/pages/index.astro` | PASS (XSS hardening) |
| 17 | `! grep -F "preventDefault" src/pages/index.astro` | PASS (D-09 fire-and-forget) |
| 18 | `! grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' src/pages/index.astro` | PASS (LAND-02 source) |

**Build / type ACs:**

| AC | Command | Result |
|----|---------|--------|
| B1 | `npm run build` | PASS (exit 0, completed in 638ms) |
| B2 | `npx astro check` | 0 errors on `src/pages/index.astro` (19 pre-existing `src/lib/*.ts` errors out of scope per SCOPE BOUNDARY + Plan 01 precedent; same pre-existing Plausible-tag hint as Plan 01) |

**Build-artifact ACs:**

| AC | Command | Result |
|----|---------|--------|
| D1 | `! grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/index.html` | PASS (LAND-02 holds) |
| D2 | `grep -F "Signup Submit" dist/client/index.html` | PASS (ANLTC-01 survives build) |
| D3 | `grep -F "getElementById" dist/client/index.html` | PASS (inline script survives build) |
| D4 | `grep -F "That email looks off" dist/client/index.html` | PASS (FORM-03 verbatim survives build) |
| D5 | `grep -F "tz-label" dist/client/index.html` | PASS (DOM hook + script reference both present) |

**Plan canonical-verify gate (single composite from §`<verify><automated>`):**

```
npm run build && \
  ! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html && \
  grep -F 'Signup Submit' dist/client/index.html && \
  grep -F 'getElementById' dist/client/index.html && \
  grep -F 'That email looks off' dist/client/index.html && \
  grep -F 'tz-label' dist/client/index.html && \
  ! grep -F 'innerHTML' src/pages/index.astro && \
  ! grep -F 'preventDefault' src/pages/index.astro
=> ALL CANONICAL VERIFY GATES PASS
```

**Manual viewport / 3-zone tz spoof / `?error=bad-email` URL check:** Deferred to Plan 03 smoke / Phase 11 AC11 — executor has no browser. Logic walk-through table above documents the exact `#tz-label.textContent` value for each of the 8 reference cases (5 city-label cases + 3 fallback cases).

## Self-Check: PASSED

---
*Phase: 06-landing-page-form-meta-analytics*
*Completed: 2026-05-13*
