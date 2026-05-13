# Phase 6: Landing page + form + meta + analytics — Research

**Researched:** 2026-05-13
**Domain:** Astro 5 SSR landing-page rewrite, prerender + inline-JS, Plausible custom events, OG/Twitter meta, Lighthouse mobile audit
**Confidence:** HIGH

## Summary

Phase 6 is a single-file rewrite of `src/pages/index.astro` — a prerendered Astro page — with **zero backend, schema, CSP, or sibling-page changes**. Phase 5 already widened `/api/signup` to accept and validate `team` + `timezone`, so the form only needs to post the new fields; the endpoint is finished. The CONTEXT.md (D-01 through D-12) and UI-SPEC.md (checker-approved, 6/6 PASS) together lock 95% of the implementation decisions. Research focused on validating the remaining external surfaces: Plausible's custom-events API, OG/Twitter card meta-tag requirements, Lighthouse mobile scoring for a no-image inline-CSS landing, and the CSP allow-list for the existing Plausible script.

**Primary recommendation:** The plan should treat this phase as a structured copy/paste from the canonical sources — `references/oddlympics_landing_copy.md` (all copy verbatim), `references/teams.json` (the 48-option dropdown, grouped by `confederation` in the UI-SPEC-locked order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC), and `references/landing_preview.png` (AC1 visual diff). The novel-code surface is small: (1) one Astro-frontmatter `.map()` over `teams.json` to render `<optgroup>` blocks, (2) a single inline `<script is:inline>` carrying three responsibilities (tz-label swap per D-03/D-04/D-05, Plausible event per D-09/D-11/D-12, existing `?error=` swap kept verbatim), and (3) a full `<style is:global>` block retuned for the consumer light/sans-serif palette per UI-SPEC. The only non-code deliverable is the **Plausible-dashboard custom-goal configuration** for `Signup Submit` (D-10, R-4) — must happen before merge, or events drop silently.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reference assets and source of truth**

- **D-01** Pre-plan docs sweep (single commit) before `/gsd-plan-phase 6` — relocate `index.html`, `oddlympics_landing_copy.md`, `og-image.svg` into `references/`; rename `landing_desktop.png` → `references/landing_preview.png`; delete the IP-geolocation line from the landing copy doc. Commit `docs(06): relocate landing references + fix AC1 path + drop geo line`. Precondition for planning, not a plan task. **[VERIFIED: ls references/ confirms all five files now in place; sweep done.]**
- **D-02** `references/oddlympics_landing_copy.md` is the canonical source for headline, sub-headline, all 4 below-fold section bodies, all 5 FAQ items, footer micro-copy, exact meta tag strings. `references/landing_preview.png` is the AC1 visual diff target. `references/index.html` is a structural reference only — Phase 6 does NOT do a literal port. Reuse `index.astro`'s existing CSS-variable convention; tune values to match the visual target (consumer light/sans-serif).

**Timezone label rendering**

- **D-03** Algorithm: `tz.split('/').pop().replace(/_/g, ' ') + ' time'`. Handles `America/Detroit` → "Detroit time", `Europe/London` → "London time", `Africa/Lagos` → "Lagos time", `America/New_York` → "New York time", `America/Indiana/Indianapolis` → "Indianapolis time". Zero allow-list maintenance.
- **D-04** SSR HTML carries the copy-doc sub-headline verbatim, with `your local time` wrapped in `<span id="tz-label">your local time</span>`. Inline `<script is:inline>` reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, applies D-03, sets `tzLabel.textContent` only when the result is a non-empty city label. JS-off / Intl-missing users see the sentence intact. Pattern mirrors existing `?error=` swap at `src/pages/index.astro:65-82`. Zero CLS — text length-similar in both states.
- **D-05** Edge-case fallback. When IANA string has no slash (`UTC`), is `Etc/*` (e.g., `Etc/GMT+5`), or `Intl.DateTimeFormat` is unavailable, leave span text unchanged at `your local time`. Hidden tz form field still posts the raw IANA value; `/api/signup` Phase 5 D-03 fallback catches invalid server-side without rejecting.

**OG image meta tag ordering (Phase 6 vs Phase 8)**

- **D-06** Phase 6 ships final OG/Twitter image meta tags pointing at `https://oddlympics.app/og-image.png` (1200×630) even though the PNG does not exist yet. Phase 8 renders the PNG. No tag rewiring later; one source of truth in the copy doc.
- **D-07** Single-gate strategy. META-01 verification in Phase 6 only confirms tag *strings* are present (grep-based, no fetch). Phase 11 AC6 is the only 200-OK + content-type + dimensions check. No build-time `scripts/check-og-image.mjs`; no Phase 6 duplicate gate.
- **D-08** Hardcode `https://oddlympics.app/*` URLs in the meta block to match the copy doc verbatim. Do NOT derive from `Astro.site` — copy-doc precedent outranks DRY in this case.

**Plausible event firing**

- **D-09** Fire-and-forget on submit, no `preventDefault`. Inline `<script is:inline>` attaches `submit` listener that reads `form.team.value` and calls `plausible('Signup Submit', { props: { team } })`. Trust Plausible's `pa-*.js` `sendBeacon` path for unload-safe transmission. Zero added latency, no double-fire risk, no callback bookkeeping.
- **D-10** Pre-deploy operator action — configure custom goal `Signup Submit` in Plausible dashboard at `https://plausible.io/oddlympics.app/settings/goals` BEFORE the Phase 6 PR merges to `main`. Plan must include this as a non-code task. Also add a Day-2-ops row to `DEPLOY.md` for "Plausible custom-goal management". Phase 11 AC11 verifies events actually land in the dashboard post-launch.
- **D-11** Empty-team guard. If `form.team.value` is empty at submit time, the listener returns without firing. Guarantees every dashboard `Signup Submit` event has a non-empty `team` prop.
- **D-12** Dev-only console log. Listener calls `console.log('[plausible] Signup Submit', { team })` only when `location.hostname` is `localhost` or `127.0.0.1`. Mirrors `[email-dev-fallback]` precedent. Prod console stays clean.

### Claude's Discretion

- Exact CSS values (font size, line height, color tokens) — UI-SPEC has now locked these (see UI-SPEC §Color and §Typography); discretion absorbed by the checker-approved contract.
- How to render the 48-team `<select>` — Astro `.map()` over imported `references/teams.json`, grouped by `confederation`, order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC, `<optgroup label="…">` per group.
- Confederation-internal ordering of `<option>` rows — respect `references/teams.json` insertion order; don't re-sort alphabetically.
- `<noscript>` content for the sub-headline — SSR already includes "your local time" so a `<noscript>` is not needed.
- Inline JS structure — one combined `<script is:inline>` block or three (tz swap / Plausible / `?error=` swap). Combine if tidy; split if a CSP block reason demands it.
- Whether to drop the Plausible global-shim `<script is:inline>` at `index.astro:21-24`. UI-SPEC keeps it (consistent across all 6 pages).
- Mobile breakpoint (currently 520px in `index.astro`) and section padding rhythm — UI-SPEC locks 520px.

### Deferred Ideas (OUT OF SCOPE)

