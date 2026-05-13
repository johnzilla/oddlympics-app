# Phase 6: Landing page + form + meta + analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 06-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 6 — Landing page + form + meta + analytics
**Areas discussed:** Reference assets, Timezone label rendering, OG image meta-tag ordering (Phase 6 vs 8), Plausible event firing strategy

---

## Reference assets — author or commit?

### Q1: Where should Phase 6 source its copy from?

User redirected — "recheck repo root for index.html, oddlympics_landing_copy.md, landing_desktop.png and og_image.svg for reference". Verified all four files exist at repo root (only `references/teams.json` is in the proper `references/` subdir today).

### Q2: How should Phase 6 handle the misplaced reference files?

| Option | Description | Selected |
|--------|-------------|----------|
| Move all 4 to `references/` as docs sweep | One-commit `docs: relocate landing references to references/` before `/gsd-plan-phase 6`. Matches MILESTONE doc convention + Phase 5 precedent. | ✓ |
| Leave at repo root | Don't move; planner cites repo-root paths. Less churn but breaks convention. | |
| Move 3, delete `index.html` | Treat HTML template as misleading; keep the others. | |

### Q3: How tightly should Phase 6 follow `references/index.html`?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: port HTML 1:1 to index.astro | Match section order, class names, DOM shape exactly. | |
| Copy-driven, idiomatic Astro structure | Copy doc + preview image are source of truth; HTML is structural reference only. Reuse existing CSS-variable / `<style is:global>` patterns. | ✓ |
| HTML as fallback only | Astro-idiomatic first; fall back if AC1 diff drifts. | |

### Q4: Two inconsistencies to resolve in the docs sweep

| Option | Description | Selected |
|--------|-------------|----------|
| Rename file + delete geo line from copy doc | Rename `landing_desktop.png` → `references/landing_preview.png` so AC1 matches; delete IP-geolocation sentence to align with v2.0 Out-of-Scope. | ✓ |
| Update AC1 wording + keep geo line | Edit MILESTONE doc instead of renaming; preserve geo idea as a v1.1 note. | |
| Resolve at plan time | Punt both to `/gsd-plan-phase 6`. | |

**Notes:** User wanted to verify the references existed before committing; once verified, all subsequent choices were the recommended path.

---

## Timezone label rendering

### Q1: Which algorithm converts the IANA tz string to a display label?

| Option | Description | Selected |
|--------|-------------|----------|
| Naive split-on-`/` + `_`→space | `tz.split('/').pop().replace(/_/g, ' ') + ' time'`. Handles all AC3 locales. Zero allow-list maintenance. | ✓ |
| Curated city map + naive fallback | Hand-maintained TZ_LABEL map for top ~50 zones. | |
| Intl-derived long name | `timeZoneName: 'long'` → "Eastern Daylight Time". Unpredictable; conflicts with AC3 wording. | |

### Q2: SSR/fallback timing

| Option | Description | Selected |
|--------|-------------|----------|
| SSR `your local time`, JS swaps node text | Sentence renders intact; inline script sets `tzLabel.textContent` if Intl returns a valid city. Zero CLS. | ✓ |
| SSR empty span, JS injects label | Risks brief text flash on slow connections. | |
| Two SSR variants + noscript flip | Most robust to JS-off, but most code surface. | |

### Q3: Swap scope inside the sub-headline

| Option | Description | Selected |
|--------|-------------|----------|
| Swap only the `your local time` span | Wrap with `<span id="tz-label">`; JS sets textContent. Rest of sentence and bold styling untouched. | ✓ |
| Rewrite whole subhead when city detected | Two SSR variants; doubles copy surface. | |
| Detected city as parenthetical suffix | "your local time (detected: Detroit)". Reads weirdly. | |

### Q4: Edge-case behavior (no slash / POSIX / Intl missing)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `your local time` text — do nothing | JS bails on no-slash / `Etc/*` / Intl-missing. Hidden tz form field still posts raw value; server fallback catches it. | ✓ |
| Show raw tz | `UTC` → "UTC time"; `Etc/GMT+5` → "GMT+5 time". Awkward strings possible. | |
| Special-case UTC only | "UTC time" is fine; everything else stays fallback. | |

---

## OG image meta-tag ordering (Phase 6 vs 8)

