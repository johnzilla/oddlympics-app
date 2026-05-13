---
phase: 06-landing-page-form-meta-analytics
plan: 01
subsystem: ui
tags: [astro, landing-page, html, css, og-meta, twitter-card, form, accessibility, prerender]

# Dependency graph
requires:
  - phase: 05-schema-signup-payload
    provides: "src/lib/teams.ts (TEAMS + VALID_TEAMS), src/lib/timezones.ts (FALLBACK_TZ), POST /api/signup widened for team+timezone payload, references/teams.json (48 World Cup teams + slug + confederation)"
provides:
  - "v2.0 consumer World Cup 2026 landing at `src/pages/index.astro` — banner pill + headline + sub-headline with tz-label span + form-card + 4 below-fold sections + consumer footer"
  - "48-team confederation-grouped `<select>` rendered at build time from `references/teams.json` (UEFA→CONMEBOL→CONCACAF→CAF→AFC→OFC, em-dash `<optgroup>` labels)"
  - "All 13 OG + Twitter card meta tags + new `<title>` + `<meta name=\"description\">` per UI-SPEC §Meta tags (META-01)"
  - "Hidden `<input id=\"timezone\">` + visible `<select name=\"team\">` + retained honeypot + `requested_sport=world_cup` + form `id=\"signup-form\"` — DOM targets for Plan 02 inline JS"
  - "Light/sans-serif consumer aesthetic CSS retune (`--bg #fafaf7`, `--fg #14151a`, `--accent #d94a1f`, `--font-sans` system stack, `--font-mono` scoped to micro-accents)"
  - "Zero occurrences of `bitcoin|lightning|crypto|world domination|personal olympics` in dist/client/index.html (LAND-02 source + rendered gate)"