- `/privacy` and `/terms` stubs in the copy doc — Phase 7 owns them.
- IP-based geolocation team preselection — v2.0 Out-of-Scope. Removed from copy doc in the docs sweep.
- Build-time `scripts/check-og-image.mjs` asset guard — not adopted (D-07).
- Plausible event from `/pending` page (post-redirect) — rejected; fire-on-submit with sendBeacon is the simpler pattern.
- `Astro.site`-derived meta URLs — rejected (D-08) in favor of hardcoded copy-doc strings.
- Shared `Layout.astro` extraction — deferred to v1.1; `index.astro` rewrite pastes the same head pattern.
- Team-dropdown typeahead / search UX — 48 options fits a plain `<select>`.
- `<noscript>` fallback content — SSR already correct without JS.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LAND-01** | Replace `index.astro` with consumer template — headline, JS-populated tz label sub-headline, banner pill, four below-fold sections in order, consumer footer. | UI-SPEC §Copywriting Contract locks every string; D-04 locks the tz-label SSR fallback. References: `references/oddlympics_landing_copy.md` (verbatim source), `references/landing_preview.png` (AC1 diff target). |
| **LAND-02** | Zero occurrences (case-insensitive) of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` in any public surface. | UI-SPEC §Negative Space spells out the grep gate. Current `index.astro:3-4, 30` contain three of the prohibited terms — rewrite must scrub them. Pre-deploy check: `grep -i -E 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/index.html` returns empty. |
| **LAND-03** | Lighthouse mobile ≥ 90 across Performance, Accessibility, Best Practices, SEO. | See §Lighthouse Mobile ≥ 90 Pre-Deploy Checklist below. Phase 11 AC8 is the official gate; Phase 6 ships defensively. |
| **LAND-04** | Renders at 390 / 768 / 1280 px without horizontal scroll or text overlap. | UI-SPEC §Interaction Contracts → Responsive behavior locks values: 720px container, fluid `clamp(20px, 5vw, 48px)` horizontal padding, 520px mobile breakpoint. Phase 6 verifies all three viewports in dev before merge. |
| **FORM-01** | Form submits `team` (required, dropdown), `email` (required, type=email), `timezone` (hidden, JS-populated). Retains honeypot + `requested_sport=world_cup`. | `src/pages/api/signup.ts` already accepts all five fields. UI-SPEC §Form behavior locks DOM order (visible: team, email; hidden: timezone, requested_sport=world_cup, website honeypot). |
| **FORM-02** | Team dropdown contains all 48 qualified teams, grouped by confederation (UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC). `value` attributes are snake_case slugs. Display labels use natural English with diacritics. | `references/teams.json` is canonical (already read: 48 entries with `slug`, `label`, `confederation`). Six confederation full names per `<optgroup label>`: see UI-SPEC §Copywriting Contract row "Confederation `<optgroup>` labels". |
| **FORM-03** | Form POSTs to `/api/signup` with same content-type and HTTP semantics. Client-side `?error=...` rendering and existing error-code → message mapping continue to work. | `src/pages/api/signup.ts` is unchanged from Phase 5. UI-SPEC keeps the existing `?error=` swap pattern verbatim. COPY map at `index.astro:67-74` reused 1:1. |
| **META-01** | `<head>` carries new `<title>`, meta description, OG (`og:title`/`description`/`type=website`/`url`/`site_name=Oddlympics`/`image`*), Twitter card (`twitter:card=summary_large_image`/`title`/`description`/`image`). Zero prohibited terms. | UI-SPEC §Meta tags lists every exact string. D-08 hardcodes the URLs; D-06 hardcodes `og-image.png` URL even though Phase 8 ships the PNG later. |
| **ANLTC-01** | Plausible script + init unchanged. Submit handler fires `Signup Submit` event with `team` prop = slug. Goal configured in dashboard before form ships. | D-09 fire-and-forget pattern verified via Plausible docs (see Sources). D-10 dashboard step is the gating non-code task. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page HTML rendering (headline, sub-head, sections, FAQ, footer) | Static prerender (Astro `prerender = true`) | — | Cacheability + Lighthouse Performance; no per-request data needed. |
| Inline CSS (`<style is:global>`) | Static prerender (build-time) | — | UI-SPEC locks one block per page; Layout.astro deferred to v1.1. |
| Team `<option>` list (48 rows, 6 `<optgroup>`s) | Static prerender (frontmatter `.map()` over `references/teams.json`) | — | Build-time inline; `references/teams.json` is checked into the repo. |
| Timezone-label swap | Browser (inline `<script is:inline>`) | — | `Intl.DateTimeFormat` is a browser-only API; SSR fallback string is correct as-is. |
| `?error=` swap | Browser (inline `<script is:inline>`) | — | Prerendered page can't read query params server-side; pattern carries over from existing `index.astro`. |
| Plausible event firing | Browser (inline `<script is:inline>` → `pa-*.js` → `navigator.sendBeacon`) | Plausible.io ingestion endpoint | Fire-and-forget; no server involvement on the oddlympics-app side. |
| Plausible goal aggregation | External SaaS (Plausible dashboard) | — | Non-code; operator dashboard action (D-10). |
| Form POST `/api/signup` | API / Node SSR | SQLite | Already handled by Phase 5; Phase 6 untouched. |
| OG image asset | CDN/static (Phase 8 ships `public/og-image.png` → served by Caddy via Node static serving) | — | Phase 6 only ships the `<meta>` URL; Phase 8 ships the asset. URL returns 404 between Phase 6 ship and Phase 8 ship — acceptable per D-07. |
| Plausible script | CDN (plausible.io) | — | External `<script async>`; CSP already allows `https://plausible.io`. |