### Q1: Which order ships?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 final URLs; Phase 8 renders PNG before launch | Single source of meta strings; no tag rewiring later. URL 404s until Phase 8 ships; Phase 11 AC6 catches it. | ✓ |
| Reorder: Phase 8 first | Run Phase 8 immediately after docs sweep, then Phase 6. Adds inter-phase dep. | |
| Phase 6 omits image tags | Phase 8 adds them later. META-01 verification splits across phases. | |
| Phase 6 placeholder image | Point at `/favicon.svg`; Phase 8 swaps. | |

### Q2: Gate strategy against accidental 404 launch

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 11 AC6 only — don't gate in Phase 6 | Single launch-gate check. Risk: mid-milestone share would 404. | ✓ |
| Explicit Phase-8-blocks-launch operator-checklist note | Belt-and-suspenders on top of AC6. | |
| Phase 6 commits a build-time check script | `scripts/check-og-image.mjs` fails deploy if PNG absent. | |

### Q3: Meta URL strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode `https://oddlympics.app/*` strings | Matches copy doc verbatim; simplest. | ✓ |
| Derive from `Astro.site` | DRY; one source of truth at `astro.config.mjs`. | |
| Hybrid (hardcode image, derive site) | Pragmatic but inconsistent. | |

---

## Plausible event firing strategy

### Q1: When does the event fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Fire on submit, no preventDefault — trust sendBeacon | Industry-standard for form tracking; zero latency; no double-fire risk. | ✓ |
| preventDefault + callback + manual submit | Guaranteed delivery; ~100–200ms latency; needs double-fire guard. | |
| Fire from `/pending` after redirect | Most reliable lifecycle; couples /pending to analytics; misses spam attempts. | |

### Q2: Plausible custom-goal pre-deploy action (R-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-deploy operator step in plan + DEPLOY.md | Plan calls out the dashboard config; DEPLOY.md gains a Day-2-ops row. Phase 11 AC11 verifies post-launch. | ✓ |
| Runtime guard | No public Plausible API to check goal existence; not viable. | |
| Defer to Phase 11 | Goal silently drops events until launch. | |

### Q3: Dev-only console log

| Option | Description | Selected |
|--------|-------------|----------|
| Silent in prod, `console.log` on localhost only | Mirrors `[email-dev-fallback]` precedent. Prod clean. | ✓ |
| Always silent | Cleanest prod, no dev signal. | |
| Always log | Aligned with Plausible's own dev logging; visible everywhere. | |

### Q4: Empty-team guard

| Option | Description | Selected |
|--------|-------------|----------|
| Don't fire event if team empty | `if (!team) return;` Every dashboard event has non-empty team prop. AC11 unambiguous. | ✓ |
| Fire with `team='unknown'` | Funnel doesn't break; junk visible in dashboard. | |
| Fire with no `team` prop | Plausible-idiomatic; less aligned with AC11 strict reading. | |

---

## Claude's Discretion

The user delegated these to the planner / executor:
- Exact CSS values (colors, font sizes, line heights, font stack) for the consumer aesthetic implied by `references/landing_preview.png`. CSS variable token names stay; values are free.
- How to render the 48-team `<select>` (Astro `.map()` over `references/teams.json`, grouped by `confederation` field, using `<optgroup>`).
- Whether to combine all inline JS into one `<script is:inline>` or split into three (tz / Plausible / `?error=`).
- Whether to retain the existing Plausible global-shim block at `index.astro:21-24` or drop it if the `pa-*.js` build already handles its own queue.
- Mobile breakpoint and section padding rhythm.
- Exact `<noscript>` content (likely none required — SSR sub-headline already reads correctly without JS).

## Deferred Ideas

- `/privacy` and `/terms` stub copy in `references/oddlympics_landing_copy.md` — Phase 7.
- IP-based geolocation preselection of team dropdown — v2.0 Out-of-Scope; removed from copy doc.
- Build-time `scripts/check-og-image.mjs` asset guard — Phase 11 AC6 is the only gate.
- Plausible firing from `/pending` after redirect — rejected in favor of fire-on-submit.
- `Astro.site`-derived meta URLs — rejected in favor of hardcoded copy-doc strings.
- Shared `Layout.astro` extraction — v1.1, per CLAUDE.md.
- Team dropdown typeahead / search UX — post-v2.0.
- `<noscript>` fallback block — unnecessary because SSR sub-headline already reads correctly without JS.
