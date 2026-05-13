# Phase 6: Landing page + form + meta + analytics - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v1 indie/builder landing (`src/pages/index.astro`) with a consumer-targeted World Cup 2026 page. Public-surface rewrite only: backend (`/api/signup`), schema (`vip_signups.team` + `vip_signups.timezone`), and the `references/teams.json` allow-list were shipped in Phase 5 and are not touched here.

In scope:
- Full `index.astro` rewrite — headline, JS-populated tz-label sub-headline, banner pill, 4 below-fold sections (How it works / Why this exists / After the World Cup / Common questions × 5 FAQ items), consumer footer.
- 48-team confederation-grouped `<select>` (snake_case slugs, UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC) rendered from `references/teams.json`.
- Hidden `timezone` form field populated client-side from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Retained honeypot (`name="website"`), retained `requested_sport=world_cup`, retained `?error=...` client-side rendering pattern.
- New `<title>` + meta description + Open Graph + Twitter card tags exactly per META-01 / copy doc.
- Plausible `Signup Submit` custom event fired on form submit with `team` prop = selected slug; Plausible script + init call left untouched.
- Lighthouse mobile ≥ 90 across Performance / Accessibility / Best Practices / SEO.
- Responsive layout at 390 / 768 / 1280 px without horizontal scroll or text overlap.
- Zero occurrences of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` anywhere in served HTML or inline assets (LAND-02).

Out of scope (other phases own):
- `/privacy` and `/terms` routes — Phase 7.
- `/og-image.png` asset rendering from `og-image.svg` — Phase 8 (Phase 6 ships the meta tags pointing at the future URL).
- `/manage` editor redesign + backfilled-row banner — Phase 9.
- Confirmation email body update — Phase 10.
- End-to-end + Lighthouse + tag — Phase 11 (AC1/AC3/AC7/AC8/AC11 verifications run there).

</domain>

<decisions>
## Implementation Decisions

### Reference assets and source of truth

- **D-01:** Pre-plan docs sweep (single commit) before `/gsd-plan-phase 6`:
  1. Move `index.html` → `references/index.html`.
  2. Move `oddlympics_landing_copy.md` → `references/oddlympics_landing_copy.md`.
  3. Move `og-image.svg` → `references/og-image.svg`.
  4. Rename + move `landing_desktop.png` → `references/landing_preview.png` (matches AC1 wording in `MILESTONE-consumer-landing.md`).
  5. Delete the line "IP-based geolocation can preselect the user's country if it's a qualified team" from the "Above the fold → Form" section of `oddlympics_landing_copy.md` — conflicts with PROJECT.md and REQUIREMENTS.md Out-of-Scope ("No IP-based country preselection for the team dropdown in v2.0").
  - Commit message: `docs(06): relocate landing references + fix AC1 path + drop geo line`.
  - This sweep is a precondition for planning, not a Phase 6 plan task.

- **D-02:** `references/oddlympics_landing_copy.md` is the canonical source for headline, sub-headline, all 4 below-fold section bodies, all 5 FAQ items, footer micro-copy, and exact meta tag strings. `references/landing_preview.png` is the AC1 visual diff target. `references/index.html` is a structural reference only — Phase 6 does NOT do a literal port. Reuse `src/pages/index.astro`'s existing CSS-variable convention (`--bg`, `--fg`, `--fg-dim`, `--line`, `--surface`, `--accent`, `--accent-ink`, `--mono`) and `<style is:global>` pattern; tune values to match the visual target (the copy doc says "Light, sans-serif, consumer-friendly", so palette + font swap is in scope).

### Timezone label rendering

- **D-03:** Algorithm: `tz.split('/').pop().replace(/_/g, ' ') + ' time'`. Handles all AC3 locales (`America/Detroit` → "Detroit time", `Europe/London` → "London time", `Africa/Lagos` → "Lagos time") plus `America/New_York` → "New York time", `America/Indiana/Indianapolis` → "Indianapolis time". Zero allow-list maintenance.

- **D-04:** SSR HTML contains the copy-doc sub-headline verbatim, with `your local time` wrapped in `<span id="tz-label">your local time</span>`. Inline `<script is:inline>` reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, applies D-03, and sets `tzLabel.textContent` only when the result is a non-empty city label. JS-off / Intl-missing users see the sentence intact. Pattern mirrors the existing `?error=` swap at `src/pages/index.astro:65-82`. Zero CLS — text length-similar in both states.

- **D-05:** Edge-case fallback. When the IANA string has no slash (`UTC`), is `Etc/*` (e.g., `Etc/GMT+5`), or `Intl.DateTimeFormat` is unavailable, leave the span text unchanged at "your local time". Hidden tz form field still posts the raw IANA value; `/api/signup` Phase 5 D-03 fallback (`FALLBACK_TZ = 'America/New_York'`) catches invalid server-side without rejecting (per SIGNUP-02).

### OG image meta tag ordering (Phase 6 vs Phase 8)

- **D-06:** Phase 6 ships the final OG/Twitter image meta tags pointing at `https://oddlympics.app/og-image.png` (1200×630) even though the PNG does not exist yet. Phase 8 renders the PNG from `references/og-image.svg` and commits it to `public/og-image.png`. No tag rewiring later; one source of truth for the meta block lives in `references/oddlympics_landing_copy.md`.

- **D-07:** Single-gate strategy. META-01 verification in Phase 6 only confirms that the tag *strings* are present in served HTML (grep-based, no fetch). Phase 11 AC6 is the only 200-OK + content-type + dimensions check. No build-time `scripts/check-og-image.mjs`; no Phase 6 duplicate gate.

- **D-08:** Hardcode `https://oddlympics.app/*` URLs throughout the meta block to match the copy doc verbatim. Do NOT derive from `Astro.site` — the canonical-copy precedent (copy doc) outranks DRY in this case.

### Plausible event firing

- **D-09:** Fire-and-forget on submit, no `preventDefault`. Inline `<script is:inline>` attaches a `submit` listener that reads `form.team.value` and calls `plausible('Signup Submit', { props: { team } })`. Trust Plausible's `pa-*.js` `sendBeacon` path for unload-safe transmission. Zero added latency, no double-fire risk, no callback bookkeeping.

- **D-10:** Pre-deploy operator action — configure the custom goal `Signup Submit` in the Plausible dashboard at `https://plausible.io/oddlympics.app/settings/goals` BEFORE the Phase 6 PR merges to `main`. The plan must include this as a non-code task. Also add a Day-2-ops row to `DEPLOY.md` for "Plausible custom-goal management". Phase 11 AC11 verifies events actually land in the dashboard post-launch.

- **D-11:** Empty-team guard. If `form.team.value` is empty at submit time (shouldn't happen — HTML5 `required` blocks the POST), the listener returns without firing. Guarantees every dashboard `Signup Submit` event has a non-empty `team` prop — cleaner data, unambiguous AC11.

- **D-12:** Dev-only console log. The listener calls `console.log('[plausible] Signup Submit', { team })` only when `location.hostname` is `localhost` or `127.0.0.1`. Mirrors the `[email-dev-fallback]` precedent in `src/lib/email.ts`. Prod console stays clean.

### Claude's Discretion

The planner and executor decide all of the following (no user-visible impact):
- Exact CSS values (font size, line height, color tokens) to hit the consumer aesthetic implied by the copy doc + `references/landing_preview.png`. Reuse the variable token names (`--bg`, `--fg`, ...) but tune values.
- How to render the 48-team `<select>` — almost certainly Astro `.map()` over the imported `references/teams.json`, grouped by `confederation` field, in the order UEFA → CONMEBOL → CONCACAF → CAF → AFC → OFC, with a `<optgroup label="UEFA">` per group.
- Confederation-internal ordering of `<option>` rows (currently `references/teams.json` is hand-ordered; respect insertion order — don't re-sort alphabetically).
- Exact `<noscript>` content (if any) for the sub-headline. SSR already includes "your local time" so a `<noscript>` may not be needed.
- Inline JS structure — one combined `<script is:inline>` block or three (tz swap / Plausible / `?error=` swap). Combine if it keeps the page tidy; split if a CSP block reason demands it.
- Whether to drop the `<script is:inline>` for the Plausible global-shim once it's confirmed `pa-*.js` initializes its own queue. Existing line at `index.astro:21-24` may be redundant; either keep (current pattern across all pages) or drop (Plausible custom build handles it).
- Mobile breakpoint (currently `520px` in `index.astro`) and section padding rhythm.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 copy + visual source of truth (post-docs-sweep paths)
- `references/oddlympics_landing_copy.md` — headline, sub-headline (with `your local time` fallback), banner pill, all 4 below-fold section bodies, all 5 FAQ items, footer micro-copy, exact meta tag strings (title, description, og:*, twitter:*). Single source of truth for Phase 6 + Phase 7 copy. **Note:** also contains `/privacy` and `/terms` stubs — those are Phase 7 territory, not Phase 6.
- `references/landing_preview.png` — AC1 visual diff target (currently `landing_desktop.png` at repo root, 2560×4088; renamed in the docs sweep).
- `references/index.html` — structural reference (full 509-line static HTML template). NOT a strict port target — informs section structure only.
- `references/og-image.svg` — Phase 8 source; Phase 6 doesn't touch it.
- `references/teams.json` — 48 teams, confederation-grouped, snake_case slugs. Imported by `index.astro` to render the `<select>`. Shipped in Phase 5.

### Requirements & scope
- `.planning/REQUIREMENTS.md` §"Landing page" — LAND-01, LAND-02, LAND-03, LAND-04.
- `.planning/REQUIREMENTS.md` §"Signup form" — FORM-01, FORM-02, FORM-03.
- `.planning/REQUIREMENTS.md` §"Meta tags" — META-01 (exact strings).
- `.planning/REQUIREMENTS.md` §"Analytics" — ANLTC-01.
- `.planning/REQUIREMENTS.md` §"Acceptance criteria" — AC1, AC3 (Phase 5/6), AC7 (Phase 11), AC8 (Phase 11), AC11 (Phase 5/11).
- `.planning/ROADMAP.md` §"Phase 6: Landing page + form + meta + analytics" — goal, depends-on (Phase 5), 5 Success Criteria, R-4 risk note (Plausible goal pre-deploy).
- `MILESTONE-consumer-landing.md` §"R1 — Landing page replacement" through §"R8 — Analytics" — full requirement text + AC1–AC11 wording.

### Project context
- `.planning/PROJECT.md` §"Current Milestone" — v2.0 scope; LAND-02 prohibited-terms guardrail; the consumer-pivot Key Decision (2026-05-12).
- `.planning/PROJECT.md` §"Out of Scope" — no IP-based country preselection; no multi-team at signup; no CAPTCHA; no localization.
- `CLAUDE.md` §"Architecture worth understanding before editing" — `prerender = true` pattern, static page → URL params via inline scripts, "Astro CSS lives inline per page" (Layout extraction deferred to v1.1).

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript — strict mode, `node:` prefix, return-type annotations.
- `.planning/codebase/CONVENTIONS.md` §"Astro patterns" — `export const prerender = true` for static pages, inline script for URL params, form `<form method="post" action="/api/signup">`.
- `.planning/codebase/CONVENTIONS.md` §CSS — inline `<style is:global>` per page, CSS variables in `:root`, single mono font (override in Phase 6 if visual target needs sans-serif).
- `src/pages/index.astro:1-25` — current frontmatter + head pattern (replace).
- `src/pages/index.astro:65-82` — `?error=` query-param read-and-swap inline script (keep this pattern; reuse for tz-label swap).
- `src/pages/index.astro:21-24` — Plausible global-shim init block (keep across all pages; Phase 6 attaches the `Signup Submit` listener on top).
- `src/pages/api/signup.ts:6-7` — `VALID_TEAMS` + `VALID_TZ` imports already shipped; Phase 6 just feeds them via the form.
- `src/lib/teams.ts` — `VALID_TEAMS` Set built from `references/teams.json` (shipped Phase 5).
- `src/lib/timezones.ts` — `VALID_TZ` Set + `FALLBACK_TZ = 'America/New_York'` (shipped Phase 5).

### Phase 5 precedent (additive payload work that this builds on)
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` §Decisions D-01 through D-07 — `team` column is the slug field Phase 6's form posts to; D-03 (`America/New_York` fallback) is the Phase 6 SSR-default story.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Inline-script + URL-param swap pattern** (`src/pages/index.astro:65-82`) — exact precedent for both the tz-label swap (D-04) and the existing `?error=` mapping (kept verbatim per FORM-03). One inline `<script is:inline>` can handle both with no extra build surface.
- **Plausible global shim** (`src/pages/index.astro:21-24`) — `window.plausible=window.plausible||function(){…}` queue. `plausible('Signup Submit', { props: { team } })` queues if pa-*.js hasn't loaded yet, then drains on load. No "is plausible loaded?" check needed.
- **Honeypot field** (`src/pages/index.astro:43-51`) — already present at the right DOM position; keep as-is. CSS `.hp` class moves it off-screen.
- **CSS variable + `<style is:global>` block** (`src/pages/index.astro:88-254`) — value-level tweaks expected for consumer aesthetic; structure stays.

### Established Patterns
- **Prerender + inline script for dynamic URL params** (CLAUDE.md §"Architecture worth understanding") — keep `export const prerender = true` on `index.astro` so the page stays CDN-cacheable. tz-label swap and `?error=` rendering run client-side.
- **Inline `<style is:global>` per page, no shared Layout** (CLAUDE.md §Conventions) — Phase 6 stays in this pattern. Phase 7 will paste the same head pattern. Layout extraction explicitly deferred to v1.1.
- **`?error=` slug vocabulary unchanged** (COMPAT-02) — Phase 6 surfaces no new error codes; the existing COPY map stays.
- **Dev-only `console.log` with bracket tag** (`src/lib/email.ts` `[email-dev-fallback]`) — D-12 mirrors this for `[plausible]`.

### Integration Points
- `index.astro` form `<select name="team">` → `references/teams.json` (already imported elsewhere in Phase 5 for backend validation; Phase 6 imports it for rendering).
- `index.astro` form `<input type="hidden" name="timezone">` → populated by inline JS from `Intl…timeZone` → POSTed to `/api/signup` which already validates against `VALID_TZ` and falls back to `FALLBACK_TZ` (Phase 5).
- `index.astro` form submit → fires Plausible `Signup Submit` event with `team` prop → Plausible dashboard ($PROJECT goals page).
- `<head>` meta tags → consumed by social platforms (FB/X/LinkedIn/Slack/iMessage) at share time + opengraph.xyz preview (Phase 11 AC6 visual check).
- LAND-02 grep target — `curl https://oddlympics.app | grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics'` runs in Phase 11; Phase 6's only obligation is to keep these strings out of the served HTML.

</code_context>

<specifics>
## Specific Ideas

- Sub-headline uses the copy doc verbatim: `Pick your team. We'll email you one hour before every match in **your local time**. Nothing else. Free, no ads, no betting odds.` Only the bold span text is swapped at runtime.
- Banner pill text: `WORLD CUP 2026 · JUNE 11 – JULY 19` (en-dash, not hyphen).
- Footer copy line: `© 2026 Oddlympics. Independent project. Not affiliated with FIFA.`
- Submit button label: `Get match alerts` (per copy doc — replaces today's `Get early access`).
- Trust line under form: `Built by one person in Michigan. No app to install. We'll never sell your email.`
- The three AC3 IANA inputs that must round-trip end-to-end (form → tz label → `/api/signup` → DB): `America/Detroit`, `Europe/London`, `Africa/Lagos` → "Detroit time", "London time", "Lagos time".
- Visual aesthetic per copy doc: "Light, sans-serif, consumer-friendly" — divergence from the existing near-black/monospace teaser. Reuse existing CSS variable names but expect to override defaults (lighter bg, sans-serif font stack — `system-ui, -apple-system, …`).

</specifics>

<deferred>
## Deferred Ideas

- **`/privacy` and `/terms` stubs in the copy doc** — Phase 7 owns rendering these as Astro routes. The copy doc retains them as canonical text; Phase 7 reads from there.
- **IP-based geolocation team preselection** — explicitly v2.0 Out-of-Scope (PROJECT.md, REQUIREMENTS.md). Removed from the copy doc as part of the docs sweep (D-01.5). Revisit only if real signup data shows user-team mismatch is a problem.
- **Build-time `scripts/check-og-image.mjs` asset guard** — considered, not adopted (D-07). Phase 11 AC6 is sufficient. Adopt only if a launch-week incident proves the gate is needed.
- **Plausible event from `/pending` page (post-redirect)** — considered as Plausible-firing alternative (event tied to successful server validation, not just submit). Rejected because fire-on-submit with sendBeacon is the simpler industry pattern and AC11 only requires the event fires on submit.
- **`Astro.site`-derived meta URLs** — considered, rejected for Phase 6 (D-08) in favor of hardcoded copy-doc strings. Revisit during a v2.x domain change.
- **Shared `Layout.astro` extraction** — CLAUDE.md trigger long since fired (6 pages). Explicitly deferred to v1.1 — `index.astro` rewrite pastes the same head pattern. When the refactor happens, do it as one focused commit, not bundled with feature work.
- **Team dropdown typeahead / search UX** — 48 options fits comfortably in a plain `<select>`; richer typeahead UX is post-v2.0 polish if cold-traffic data shows dropdown abandonment.
- **`<noscript>` fallback content** — the SSR sub-headline already reads correctly without JS (`your local time`). A dedicated `<noscript>` block is unnecessary; revisit only if A11Y audit flags it.

</deferred>

---

*Phase: 6-Landing page + form + meta + analytics*
*Context gathered: 2026-05-13*