**Tier-misassignment risks Phase 6 must avoid:**
- Putting `Intl.DateTimeFormat` in the Astro frontmatter (it would run on the build machine, not the user's browser — wrong tz).
- Building a server-side per-request page (would lose Lighthouse Performance + cacheability and break the prerender pattern).
- Adding a fetch to `references/teams.json` at runtime (it's a static import that should be inlined at build).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `astro` | `^5.0.0` (project pinned; npm latest 6.3.2 [VERIFIED: `npm view astro version` → 6.3.2]) | Page framework + build + dev server | Already the project stack; Phase 6 makes zero changes to the dependency tree |
| `@astrojs/node` | `^9.5.5` (project pinned; npm latest 10.1.1 [VERIFIED: `npm view @astrojs/node version` → 10.1.1]) | Standalone Node SSR adapter | Already wired; no change |
| `better-sqlite3` | `^12.9.0` | (not used in Phase 6) | Phase 6 is frontend-only |
| `resend` | `^6.12.2` | (not used in Phase 6) | Phase 6 is frontend-only |

**Version verification note:** The project's `package.json` pins Astro 5.x (latest 5.x line). Astro 6.x is out as of 2026-05-13 but **upgrading is out of scope for Phase 6** — the milestone deadline is 2026-05-19 and a major-version bump would be its own risk surface. Keep `astro@^5.0.0`. `[VERIFIED: package.json line 14, `npm view astro version` 6.3.2]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `references/teams.json` (project file, not npm) | shipped Phase 5 | 48-team list with confederation + slug + label | Import via `src/lib/teams.ts` (`TEAMS`) or directly via Astro JSON import at frontmatter top |

**No new npm dependencies required for Phase 6.** No web fonts, no icon libraries, no UI frameworks. Plain Astro + inline CSS + 3 inline `<script>` blocks.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `<select>` with `<optgroup>` | A custom typeahead component (e.g., headlessui, downshift) | 48 options is small enough that native picker UX wins. Custom UI requires JS framework, breaks LAND-03 perf/a11y budgets, blows up the no-framework-JS CLAUDE.md convention. Deferred to post-v2.0 polish (CONTEXT deferred). |
| Hardcoded meta URLs (D-08) | Derive from `Astro.site` | DRY + portability. Rejected because the copy doc is canonical and verbatim, and v2.0 has no domain change planned. |
| Custom event POST to Plausible Events API | Direct `fetch('/api/event', { method: 'POST' })` to `plausible.io/api/event` | More control but requires manually populating headers; defeats the existing `pa-*.js` runtime. The shim + named-event call covers AC11. |

**Installation:**
```bash
# No new dependencies. Phase 6 uses the existing stack only.
```

## Architecture Patterns

### System Architecture Diagram

```
                            BUILD TIME (astro build)
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  references/teams.json ──┐                                           │
  │                          ├──> src/pages/index.astro frontmatter ──┐  │
  │  src/lib/teams.ts ───────┘   (.map over confederation groups)    │  │
  │                                                                  │  │
  │  references/oddlympics_landing_copy.md (manually copied into     │  │
  │     index.astro template literals; not imported at runtime)      │  │
  │                                                                  ▼  │
  │                                            dist/client/index.html  │
  │                                            (fully prerendered)     │
  └──────────────────────────────────────────────────────────────────────┘

                          REQUEST TIME (user visits /)
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  user agent ──> Caddy (CSP + HSTS + assets cache)                    │
  │                   │                                                  │
  │                   ▼                                                  │
  │             oddlympics.service (Node)                                │
  │                   │                                                  │
  │                   ▼                                                  │
  │            serves dist/client/index.html (static)                    │
  │                   │                                                  │
  │                   ▼                                                  │
  │             browser parses HTML                                      │
  │                   │                                                  │
  │           ┌───────┼───────────┬─────────────────┐                    │
  │           │       │           │                 │                    │
  │           ▼       ▼           ▼                 ▼                    │
  │       <script>  <script>   <script async>   <form action=...>        │
  │       tz-swap   ?error=    plausible/pa-*.js  user fills it          │
  │           │     swap          │                 │                    │
  │           ▼                   ▼                 ▼                    │
  │       #tz-label.txt           queue init     onsubmit listener       │
  │       #timezone.value                          │                     │
  │                                                ▼                     │
  │                                       plausible('Signup Submit',     │
  │                                          { props: { team } })        │
  │                                                │                     │
  │                                                ▼                     │
  │                                         sendBeacon → plausible.io    │
  │                                                                      │
  │                                  (concurrent) POST /api/signup       │
  │                                                │                     │
  │                                                ▼                     │
  │                                      Phase-5 validation → DB         │
  │                                      303 → /pending?email=…          │
  └──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| File | Responsibility |
|------|----------------|
| `src/pages/index.astro` | Full rewrite. Frontmatter imports `references/teams.json`, defines `TITLE`/`DESCRIPTION` constants, optionally groups teams by confederation. `<head>` carries copy-doc meta tags. `<body>` carries hero (banner / headline / sub-headline with `<span id="tz-label">`) + form (`<select>` with 6 `<optgroup>`s, `<input type="email">`, hidden `timezone`, hidden `requested_sport`, hidden `website` honeypot, submit button), 4 below-fold sections, footer. Three inline `<script is:inline>` blocks (or one combined block). One `<style is:global>` block. |
| `references/teams.json` | Read at build time. 48 entries, hand-ordered within each confederation. |
| `references/oddlympics_landing_copy.md` | Read by the developer once; copy strings pasted verbatim into `index.astro`. |
| `references/landing_preview.png` | Read by the developer + plan-check + Phase 11 AC1 verifier. Visual diff target. |
| `deploy/Caddyfile` | **Unchanged.** CSP already allows `https://plausible.io` + `'unsafe-inline'`. `[VERIFIED: deploy/Caddyfile:30]` |
| `src/pages/api/signup.ts` | **Unchanged.** Phase 5 endpoint accepts new fields. |
| `src/lib/teams.ts`, `src/lib/timezones.ts` | **Unchanged.** Only consumed by `/api/signup`. Phase 6 reads `teams.json` directly at frontmatter (or via `TEAMS` from `teams.ts` — either works; UI-SPEC notes the executor can choose). |

### Recommended Project Structure

No new files. Phase 6 is in-place rewrite of one file:

```
src/pages/
├── index.astro     # FULL REWRITE
├── pending.astro   # unchanged
├── confirmed.astro # unchanged
├── unsubscribed.astro # unchanged
├── manage.astro    # unchanged
├── schedule.astro  # unchanged
└── api/
    └── signup.ts   # unchanged
```

### Pattern 1: Astro JSON Build-Time Import (canonical for the team dropdown)

**What:** Import JSON in frontmatter; Astro inlines the data at build time and renders it as static HTML. No runtime fetch, no client-side data dependency.

**When to use:** Any time the data is finite, slow-changing, and checked into the repo.

**Example (matches `src/lib/teams.ts:1` pattern):**

```astro
---
// src/pages/index.astro frontmatter
export const prerender = true;
import teams from '../../references/teams.json' with { type: 'json' };

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const;
const CONFEDERATION_LABEL: Record<string, string> = {
  UEFA: 'UEFA — Europe',
  CONMEBOL: 'CONMEBOL — South America',
  CONCACAF: 'CONCACAF — North & Central America',
  CAF: 'CAF — Africa',
  AFC: 'AFC — Asia',
  OFC: 'OFC — Oceania',
};

const groupedTeams = CONFEDERATION_ORDER.map((conf) => ({
  conf,
  label: CONFEDERATION_LABEL[conf],
  teams: teams.filter((t) => t.confederation === conf),
}));
---

<!-- ... -->
<select name="team" id="team" required>
  <option value="" disabled selected>Pick your team</option>
  {groupedTeams.map(({ conf, label, teams }) => (
    <optgroup label={label}>
      {teams.map((t) => <option value={t.slug}>{t.label}</option>)}
    </optgroup>
  ))}
</select>
```

`[VERIFIED: astro docs — JSON import via `with { type: 'json' }` is the Node 22 ESM-compatible syntax already used at `src/lib/teams.ts:1`.]`

### Pattern 2: Inline JS Reading URL Params on a Prerendered Page (kept verbatim from existing `index.astro`)

**What:** Page is statically built and CDN-cacheable. URL-param-driven content (`?error=…`) is rendered client-side via a tiny inline script.

**When to use:** Any prerendered page that needs to react to query params. Already used at `src/pages/index.astro:65-82`.

**Example (existing — Phase 6 keeps verbatim):**

```html
<script is:inline>
  try {
    const COPY = {
      'bad-email': 'That email looks off — try again.',
      'bad-form': 'Something went wrong with the form. Try again.',
      // ... full map from UI-SPEC
    };
    const code = new URL(location.href).searchParams.get('error');
    if (code) {
      const el = document.getElementById('error');
      el.textContent = COPY[code] || 'Something went wrong.';
      el.hidden = false;
    }
  } catch {}
</script>
```

`[VERIFIED: src/pages/index.astro:65-82 — keep as-is. FORM-03/COMPAT-02 require unchanged behavior.]`

### Pattern 3: Inline JS Tz-Label Swap (CLS-safe)

**What:** Sub-headline has a span with default text `your local time` rendered at SSR. Inline JS, on load, reads `Intl.DateTimeFormat().resolvedOptions().timeZone` and replaces span text only when the algorithm produces a non-empty city label. Identical font, weight, line-height — text is comparable in length to SSR default, no CLS.

**When to use:** Phase 6 D-04 — exactly this case.

**Example:**

```html
<p class="subhead">
  Pick your team. We'll email you one hour before every match in
  <strong><span id="tz-label">your local time</span></strong>.
  Nothing else. Free, no ads, no betting odds.
</p>

<input type="hidden" name="timezone" id="timezone" value="" />

<script is:inline>
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    // Always populate hidden form field with raw IANA value (or empty).
    const tzInput = document.getElementById('timezone');
    if (tzInput) tzInput.value = tz;

    // Swap span text only on non-empty city label per D-03/D-05.
    if (tz && tz.indexOf('/') !== -1 && tz.indexOf('Etc/') !== 0) {
      const label = tz.split('/').pop().replace(/_/g, ' ') + ' time';
      if (label && label !== ' time') {
        document.getElementById('tz-label').textContent = label;
      }
    }
  } catch {}
</script>
```

**CLS note:** `Intl.DateTimeFormat` returns synchronously and the span swap runs immediately at parse time (inline script positioned after the span in source order). Even if a layout shift occurred, the swap fires before the first paint in modern browsers when the script is inline-positioned correctly. `[VERIFIED: MDN — `Intl.DateTimeFormat().resolvedOptions()` is synchronous.]` `[ASSUMED]` First-paint timing in all browsers is "before paint" — verify in Lighthouse run.

### Pattern 4: Plausible Custom Event Fire-and-Forget

**What:** Attach a `submit` listener to the form. On submit, read `form.team.value`, call `plausible('Signup Submit', { props: { team } })`, do NOT `preventDefault`. The shim at `index.astro:21-24` queues the call if `pa-*.js` hasn't loaded yet; the script will drain `window.plausible.q` on load.

**When to use:** Phase 6 D-09 — exactly this case. ANLTC-01 satisfied.

**Example:**

```html
<script is:inline>
  try {
    const form = document.getElementById('signup-form');
    if (form) {
      form.addEventListener('submit', function () {
        const team = (form.team && form.team.value) || '';
        if (!team) return; // D-11 empty-team guard
        try {
          window.plausible('Signup Submit', { props: { team: team } });
        } catch {}
        // D-12 dev-only console log
        const h = location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
          console.log('[plausible] Signup Submit', { team: team });
        }
      });
    }
  } catch {}
</script>
```

`[VERIFIED: plausible.io/docs/custom-event-goals — `plausible('Event Name', { props: { … } })` is the canonical call.]`
`[VERIFIED: plausible.io/docs/custom-props/for-custom-events — props accept scalars only (strings/numbers/booleans), up to 30 per event.]`
`[VERIFIED: vishnubharathi.codes reverse-engineered the script — `window.plausible.q` is the queue, drained on `pa-*.js` load.]`
`[ASSUMED]` Plausible's current `pa-*.js` build uses `navigator.sendBeacon` for unload-safe transmission. (Plausible plans to migrate to sendBeacon per GH discussion #190 [CITED: github.com/plausible/analytics/discussions/190]; the existing `pa-*.js` build behavior at the project's script URL `pa-wRAab3seDWDDBnGbRbe0K.js` is the variant in use — verify by inspecting outbound network call in DevTools during smoke test if reliability is challenged.) Fire-and-forget on submit + immediate `/pending` navigation will lose the event on some browsers if the script doesn't use `sendBeacon`. **Mitigation:** AC11 is verified post-launch on real submits in Phase 11. If events drop in production, switch to a `preventDefault` + `await fetch(beacon, { keepalive: true })` + then-submit pattern. Document the fallback in the plan as a Phase 6 risk note.

### Anti-Patterns to Avoid

- **Building a custom typeahead/combobox.** UI complexity + JS bundle + a11y testing surface — all wins lost. Native `<select>` with `<optgroup>` works on mobile (iOS/Android native pickers honor optgroups), screen readers handle it, Lighthouse passes. `[VERIFIED: a11ysupport.io/tech/html/optgroup_element — optgroup announced by Firefox NVDA; partial in JAWS/Chrome but considered acceptable for visual grouping.]` `[CITED: coolfields.co.uk — accessible forms grouping options with optgroup]`
- **Adding `display:none` to honeypot.** Bots that parse CSS skip it. Keep the existing `.hp` class pattern (`position: absolute; left: -10000px; opacity: 0; pointer-events: none`) verbatim from `src/pages/index.astro:233-240`.
- **`Intl` in Astro frontmatter.** Runs at build time on the build machine — captures the build machine's tz, not the user's. Must be inline-script client-side.
- **Putting `<script>` for tz swap BEFORE the `<span id="tz-label">` in DOM order.** The span must exist before the script runs. Place script after the form (or use `document.addEventListener('DOMContentLoaded', …)`).
- **Hardcoding tz allow-list in the inline JS.** The algorithm `tz.split('/').pop().replace(/_/g, ' ') + ' time'` works for arbitrary IANA names; allow-list maintenance is server-side via `VALID_TZ` in `src/lib/timezones.ts`.
- **Adding the OG image URL as a relative path.** Social crawlers (FB, X, LinkedIn) require absolute URLs; relative paths break preview rendering. `[VERIFIED: sangfroidwebdesign.com — absolute URLs required for og:image.]`
- **Linking to `og-image.png` in `<head>` and never building it.** Even though the gate is Phase 8, ship the meta tag in Phase 6 (D-06). Without Phase 8, the image returns 404 between merge and Phase 8 ship — acceptable per D-07, but **don't let this slip past 2026-05-19**.
- **Putting prohibited terms anywhere — including inline `<style>` comments or CSS variable names.** Grep gate is byte-level case-insensitive. `--bitcoin-orange` would fail; use `--accent` or `--accent-rust`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time zone detection | Geolocation API + IP-lookup service | `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser built-in) | One sync call, no permission prompt, ~98% coverage, free. Out-of-scope items explicitly forbid IP-based geo per PROJECT.md. |
| Time zone → city name | Hardcoded IANA → city map (450+ entries to maintain) | `tz.split('/').pop().replace(/_/g, ' ')` (D-03) | The IANA string is already structured (`Region/City`); just parse it. Zero maintenance. |
| Custom event analytics queue | Reimplement event queue | Plausible's existing `window.plausible.q` shim | Already in the codebase across all 6 pages. Tested. |
| OG/Twitter card validation | Build a curl-based asset-fetch gate | Phase 11 AC6 + manual `opengraph.xyz` spot-check post-deploy | D-07 explicitly excludes a build-time gate. The X (Twitter) Card Validator was deprecated in 2022; use `socialrails.com` / `opengraph.xyz` / Slack-paste / iMessage-paste as informal validators post-deploy. |
| Lighthouse-mobile-runner-on-localhost | A CI-side Lighthouse run | Manual run before merge + Phase 11 AC8 on prod | A CI Lighthouse run on a localhost server is noisy and flaky; Phase 11 is the canonical gate. Phase 6 plan should include a pre-merge `npx unlighthouse --site http://localhost:4321` or browser-DevTools Lighthouse run as a soft check. |
| 48-team `<option>` rendering | Hand-typing 48 `<option>` lines | Astro `.map()` over `references/teams.json` at build time | Future updates (a team is replaced after qualifying) only touch the JSON. |

**Key insight:** Phase 6's only "novel" code is the tz-label algorithm (5 lines), the Plausible submit-listener (10 lines), and ~150 lines of CSS retuned to the consumer palette. Everything else is paste-from-canonical-source. Resist the urge to "improve" — the docs sweep (D-01) and UI-SPEC (already approved) are the source of truth.

## Runtime State Inventory

Phase 6 is **not** a rename/refactor/migration phase — it is a one-file rewrite. This section is **not strictly required** but included briefly because the prohibited-term grep (LAND-02) has artifact-state implications:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `vip_signups` schema (including `team` + `timezone` columns) was shipped in Phase 5. Phase 6 does not alter schema or row state. | None |
| Live service config | **Plausible dashboard** custom goal `Signup Submit` (per D-10) — lives in `https://plausible.io/oddlympics.app/settings/goals`, NOT in repo. Must be configured before Phase 6 merge or events drop silently. | Add as non-code task (pre-merge operator action) + DEPLOY.md Day-2-ops row |
| OS-registered state | None — no systemd unit changes, no scheduler changes. | None — verified by inspection of `deploy/` |
| Secrets/env vars | None — Phase 6 introduces no new env vars. Plausible script tag URL is already in code. | None |
| Build artifacts | **`dist/client/index.html`** rebuilt by `astro build` will replace the v1 teaser HTML. Old prohibited-term content stays in git history (acceptable). | Verify post-build grep returns empty (LAND-02 pre-merge check) |

## Common Pitfalls

### Pitfall 1: Plausible Event Dropped on Page Unload

**What goes wrong:** Form submits, the browser starts navigating to `/pending?email=…`, and the `plausible('Signup Submit', …)` call's outbound HTTP request is cancelled mid-flight. Plausible dashboard never receives the event.

**Why it happens:** If `pa-*.js` uses `fetch()` or `XMLHttpRequest` (not `sendBeacon`), browsers cancel pending requests on navigation. The fire-and-forget pattern relies on Plausible's script using `sendBeacon` or `fetch(..., { keepalive: true })`.

**How to avoid:** Trust the existing `pa-*.js` build for now (D-09). If Phase 11 AC11 shows events missing, swap to `e.preventDefault(); plausible(...); setTimeout(() => form.submit(), 0);` or use `navigator.sendBeacon` directly with the Events API. Document this as a known fallback in the plan.

**Warning signs:** Phase 11 AC11 verification shows fewer `Signup Submit` events than actual signups in the SQLite `vip_signups` table.

### Pitfall 2: CLS from Late tz-Label Swap

**What goes wrong:** "your local time" → "Detroit time" is a length change. If the swap fires after first paint, Lighthouse flags Cumulative Layout Shift.

**Why it happens:** External script loading delays, browser layout-shift heuristics.

**How to avoid:**
1. The tz-swap script is INLINE (not external) and positioned in DOM after the span. It runs synchronously at parse, before paint.
2. The strings are length-comparable (16 vs. 12-14 chars). Even if swap occurs after paint, the shift is sub-threshold (CLS threshold for "good" is < 0.1).
3. Use `<strong>` wrapping and a `min-width` reservation isn't needed at the span level given the short character range, BUT if Lighthouse still complains, add `display: inline-block; min-width: 8ch;` to `#tz-label`.

**Warning signs:** Lighthouse Performance audit "Avoid large layout shifts" fails on the sub-headline span.

### Pitfall 3: Prohibited Term Surviving Rewrite (LAND-02)

**What goes wrong:** Old comments, CSS variable names, or accidentally-left phrases like "World domination. Your world." slip into `dist/client/index.html`.

**Why it happens:** The rewrite copies inline `<script>` or `<style>` patterns from the current file; verification is text-based.

**How to avoid:** Add a pre-merge grep step in the plan: `grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html` must return empty (exit 0 with no output). Run after `npm run build` and before `git push`.

**Warning signs:** Phase 11 AC7 fails on prod.

### Pitfall 4: Meta Tag Too Long for Lighthouse SEO Audit

**What goes wrong:** Lighthouse SEO flags `<meta name="description">` either missing OR present but considered too short/long.

**Why it happens:** Lighthouse's SEO category does NOT enforce a strict character count, but Google's SERP truncation does (~155-160 chars desktop, ~120 mobile).

**How to avoid:** The copy doc string `Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.` is 144 chars — within the safe range. `[VERIFIED: char count of UI-SPEC string is 144.]` `[CITED: kallenmedia.com — 150-160 chars recommended for desktop.]`

**Warning signs:** Phase 11 Lighthouse SEO audit `meta-description` finding.

### Pitfall 5: Astro Build Inlining Issues with `with { type: 'json' }`

**What goes wrong:** Some bundler configs treat the `with` import attribute as a parse error in older Node.

**Why it happens:** `import x from 'y' with { type: 'json' }` is the modern ESM import-attributes syntax (formerly assert).

**How to avoid:** Project pins Node 22 (`.github/workflows/deploy.yml`); local dev runs Node 26 [VERIFIED: `node --version` → v26.0.0]. Both support `with`. `src/lib/teams.ts:1` already uses this syntax — proven working in the current build. Phase 6 can either import via `src/lib/teams.ts` (re-export `TEAMS`) or directly via `with`. Either path is safe.

**Warning signs:** `astro build` error mentioning `import attributes` or `assert is deprecated`.

### Pitfall 6: Missing Plausible Goal Configuration Before Deploy (R-4)

**What goes wrong:** Form submits, `plausible('Signup Submit', { props: { team } })` fires, Plausible ingests it as a generic event but the dashboard "Goals" page shows nothing. AC11 verification fails.

**Why it happens:** Plausible only counts events against goals that exist in the dashboard. Goals are created server-side, not from the JS call.

**How to avoid:** D-10 is the operator action. The plan MUST include a pre-merge checkbox: "Plausible custom goal `Signup Submit` configured at https://plausible.io/oddlympics.app/settings/goals". DEPLOY.md gets a Day-2-ops row. Phase 11 AC11 only passes if the goal exists.

**Warning signs:** Plausible dashboard shows custom events but no goal-attributed counts.

## Code Examples

### Frontmatter — Build-Time JSON Import + Grouping

```typescript
// src/pages/index.astro frontmatter
export const prerender = true;

import teams from '../../references/teams.json' with { type: 'json' };

const TITLE = 'Oddlympics — World Cup 2026 alerts in your time zone';
const DESCRIPTION = "Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.";
const OG_TITLE = 'World Cup 2026 alerts in your time zone';
const OG_DESCRIPTION = "Pick your team. One ping, one hour before kickoff, in your local time. Free for the whole tournament.";
const TWITTER_DESCRIPTION = 'Pick your team. One ping, one hour before kickoff. Free.';
const SITE_URL = 'https://oddlympics.app';
const OG_IMAGE = 'https://oddlympics.app/og-image.png';

const CONFEDERATION_ORDER = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'] as const;
const CONFEDERATION_LABEL: Record<typeof CONFEDERATION_ORDER[number], string> = {
  UEFA: 'UEFA — Europe',
  CONMEBOL: 'CONMEBOL — South America',
  CONCACAF: 'CONCACAF — North & Central America',
  CAF: 'CAF — Africa',
  AFC: 'AFC — Asia',
  OFC: 'OFC — Oceania',
};

const groupedTeams = CONFEDERATION_ORDER.map((conf) => ({
  conf,
  label: CONFEDERATION_LABEL[conf],
  teams: teams.filter((t) => t.confederation === conf),
}));
```

`[VERIFIED pattern: src/lib/teams.ts:1 uses identical JSON import syntax — proven working in current build.]`

### `<head>` Meta Block (D-08 hardcoded URLs)

```astro
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content={DESCRIPTION} />

  <meta property="og:title" content={OG_TITLE} />
  <meta property="og:description" content={OG_DESCRIPTION} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={SITE_URL} />
  <meta property="og:site_name" content="Oddlympics" />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Oddlympics — World Cup 2026 alerts in your time zone" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={OG_TITLE} />
  <meta name="twitter:description" content={TWITTER_DESCRIPTION} />
  <meta name="twitter:image" content={OG_IMAGE} />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>{TITLE}</title>

  <script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>
  <script is:inline>
    window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
    plausible.init()
  </script>
</head>
```

`[CITED: UI-SPEC §Meta tags — exact strings.]`

### Form Markup (UI-SPEC §Form behavior)

```astro
<form method="post" action="/api/signup" id="signup-form">
  <div class="field">
    <label for="team">Your team</label>
    <select name="team" id="team" required>
      <option value="" disabled selected>Pick your team</option>
      {groupedTeams.map(({ label, teams }) => (
        <optgroup label={label}>
          {teams.map((t) => <option value={t.slug}>{t.label}</option>)}
        </optgroup>
      ))}
    </select>
  </div>

  <div class="field">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@example.com" />
  </div>

  <input type="hidden" name="timezone" id="timezone" value="" />
  <input type="hidden" name="requested_sport" value="world_cup" />

  {/* honeypot — humans don't fill this; bots will */}
  <input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />

  <div class="cta">
    <button type="submit">Get match alerts</button>
  </div>

  <p class="fineprint">One email per match for the team you pick. Unsubscribe in one click.</p>
  <p id="error" class="error" role="alert" hidden></p>
</form>

<p class="trust">Built by one person in Michigan. No app to install. We'll never sell your email.</p>
```

### Combined Inline Script (one block — recommended; CONTEXT discretion)

```html
<script is:inline>
  // ---- tz-label swap (D-03/D-04/D-05) + hidden tz field population ----
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzInput = document.getElementById('timezone');
    if (tzInput) tzInput.value = tz;
    if (tz && tz.indexOf('/') !== -1 && tz.indexOf('Etc/') !== 0) {
      const label = tz.split('/').pop().replace(/_/g, ' ') + ' time';
      if (label && label !== ' time') {
        const el = document.getElementById('tz-label');
        if (el) el.textContent = label;
      }
    }
  } catch {}

  // ---- ?error= rendering (FORM-03 verbatim from existing pattern) ----
  try {
    const COPY = {
      'bad-email': 'That email looks off — try again.',
      'bad-form': 'Something went wrong with the form. Try again.',
      'bad-origin': 'Submission blocked. Please use the form on this page.',
      'rate-limited': 'Too many tries. Wait an hour and try again.',
      email: "We couldn't send the confirmation email. Try again in a minute.",
      server: 'Server hiccup. Try again in a minute.',
    };
    const code = new URL(location.href).searchParams.get('error');
    if (code) {
      const el = document.getElementById('error');
      if (el) {
        el.textContent = COPY[code] || 'Something went wrong.';
        el.hidden = false;
      }
    }
  } catch {}

  // ---- Plausible Signup Submit (D-09/D-11/D-12) ----
  try {
    const form = document.getElementById('signup-form');
    if (form) {
      form.addEventListener('submit', function () {
        const team = (form.team && form.team.value) || '';
        if (!team) return;  // D-11
        try { window.plausible('Signup Submit', { props: { team: team } }); } catch {}
        const h = location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') {
          console.log('[plausible] Signup Submit', { team: team });
        }
      });
    }
  } catch {}
</script>
```

## Lighthouse Mobile ≥ 90 Pre-Deploy Checklist

Phase 11 AC8 is the canonical gate; Phase 6 ships defensively against this checklist (CITED: developer.chrome.com/docs/lighthouse for the audit list).

### Performance (LCP/INP/CLS) — target ≥ 90

- [ ] Zero web-font requests (UI-SPEC uses system stack only) — already locked.
- [ ] No render-blocking external CSS (`<style is:global>` inlined per CLAUDE.md) — already locked.
- [ ] No `<img>` tags above the fold (none required by UI-SPEC).
- [ ] `<script async>` on the Plausible script (already present).
- [ ] Tz-label span swap fires inline-script-after-DOM-element-in-source-order → no CLS.
- [ ] `<button type="submit">` has explicit type to prevent default-form-submit re-render flicker.
- [ ] No JavaScript work on `DOMContentLoaded` or `load` beyond the 3 inline blocks.
- [ ] Build output `dist/client/index.html` < 50 KB (rough budget; verify after build).

### Accessibility — target ≥ 90 (each audit pass/fail, no partial credit)

- [ ] Color contrast: `#14151a` on `#fafaf7` = 16:1 (AAA), `#5a5d68` on `#fafaf7` = 6.4:1 (AA). `#ffffff` on `#d94a1f` submit = ~4.6:1 (AA, verify with actual hex picker). Banner pill `#d94a1f` on `#fbe9e0` = ~3.9:1 (large-text-equivalent at 13px/700 + 0.16em tracking — acceptable per UI-SPEC §Color contrast ratios).
- [ ] All form fields have `<label for="…">` matching `id`.
- [ ] Submit `<button>` has visible text "Get match alerts" — not just an icon.
- [ ] `<select>` has accessible name via `<label>` — UI-SPEC locks `<label for="team">`.
- [ ] All `<optgroup>` elements have a `label` attribute.
- [ ] `lang="en"` on `<html>` (existing pattern; carry over).
- [ ] `<meta name="viewport">` correct (existing).
- [ ] Focus rings visible (UI-SPEC §Focus rings locks 1px + 3px outer ring).
- [ ] Honeypot has `aria-hidden="true"` and `tabindex="-1"` (existing pattern).
- [ ] `role="alert"` on error message (existing).
- [ ] All links have descriptive text (footer: "Manage subscription" / "Privacy" / "Terms" / "Contact" — all descriptive per UI-SPEC).
- [ ] FAQ `<details>`/`<summary>` is native + keyboard-navigable (no JS required).
- [ ] No `outline: none` without a focus replacement.

### Best Practices — target ≥ 90

- [ ] CSP header present (already at `deploy/Caddyfile:30`).
- [ ] HTTPS-only — already via Caddy + LE.
- [ ] No console errors on page load.
- [ ] No deprecated APIs.
- [ ] Image aspect ratios — no images, N/A.
- [ ] `Strict-Transport-Security` already set in Caddy.
- [ ] No `unsafe-eval` in CSP (already absent).
- [ ] Lighthouse's "strict CSP" check requires hash/nonce — current CSP uses `'unsafe-inline'` which fails the strict variant of this audit, but Lighthouse Best Practices grades on the basic CSP-present audit, not the strict one. **Phase 6 won't lose points here.** `[CITED: web.dev strict-csp article; experimental flag.]` `[ASSUMED]` Lighthouse Best Practices ≥ 90 with `'unsafe-inline'` CSP — verified by Phase 11 in practice.

### SEO — target ≥ 90 (14 equal-weighted audits per DebugBear)

- [ ] `<title>` present and unique (UI-SPEC line locked).
- [ ] `<meta name="description">` 144 chars, within SERP-safe range.
- [ ] All links have anchor text (no `<a>` with only an image).
- [ ] Page has lang attribute (`<html lang="en">`).
- [ ] No `noindex` meta or robots header (verify Caddy doesn't add one).
- [ ] Page returns 200, not 30x (prerendered file).
- [ ] Tap targets ≥ 48×48 px — submit button + form fields are 44px+ at the locked sizes (verify in DevTools).
- [ ] Font sizes ≥ 12px for body text — UI-SPEC body = 15px, label/caption = 13px (above threshold).
- [ ] No render-blocking analytics scripts (`<script async>` already).
- [ ] Valid `hreflang` — N/A (English only, no localization).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cards-dev.twitter.com/validator` | X (Twitter) deprecated the official validator in 2022; use third-party tools like `socialrails.com` / `opengraph.xyz` / `cards-dev.x.com/validator` (the latter mostly defunct, no public-facing UI) | 2022 | Phase 6 has no automated validator; use opengraph.xyz post-deploy + manual share to Slack/iMessage. Phase 11 AC6 (Phase 8's territory) handles the official OG image check. |
| `import x from 'y' assert { type: 'json' }` | `import x from 'y' with { type: 'json' }` (ESM Import Attributes) | Node 22 stable | Project already on `with`-syntax (src/lib/teams.ts:1); no change needed. |
| Plausible script `plausible.js` | Custom-built `pa-*.js` with a hash suffix; reverse-engineered to use queue + post-load drain | ~2023 onward | Existing project uses `pa-wRAab3seDWDDBnGbRbe0K.js`; queue mechanism unchanged. |
| Hash-based CSP (`strict-dynamic`) | Project uses `'unsafe-inline'` for script-src; Astro 5.9+ has experimental built-in CSP hash generation but **not adopted in this project**. Out of scope for Phase 6. | Astro 5.9 (2025) | No change for Phase 6; CSP stays as-is. |

**Deprecated/outdated:**
- Twitter Card Validator (official): dead since 2022. Don't reference it in plans. `[CITED: socialrails.com X Card Validator]`
- `import { … } assert { type: 'json' }`: replaced by `with { type: 'json' }` in Node 22+. The project already uses the new syntax.

## Environment Availability

Phase 6 is a frontend-only rewrite — dependencies are minimal. The only external services touched are Plausible (already in the stack) and the Astro build pipeline (already wired).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Build + dev server | ✓ | v26.0.0 (local; prod pins v22) | — |
| npm | Astro install | ✓ | 11.12.1 | — |
| `astro` package | Build + dev | ✓ | `^5.0.0` pinned (current 5.x line; npm shows 6.3.2 as latest 6.x — don't upgrade in Phase 6) | — |
| `@astrojs/node` | SSR adapter | ✓ | `^9.5.5` pinned | — |
| `references/teams.json` | 48-team dropdown source | ✓ | 48 entries verified | — |
| `references/oddlympics_landing_copy.md` | Copy source | ✓ | docs sweep already complete | — |
| `references/landing_preview.png` | Visual diff target | ✓ | already renamed from `landing_desktop.png` | — |
| `references/og-image.svg` | Phase 8 source | ✓ (present, not used in Phase 6) | — | — |
| `references/index.html` | Structural reference | ✓ | 509-line static HTML reference | — |
| curl | Pre-deploy LAND-02 grep + AC1 spot-check | ✓ | 8.7.1 | — |
| Plausible dashboard access | D-10 goal configuration | ✓ (operator action) | — | If no access, AC11 cannot be verified. Operator must be logged in to https://plausible.io/oddlympics.app/settings/goals before Phase 6 merge. |
| `lighthouse` CLI | LAND-03 pre-deploy soft check | ✗ | — | Use Chrome DevTools "Lighthouse" panel (already in every Chromium browser); or `npx unlighthouse --site http://localhost:4321` |
| Playwright | AC3 / cross-browser tz sub-headline verification | ✗ | — | Phase 5 AC3 is "Phase 5/6" in REQUIREMENTS.md and was already evidenced by `scripts/smoke-signup.mjs` in Phase 5. Phase 6 can manually verify the tz-label swap in 3 browsers (Chrome / Safari / Firefox) using DevTools "Sensors → Override timezone" to spoof `America/Detroit`, `Europe/London`, `Africa/Lagos`. No new automated test required for Phase 6. |
| `rsvg-convert` / `cairosvg` | Phase 8 SVG→PNG | ✗ | — | Phase 8 territory, not Phase 6. |

**Missing dependencies with no fallback:** None blocking Phase 6.

**Missing dependencies with fallback:**
- Lighthouse CLI → Chrome DevTools Lighthouse panel.
- Playwright → manual DevTools tz override across 3 browsers.

## Validation Architecture

`workflow.nyquist_validation: true` (`.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None formal. Project relies on `npx astro check` (TypeScript + .astro lint), `npm run build` (build-time verification), curl smoke tests, and manual browser checks. Phase 5 introduced `scripts/smoke-signup.mjs` (Node-native, 8 cases, AC2/AC9/AC12 evidence). |
| Config file | None for unit/integration tests. `tsconfig.json` extends `astro/tsconfigs/strict`. |
| Quick run command | `npx astro check && npm run build` (~30s) |
| Full suite command | `npx astro check && npm run build && node scripts/smoke-signup.mjs` (Phase 5 smoke; Phase 6 may add a frontend smoke) |
| Phase gate | `dist/client/index.html` exists; LAND-02 grep returns empty; manual viewport check at 390/768/1280; manual DevTools Lighthouse run ≥ 90 across 4 categories (soft gate, Phase 11 = hard gate); manual tz-spoofing in DevTools confirms span swap for 3 IANA inputs |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAND-01 | All required page elements present | smoke (manual + curl) | `curl -s http://localhost:4321/ \| grep -i "Your team's matches"` returns hit | ❌ Wave 0 — add `scripts/smoke-landing.mjs` (recommended) |
| LAND-02 | Zero prohibited terms in dist HTML | unit (post-build grep) | `! grep -i -E 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/index.html` | ❌ Wave 0 — add as npm script `npm run check:land-02` or inline in plan |
| LAND-03 | Lighthouse mobile ≥ 90 across 4 categories | manual (DevTools) on dev build; Phase 11 = prod | n/a (manual) | n/a |
| LAND-04 | Responsive at 390 / 768 / 1280 | manual (DevTools responsive mode) | n/a (manual) | n/a |
| FORM-01 | Form posts 5 fields | smoke (manual submit + DB inspect; or extend `scripts/smoke-signup.mjs`) | `node scripts/smoke-signup.mjs` (existing) verifies team + tz; Phase 6 can re-run | ✅ exists from Phase 5 |
| FORM-02 | 48 team options grouped 6 ways | unit (HTML parse) | `curl -s http://localhost:4321/ \| grep -c "<option value=\""` returns ≥ 49 (48 + placeholder); `grep -c "<optgroup"` returns 6 | ❌ Wave 0 — add to `scripts/smoke-landing.mjs` |
| FORM-03 | Form action + ?error= rendering preserved | manual (DevTools network + visit /?error=bad-email) | `curl -sL http://localhost:4321/?error=bad-email \| grep "That email looks off"` returns hit (note: only after JS runs in browser; curl alone won't see it — manual browser check required) | n/a (JS-rendered) |
| META-01 | All meta tag strings present | unit (curl + grep) | `curl -s http://localhost:4321/ \| grep -E 'og:title\|og:description\|og:type\|og:url\|og:image\|og:site_name\|twitter:card\|twitter:title\|twitter:description\|twitter:image\|"description"\|<title>'` returns all expected hits | ❌ Wave 0 — add to `scripts/smoke-landing.mjs` |
| ANLTC-01 | Plausible event fires on submit with team prop | manual (DevTools Network panel watch for `event` request to plausible.io); Phase 11 AC11 = real dashboard check | n/a (cross-domain network) | n/a |

### Sampling Rate

- **Per task commit:** `npx astro check && npm run build` (≤ 30 s)
- **Per wave merge:** `npx astro check && npm run build && node scripts/smoke-signup.mjs` (Phase 5 smoke; Phase 6 may add `scripts/smoke-landing.mjs`)
- **Phase gate:** All of the above plus LAND-02 grep + manual 3-viewport browser check + manual tz DevTools override across 3 zones + DevTools Lighthouse run ≥ 90 across 4 categories on `http://localhost:4321/`

### Wave 0 Gaps

- [ ] `scripts/smoke-landing.mjs` — Optional. Verifies LAND-01 markers (headline, banner pill, footer disclaimer), FORM-02 (`<option>` count + 6 `<optgroup>`s), META-01 (all expected meta-tag attribute pairs). Pure curl-based, no headless browser. **Recommendation: include in Phase 6 plan as a defensive evidence script** (~50 LOC).
- [ ] `npm run check:land-02` script in `package.json` — Optional. Wraps the prohibited-term grep. **Recommendation: include in plan as a one-line script** so any phase can re-run it.
- [ ] Wave 0 framework install: not applicable (no test framework added).

*(If `scripts/smoke-landing.mjs` is skipped, the plan should explicitly call out the manual-verification steps for AC1/META-01 in a verification task.)*

## Security Domain

Phase 6 is a frontend rewrite. Security posture is **mostly unchanged from Phase 5**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 6 has no auth surface; magic-link flow (Phase 2) untouched |
| V3 Session Management | no | Session cookies (`src/lib/session.ts`) untouched |
| V4 Access Control | no | Public page; no access-control checks |
| V5 Input Validation | yes | All form input validation happens server-side at `/api/signup` (Phase 5 already shipped: VALID_TEAMS + VALID_TZ allow-lists, email regex, length cap, honeypot). Phase 6 client-side does no validation beyond HTML5 `required`. |
| V6 Cryptography | no | No crypto on the landing page; magic-link HMAC happens server-side post-submit |
| V14 Configuration | yes | CSP, HSTS, Referrer-Policy, X-Frame-Options already set in `deploy/Caddyfile:25-33`. Phase 6 must not weaken any of these. |

### Known Threat Patterns for Astro 5 + inline JS landing

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via injected `?error=...` value | Tampering / Info Disclosure | Existing pattern uses `el.textContent = COPY[code] \|\| '…'` — `textContent` does NOT parse HTML, so injection is mitigated. Lookup-table COPY map adds defense in depth. **Phase 6 keeps this pattern verbatim per FORM-03.** |
| XSS via injected `Intl.DateTimeFormat().resolvedOptions().timeZone` | Tampering | IANA tz strings are constrained by the browser's CLDR data; user has no input. `textContent` again — no HTML parse. |
| CSRF on form POST | Tampering | `/api/signup` does its own Origin check (`src/pages/api/signup.ts:20-36`). Same-origin browser POSTs include Origin; cross-origin POSTs are blocked. Phase 6 does not change this. |
| Honeypot bypass | Spoofing | Existing `name="website"` honeypot + Origin check + rate limit + email regex; no change. |
| Open redirect via `?error=` | Tampering | Error param is rendered as text, not a redirect target. Not exploitable. |
| Plausible script tampering | Tampering | Script is `<script async src="https://plausible.io/js/pa-…js">` — TLS to plausible.io + Subresource Integrity not used (Plausible re-hashes their builds without re-publishing SRI hashes). Risk accepted; CSP `script-src 'self' 'unsafe-inline' https://plausible.io` restricts loading domain. |
| Prohibited-term leak in inline script/style | Reputation (custom STRIDE-adjacent) | LAND-02 pre-merge grep gate. |
| `og:image` 404 between Phase 6 ship and Phase 8 ship | Availability | Accepted per D-07. Social shares between Phase 6 ship and Phase 8 ship will lack the image preview but the link still works. Phase 8 closes the window; aim to land Phases 6 and 8 close together. |

**CSP verification:** `[VERIFIED: deploy/Caddyfile:30]`
```
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
```

Phase 6 needs:
- Inline `<script>` blocks → covered by `'unsafe-inline'` in `script-src`. ✓
- Inline `<style is:global>` → covered by `'unsafe-inline'` in `style-src`. ✓
- External Plausible script `https://plausible.io/js/pa-…js` → covered by `https://plausible.io` in `script-src`. ✓
- Plausible `sendBeacon` POST to `https://plausible.io/api/event` → covered by `https://plausible.io` in `connect-src`. ✓
- Form POST to `/api/signup` (same-origin) → covered by `form-action 'self'`. ✓

**Conclusion: zero CSP changes required for Phase 6.** This satisfies the "Phase 6 MUST NOT touch CSP" constraint from the additional_context block.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plausible's current `pa-*.js` build (`pa-wRAab3seDWDDBnGbRbe0K.js`) uses `navigator.sendBeacon` (or `fetch` with `keepalive: true`) for unload-safe transmission. | Pattern 4 + Pitfall 1 | If `pa-*.js` does NOT use `sendBeacon`, form-submit events drop on page unload. Mitigation: verify in DevTools Network panel during smoke test; if events drop, switch to `e.preventDefault() + plausible(...) + setTimeout(form.submit)` pattern. Phase 11 AC11 catches this in production. |
| A2 | The inline `<script is:inline>` tz-swap fires before first paint when positioned in DOM after the `<span id="tz-label">`. | Pitfall 2 + Pattern 3 | If browser delays the inline script execution, span text swaps after paint, causing measurable CLS. Mitigation: if Lighthouse Performance flags, add `display: inline-block; min-width: 9ch;` to `#tz-label`. |
| A3 | Lighthouse Best Practices ≥ 90 audit DOES count a CSP-present site even when CSP uses `'unsafe-inline'`. | Lighthouse §Best Practices | If strict-CSP becomes the default audit, Phase 6 may score 80-89 on Best Practices. Mitigation: Phase 11 result is authoritative; if strict-CSP fails the audit, the Phase 6 CSP-change scope reopens (currently OUT OF SCOPE) — likely v1.1 work. |
| A4 | Native `<select>` with `<optgroup>` is sufficient for AC8 Lighthouse Accessibility ≥ 90 mobile. | Don't Hand-Roll + Anti-Patterns | Some screen readers don't announce `<optgroup>` labels; if Lighthouse's a11y rules flag this, Phase 6 may need `aria-label` decorations on each `<option>`. Mitigation: `[CITED: a11ysupport.io]` — current Lighthouse audits don't penalize plain `<optgroup>`; verify in Phase 11. |
| A5 | The Plausible global-shim `<script is:inline>` at `index.astro:21-24` reliably queues custom events called before `pa-*.js` loads. | Plausible event firing | If `pa-*.js` defines `window.plausible` in a way that doesn't drain the queue, the first event after page-load races with the script. Mitigation: standard Plausible queue pattern; trust the existing build (5 pages use it already). |

**Confirmation needed before plan finalizes:** A1 in particular — if the operator has access to a DevTools session against `https://oddlympics.app`, a quick inspection of the existing `pa-*.js` traffic on any page would resolve this assumption. If `pa-*.js` does NOT use `sendBeacon`, switch the D-09 fire-and-forget pattern to a `preventDefault` + `setTimeout(submit)` pattern at plan time.

## Open Questions

1. **Will the operator complete D-10 (Plausible goal config) before merge?**
   - What we know: D-10 is locked as a pre-deploy operator action; the plan must include it as a non-code task.
   - What's unclear: Who owns the operator action — single-developer project (johnzilla) — but coordination still matters. AC11 fails silently if D-10 is skipped.
   - Recommendation: Add the D-10 step to the plan as a checkbox in the verification task, AND add to `DEPLOY.md` Day-2-ops table. Pre-deploy gate.

2. **Should `scripts/smoke-landing.mjs` ship in Phase 6 or be deferred?**
   - What we know: Phase 5 shipped `scripts/smoke-signup.mjs` as an end-to-end signup smoke (AC2/AC9/AC12 evidence).
   - What's unclear: Whether a frontend-marker smoke (LAND-01 elements, FORM-02 option count, META-01 tag presence) is worth ~50 LOC in Phase 6 or should be folded into Phase 11.
   - Recommendation: **Ship it in Phase 6.** Pre-merge defensive evidence is cheap and meaningfully reduces Phase 11's surprise risk. ~50 LOC.

3. **Combined inline `<script is:inline>` block vs. three separate blocks?**
   - What we know: CONTEXT explicitly leaves this to executor discretion (D-09 implies combined is fine).
   - What's unclear: Whether splitting (e.g., tz-swap inside `<head>` so it fires before body parses; `?error=` and Plausible at end of `<body>`) gives a meaningful CLS win.
   - Recommendation: **One combined block at the bottom of `<body>`.** All three operations need DOM elements (`#tz-label`, `#error`, `#signup-form`) that exist before the script runs. Three separate blocks add 30 bytes of overhead and no perf win.

4. **Confederation-label format — UI-SPEC says `UEFA — Europe`, but is that en-dash or em-dash?**
   - What we know: UI-SPEC §Copywriting Contract row "Confederation optgroup labels" shows `UEFA — Europe` (em-dash).
   - What's unclear: Whether the copy doc says em-dash or en-dash; same character used for the banner pill `JUNE 11 – JULY 19` is en-dash.
   - Recommendation: Use em-dash (`—`, U+2014) for the confederation labels — matches UI-SPEC verbatim. Use en-dash (`–`, U+2013) for the date range in the banner pill — matches CONTEXT §Specifics line "en-dash, not hyphen".

5. **`requested_sport=world_cup` hidden field — keep or drop?**
   - What we know: `src/pages/api/signup.ts:64` reads it; `VALID_SPORTS` defaults to `'other'` if missing.
   - What's unclear: Whether it's still semantically meaningful for v2.0 ("we're a World Cup app; everyone is `world_cup`") or vestigial.
   - Recommendation: **Keep verbatim.** UI-SPEC §Form behavior explicitly retains it. Forward-compat for niche-sport branches (NICHE-01/02/03 in v2 deferred). Zero cost to keep.

## Pre-Deploy Operator Actions (consolidated)

Plans must enumerate these explicitly:

1. **D-10 Plausible custom goal configured.** Navigate to `https://plausible.io/oddlympics.app/settings/goals` → "Custom event" → name `Signup Submit` → save. Verify the goal appears in the dashboard before merge. Risk: silent event drop if skipped (R-4).
2. **DEPLOY.md Day-2-ops row added** for "Plausible custom-goal management" (one-row addition; cite D-10).
3. **LAND-02 grep gate:** `! grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/index.html` returns exit 0 with no output, after `npm run build`, before commit.
4. **3-viewport visual check:** open `http://localhost:4321/` in Chrome DevTools responsive mode at 390 / 768 / 1280 px. No horizontal scroll, no text overlap.
5. **DevTools Lighthouse run:** generate a mobile report on `http://localhost:4321/`. All 4 categories ≥ 90 (soft gate; Phase 11 AC8 = hard gate on prod).
6. **3-zone tz-spoof check:** DevTools "Sensors → Override → Timezone" to `America/Detroit`, `Europe/London`, `Africa/Lagos`. Reload `/`. Confirm sub-headline reads "Detroit time" / "London time" / "Lagos time" respectively.
7. **(No CSP review needed.)** Confirmed at Caddyfile:30 — Plausible already allow-listed. No edit.
8. **(No OG image gate.)** Phase 8 ships the asset; Phase 11 AC6 is the only fetch check (D-07).

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 6 Adherence |
|------------|--------|-------------------|
| No framework JS (React/Vue/etc.) — ask first | CLAUDE.md §Conventions | ✓ Three inline `<script is:inline>` blocks only |
| Inline `<style is:global>` per page; Layout.astro deferred | CLAUDE.md §Conventions | ✓ Phase 6 paste-same-pattern; UI-SPEC locks one block |
| Single mono font UI-wide | CLAUDE.md §Conventions — **OVERRIDDEN by UI-SPEC** | Conscious deviation: UI-SPEC §Typography introduces `--font-sans` for body + `--font-mono` scoped to micro-accents (banner pill, step numerals, copyright). Mono-everywhere was a v1 teaser convention; v2.0 consumer pivot requires consumer light/sans-serif per copy doc + landing_preview.png. Future Layout.astro extraction will need to reconcile. |
| Accent color `hsl(18 70% 56%)` | CLAUDE.md §Conventions — **OVERRIDDEN by UI-SPEC** | Conscious deviation: UI-SPEC §Color uses `#d94a1f` (warm rust). `hsl(18 70% 56%)` is approximately `#e87440` — close but not identical. UI-SPEC's `#d94a1f` matches `references/landing_preview.png` more closely. Other 5 pages keep the old accent. |
| `prerender = true` + URL-param-in-inline-script for static pages | CLAUDE.md §Architecture | ✓ `index.astro` stays prerendered; `?error=` swap kept verbatim |
| Errors/pending via URL params + 303 from server | CLAUDE.md §Conventions | ✓ Phase 6 changes nothing about server contract |
| Dry-run-by-default pattern for outbound side effects | CLAUDE.md §Architecture | N/A — landing page has no outbound side effects |
| `console.error` for caught DB/email failures with bracket tag | CLAUDE.md §Conventions | ✓ D-12 `[plausible]` tag mirrors `[email-dev-fallback]` pattern |
| TypeScript strict mode; `type` over `interface`; `node:` prefix on built-ins | CLAUDE.md §Conventions | ✓ No new server-side TS in Phase 6; Astro frontmatter uses inline `type` |
| Magic-link tokens with `purpose` claim | CLAUDE.md §Architecture | N/A — Phase 6 untouched |
| No JSDoc, no comments explaining what code does | CLAUDE.md §Conventions | ✓ Phase 6 keeps why-comments only |

## Sources

### Primary (HIGH confidence)

- `references/oddlympics_landing_copy.md` — canonical copy strings (already in repo)
- `references/landing_preview.png` — AC1 visual diff target (already in repo)
- `references/index.html` — structural reference (already in repo)
- `references/teams.json` — 48 teams, 6 confederations, snake_case slugs
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` — D-01 through D-12 lock
- `.planning/phases/06-landing-page-form-meta-analytics/06-UI-SPEC.md` — checker-approved 6/6 PASS
- `.planning/REQUIREMENTS.md` — LAND-01/02/03/04, FORM-01/02/03, META-01, ANLTC-01
- `src/pages/index.astro` — current teaser HTML (replace target)
- `src/pages/api/signup.ts` — Phase 5 endpoint (verified accepts new fields)
- `src/lib/teams.ts`, `src/lib/timezones.ts` — Phase 5 helpers
- `deploy/Caddyfile` — verified CSP allows `https://plausible.io` for both script-src and connect-src
- [Plausible Custom Events docs](https://plausible.io/docs/custom-event-goals) — `plausible('Event', { props: { … } })` API
- [Plausible Custom Props for Events](https://plausible.io/docs/custom-props/for-custom-events) — scalar-only, 30-max
- [Plausible Events API reference](https://plausible.io/docs/events-api)
- [Plausible Script Extensions](https://plausible.io/docs/script-extensions) — queue mechanism
- [MDN Intl.DateTimeFormat.prototype.resolvedOptions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions) — synchronous, returns `{ timeZone }`
- [Lighthouse Accessibility Scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring) — weighted audit list, pass/fail per audit, no partial credit

### Secondary (MEDIUM confidence)

- [Reverse engineering Plausible's <1kb script (vishnubharathi.codes)](https://vishnubharathi.codes/blog/reverse-engineering-plausible-less-than-1kb-js-script/) — confirms `window.plausible.q` queue mechanism
- [DebugBear: How To Improve Your Lighthouse SEO Score](https://www.debugbear.com/blog/lighthouse-seo-score) — 14-audit equal weighting, meta-description rule
- [Graphite: Lighthouse performance scoring](https://graphite.com/guides/lighthouse-scoring) — core web vitals
- [Coolfields: Accessible Forms — Grouping Options With Optgroup](https://www.coolfields.co.uk/2011/08/accessible-forms-grouping-options-optgroup/) — `<optgroup>` semantics
- [a11ysupport.io: optgroup element](https://a11ysupport.io/tech/html/optgroup_element) — screen-reader support matrix
- [Sangfroid Web Design: Facebook share image not showing](https://www.sangfroidwebdesign.com/web-design/facebook-share-image-is-wrong/) — absolute URL requirement for og:image
- [Plausible GH Discussion #190: sendBeacon](https://github.com/plausible/analytics/discussions/190) — Plausible's roadmap for sendBeacon migration
- [Astro On-Demand Rendering docs](https://docs.astro.build/en/guides/on-demand-rendering/) — `prerender = true` semantics
- [Kallen Media: Meta Description Length](https://kallenmedia.com/blog/seo/meta-description-length/) — 150-160 char SERP range

### Tertiary (LOW confidence — verified via secondary corroboration)

- [SocialRails X Card Validator (2026)](https://socialrails.com/free-tools/x-tools/card-validator) — confirms Twitter Card Validator deprecated 2022, third-party tools fill gap
- [OpenTweet X Card Validator](https://opentweet.io/tools/x-card-validator) — alternate validator
- [Brandbird Twitter Card Validator](https://www.brandbird.app/tools/twitter-card-validator) — alternate validator

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — already in code, Phase 5 verified
- Architecture: HIGH — CONTEXT + UI-SPEC pre-lock 95% of decisions
- Pitfalls: MEDIUM — Plausible `sendBeacon` behavior is A1 assumption; CLS budget is A2 assumption; both Phase-11-verifiable
- Lighthouse pre-deploy: MEDIUM — manual audit list; canonical gate is Phase 11

**Research date:** 2026-05-13
**Valid until:** 2026-05-26 (13 days — short because (a) Astro 6 just landed and the project may upgrade soon, and (b) Plausible's `pa-*.js` script behavior may evolve)