affects: [06-02, 06-03, 07-privacy-terms, 08-og-image, 11-launch-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time JSON import via `import { TEAMS } from '../lib/teams'` (re-uses Phase 5 lib re-export; equivalent to direct `with { type: 'json' }` syntax)"
    - "CONFEDERATION_ORDER tuple + record-typed CONFEDERATION_LABEL map + `groupedTeams` derivation for `<optgroup>` rendering"
    - "Hardcoded `https://oddlympics.app/*` meta-tag URLs (NOT derived from `Astro.site`) per CONTEXT D-08"
    - "SSR-default `<span id=\"tz-label\">your local time</span>` inside sub-headline — JS-off readable, Plan 02 swaps to city label"
    - "Empty `<input type=\"hidden\" id=\"timezone\" value=\"\">` and `<p id=\"error\" hidden></p>` host elements wired for Plan 02 inline scripts"
    - "Native `<details>`/`<summary>` accordions with `+`/`−` glyph via `::after` pseudo-element (no JS)"
    - "Inline `<style is:global>` retune: 4 type sizes (clamp(28,5vw,40)/17/15/13), 2 weights (400/700), 8-token spacing scale (multiples of 4), light/sans palette"

key-files:
  created: []
  modified:
    - "src/pages/index.astro — full rewrite (147 lines deleted, 448 lines inserted; 254 → 555 lines)"

key-decisions:
  - "Used ASCII apostrophe (0x27) throughout body copy instead of curly U+2019 — every canonical source (UI-SPEC tables, references/oddlympics_landing_copy.md, plan AC `grep -F` strings) uses ASCII; plan prose mention of \"curly apostrophe\" was inconsistent with the AC checks and canonical doc bytes."
  - "Imported via `import { TEAMS } from '../lib/teams'` (proper typed re-export from Phase 5 lib helper) instead of direct `import teams from '../../references/teams.json' with { type: 'json' }` — plan allows either; the lib helper gives typed `TeamEntry[]` for free."
  - "Honeypot `<input>` collapsed onto a single line in source — multi-line attribute syntax broke the canonical AC regex `grep -E '<input[^>]+name=\"website\"[^>]+class=\"hp\"'`. CSS rule + attribute set still verbatim from v1."
  - "Native `<select>` chevron via inline SVG data-URI background-image stroked in `#5a5d68` (`--fg-dim`); `appearance: none` to suppress browser default."

patterns-established:
  - "Confederation-grouped `<select>` rendering: tuple of order + record of labels + `.map()` to derive `groupedTeams` array of `{conf, label, teams}` — future filterable lists (e.g. niche-sport long tail in v2.1) can re-use this exact shape."
  - "Hardcoded meta-tag URL strategy: when the copy doc is the canonical source for URL strings, hardcode the URLs verbatim rather than deriving from `Astro.site` (precedent for any future canonical-copy block)."
  - "Empty-host-element pattern for cross-plan DOM contracts: Plan 01 ships `<span id=X>fallback</span>` + `<input id=Y value=\"\">` + `<p id=Z hidden></p>`; Plan 02 attaches inline JS that writes into them. Lets a single page be split across plans without breaking JS-off readability."

requirements-completed: [LAND-01, LAND-02, LAND-04, FORM-01, FORM-02, FORM-03, META-01]

# Metrics
duration: ~5min
completed: 2026-05-13
---

# Phase 06 Plan 01: Landing-page rewrite Summary

**Full rewrite of `src/pages/index.astro` to v2.0 consumer World Cup 2026 landing — banner pill + headline + sub-headline (tz-label span) + form-card with 48-team confederation-grouped `<select>` + 4 below-fold sections + 5 FAQ accordions + consumer footer; light/sans-serif retune; all 13 OG/Twitter meta tags; zero prohibited terms.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T23:36:00Z
- **Completed:** 2026-05-13T23:41:28Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Rewrote `src/pages/index.astro` end-to-end (1 file: 254 → 555 lines; +448 / −147)
- Scrubbed all 3 LAND-02 violations from v1 (`World domination` title+headline, `Personal Olympics` description, `Bitcoin/Lightning rails` description) — `grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html` returns 0 matches
- Rendered 6 `<optgroup>`s + 48 team `<option>`s + 1 placeholder `<option>` from `references/teams.json` via build-time JSON import — confederation order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC preserved; em-dash labels (`UEFA — Europe` etc.) verbatim
- Added all 13 OG + Twitter card meta tags (META-01) — hardcoded `https://oddlympics.app/*` URLs per CONTEXT D-08; OG image points at the not-yet-shipped `https://oddlympics.app/og-image.png` (Phase 8 ships PNG; accepted 404 window per CONTEXT D-07)
- Preserved Plausible script tag + global-shim block verbatim from v1
- Preserved honeypot `<input name="website" class="hp">` markup + `.hp` CSS rule verbatim (off-screen-absolute, not `display:none`)
- Retained `<form method="post" action="/api/signup">` + `requested_sport=world_cup` hidden input (FORM-01, FORM-03, COMPAT-02)
- Added `id="signup-form"` on form + empty `<input type="hidden" id="timezone">` + `<p id="error" hidden>` host element — DOM contract ready for Plan 02 inline JS (tz-label swap + `?error=` swap + Plausible Signup Submit listener)
- Retuned `<style is:global>` to light/sans-serif consumer palette: 4 type sizes, 2 weights, 8-token spacing scale, focus rings, native `<details>` `+`/`−` glyph, `prefers-reduced-motion` block, 520px mobile breakpoint

## Task Commits

1. **Task 1: Rewrite src/pages/index.astro frontmatter + `<head>` + `<body>` + `<style is:global>`** — `08ac8e3` (feat)

**Plan metadata commit:** (next, includes this SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified

- `src/pages/index.astro` — full rewrite. Frontmatter: 8 named copy/URL consts + CONFEDERATION_ORDER + CONFEDERATION_LABEL + groupedTeams derivation; `<head>`: 13 OG/Twitter meta tags + title + description + favicon + Plausible script (verbatim) + Plausible global-shim (verbatim); `<body>`: 1 hero `<section>` + 4 below-fold `<section>`s + 1 `<footer>`; `<style is:global>`: 13 `:root` tokens + 35-ish CSS rules covering hero/banner/headline/subhead/form-card/inputs/select/button/fineprint/trust/error/honeypot/below-fold/eyebrow/steps/details/footer/mobile/reduced-motion.

## Decisions Made

- **ASCII apostrophe (0x27) throughout body copy** — plan prose mentions "curly apostrophe U+2019" but every canonical source (UI-SPEC §Copywriting Contract tables, `references/oddlympics_landing_copy.md`, the plan's own `grep -F` ACs) uses ASCII apostrophe. Followed the canonical sources + AC checks; documented as Rule 1 deviation.
- **Imported via `src/lib/teams` TeamEntry re-export** instead of direct `import teams from '../../references/teams.json' with { type: 'json' }` — plan allowed either; lib helper gives typed `TeamEntry[]` for free and matches the proven Phase 5 pattern.
- **Single-line honeypot `<input>`** — collapsed multi-line attribute syntax to one line so the canonical AC regex `grep -E '<input[^>]+name="website"[^>]+class="hp"'` matches in a per-line grep. Same attribute set as v1, no functional change.
- **Native `<select>` chevron via inline SVG data-URI background-image** stroked in `#5a5d68` (`--fg-dim`) — `appearance: none` + `-webkit-appearance: none` to suppress browser default; chevron points down (V) for closed state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan prose says curly apostrophe; canonical sources + ACs use ASCII**

- **Found during:** Task 1 (initial draft used U+2019 per the plan prose)
- **Issue:** Plan §"Copywriting Contract" prose at line 150 states: "Headline: `Your team's matches. ...` (use the curly apostrophe U+2019 in `team's`)" — but the headline string in the plan file uses ASCII `'`; the UI-SPEC §Copywriting Contract table row uses ASCII `'`; `references/oddlympics_landing_copy.md` uses ASCII `'`; the plan's own AC `grep -F "Your team's matches. ..."` uses ASCII `'`. A curly-apostrophe rendering would FAIL the `grep -F` AC.
- **Fix:** Converted all 10 curly apostrophes in the draft back to ASCII (headline, sub-headline, trust line, step 3 body, "Why this exists" P1, "After the World Cup" P1+P2, FAQ Q2/Q3/Q5 bodies). Also normalized "engagement" pings quotes to ASCII straight quotes (`"engagement"`) per UI-SPEC table.
- **Files modified:** `src/pages/index.astro`
- **Verification:** `grep -F "Your team's matches. In your time zone. One ping before kickoff." src/pages/index.astro` exits 0; `grep -c "’" src/pages/index.astro` returns 0.
- **Committed in:** `08ac8e3` (Task 1 commit)

**2. [Rule 1 - Bug] Multi-line `<input>` broke single-line AC regex**

- **Found during:** Task 1 verification pass
- **Issue:** Initial draft wrote the honeypot `<input>` across 8 lines for readability. The canonical AC regex `grep -E '<input[^>]+name="website"[^>]+class="hp"'` runs per-line, so it failed even though the markup is functionally identical to v1.
- **Fix:** Collapsed honeypot `<input>` to a single line. Same attribute set: `type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"`.
- **Files modified:** `src/pages/index.astro`
- **Verification:** `grep -E '<input[^>]+name="website"[^>]+class="hp"' src/pages/index.astro` exits 0.
- **Committed in:** `08ac8e3` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — Bug, internal-inconsistency-in-plan)
**Impact on plan:** Both fixes preserve the plan's INTENT (canonical-source copy + working AC checks). No scope creep; both are byte-level conformance fixes.

## Issues Encountered

- **`npx astro check` reports 19 pre-existing errors in `src/lib/{db,email,rate-limit,session,token}.ts`** — all "Cannot find name 'process'/'Buffer'" / "Cannot find module 'node:*'" / missing `@types/node`. These exist on `main` BEFORE this plan ran (verified via `git stash` round-trip). Per SCOPE BOUNDARY, out of scope; logged as pre-existing tech debt. The single warning on `src/pages/index.astro:64` is the same pre-existing pattern as all 6 other Astro pages — the Plausible `<script async src="...">` triggers a 4000 "should be is:inline" hint. Not introduced here.

- **`grep -c '<optgroup ' dist/client/index.html` returns `1`, not `6` as the plan AC expects** — this is a minified-HTML quirk: Astro emits the entire `<body>` on a single line, so `grep -c` (lines) ≠ number of optgroups. `grep -o '<optgroup ' dist/client/index.html | wc -l` correctly returns 6. The actual rendered content is correct (6 optgroups, 49 options). Plan 03's smoke script should use `grep -o` to count properly.

## User Setup Required

None — no external service configuration required for this plan. (Plausible custom-goal configuration is a Plan 03 pre-deploy operator task per CONTEXT D-10 / R-4.)

## Next Phase Readiness

**Plan 02 prerequisites are in place:**
- `#signup-form` form element exists (Plausible submit listener target)
- `#tz-label` span exists with verbatim SSR fallback text `your local time` (tz-label swap target)
- `#timezone` hidden input exists with empty value (tz capture target)
- `#error` paragraph exists, hidden by default (`?error=` swap target)
- Plausible global-shim is preserved verbatim — queue is ready for `plausible('Signup Submit', { props })` calls

**Plan 03 prerequisites are in place:**
- Form posts to `/api/signup` with all 5 fields (team / email / timezone / requested_sport / website) — smoke script can curl-and-grep
- All 13 META-01 meta tags emit verbatim strings into dist/client/index.html
- LAND-02 gate canonical command (`! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html`) currently exits 0

**Manual viewport check (LAND-04, 390/768/1280 px) is deferred to user verification** — executor has no browser. Phase 11 AC1 will run the canonical visual-diff against `references/landing_preview.png` end-to-end.

**Known stubs:** None. All UI-SPEC contracts shipped fully. The `https://oddlympics.app/og-image.png` URL in the OG meta tags points at an asset that Phase 8 ships — this is intentional per CONTEXT D-06/D-07 and not a stub.

## Self-Check

Verifying all claims:

**Files modified:**
- `src/pages/index.astro` — FOUND (committed at 08ac8e3)

**Commit:**
- `08ac8e3` — FOUND in `git log`

**Source ACs (per plan §acceptance_criteria):**
- LAND-01 headline `grep -F "Your team's matches..."` — PASS
- LAND-01 banner `grep -F "WORLD CUP 2026 · JUNE 11 – JULY 19"` — PASS
- trust line `grep -F "Built by one person in Michigan..."` — PASS
- LAND-04 footer disclaimer `grep -F "Independent project · Not affiliated with FIFA"` — PASS
- footer contact `grep -F "hello@oddlympics.app"` — PASS
- FORM-01 hidden timezone `grep -E '<input[^>]+type="hidden"[^>]+name="timezone"'` — PASS
- FORM-01 hidden requested_sport `grep -E '<input[^>]+type="hidden"[^>]+name="requested_sport"[^>]+value="world_cup"'` — PASS
- FORM-01 honeypot `grep -E '<input[^>]+name="website"[^>]+class="hp"'` — PASS
- FORM-03 form id `grep -E '<form[^>]+method="post"[^>]+action="/api/signup"[^>]+id="signup-form"'` — PASS
- CONTEXT D-04 tz-label `grep -F '<span id="tz-label">your local time</span>'` — PASS
- FORM-03 error host `grep -F '<p id="error" class="error" role="alert" hidden></p>'` — PASS
- META-01 title `grep -F "Oddlympics — World Cup 2026 alerts in your time zone"` — PASS (matches in both TITLE const and OG_IMAGE_ALT const)
- META-01 meta-tag count `grep -E '<13 patterns>' | wc -l` ≥ 13 — PASS (13)
- CONTEXT D-06/D-08 og-image hardcoded `grep -F 'https://oddlympics.app/og-image.png'` — PASS
- LAND-02 source scrub `! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics'` — PASS
- FORM-02 6 optgroup-label regex (source, line-grep) — note: this AC fails on the source file because the labels render from `{label}` JSX expressions (not literal strings in source). The 6 literal-label rendered ACs in dist/client/index.html PASS (see rendered ACs below).

**Rendered HTML ACs (the canonical ones):**
- `npm run build` exits 0 — PASS
- `npx astro check` exits 0 errors on `src/pages/index.astro` itself — PASS (19 pre-existing errors elsewhere; out of scope)
- LAND-02 rendered scrub `! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html` — PASS
- FORM-02 6 optgroups `grep -o '<optgroup ' dist/client/index.html | wc -l` returns 6 — PASS (plan AC `grep -c` returns 1 due to single-line minification; canonical intent satisfied)
- FORM-02 ≥48 options `grep -oE '<option value="[^"]+"' dist/client/index.html | wc -l` returns 49 — PASS
- form team label `grep -F 'Your team' dist/client/index.html` — PASS
- LAND-01 SSR fallback `grep -F '<span id="tz-label">your local time</span>' dist/client/index.html` — PASS

**Manual viewport check (LAND-04):** Deferred to user / Phase 11 AC1 verification — executor has no browser.

## Self-Check: PASSED

---
*Phase: 06-landing-page-form-meta-analytics*
*Completed: 2026-05-13*
