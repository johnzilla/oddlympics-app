# Phase 15: Personalized Open Graph - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v2.1 referral loop visually: a shared referral link unfurls in social
previews (Facebook, X, iMessage, Slack, etc.) with an image of the **sharer's
team**, not the generic `/og-image.png`. The mechanism is a new
**server-rendered `/r/CODE` route** that serves a thin HTML shell with
personalized `og:*` / `twitter:*` meta in `<head>` and bounces real users back
to `/?ref=CODE` so the Phase 13 attribution plumbing fires unchanged.

In scope:
- A new server-rendered route `src/pages/r/[code].astro` (`prerender = false`)
  that resolves the code via the existing `lookupByReferralCode` prepared
  statement (`src/lib/db.ts:174-176`) → team slug → team label, and emits
  per-team OG meta. Bounces with `<meta http-equiv="refresh">` + JS
  `location.replace('/?ref=CODE')`.
- One parameterized SVG template `references/og-image-team.svg` with a
  `{{TEAM_LABEL}}` token (and a dynamic font-size for long names).
- A new build-time script `scripts/render-team-og-images.mjs` that loops
  `references/teams.json` (48 entries), substitutes per slug, and renders
  via the same vendored `@resvg/resvg-js` config Phase 8 locked in
  (`scripts/render-og-image.mjs`). Outputs to `public/og/<slug>.png`,
  committed.
- A trim-fallback path: if `public/og/<slug>.png` is missing at request time,
  the route falls back to `/og-image.png` but title/description still
  personalize. Lets us ship with partial team coverage.
- Migration of Phase 14's share UI on **all four surfaces** (`pending.astro`,
  `confirmed.astro`, `manage.astro`, `email.ts`) to emit `/r/CODE` URLs
  instead of `/?ref=CODE`.
- Smoke + render-time verification: extend `scripts/smoke-signup.mjs` with
  `/r/<known-code>` + `/r/notarealcode` response-body checks; the render
  script prints `[og:render-teams] N/48 PASS` and exits 1 on any fail.

Out of scope (locked / deferred):
- **No per-team accent color, no per-team flag art.** Visual variance is the
  team-name swap only — runway-safe (D-06).
- **No new `flag` field** on `references/teams.json`. Stayed deferred from
  Phase 14 D-10 — same Windows-emoji and editorial-minimalist rationale.
- **No referral count, leaderboard, rewards, fraud system** — REF-F1/REF-F2
  Future Requirements + REQUIREMENTS.md "Out of Scope".
- **No new auth surface, no HMAC signing of `/r/CODE`.** The code is a
  public 8-char `[a-z0-9]` short ID (Phase 13 D-01). `/r/CODE` is intentionally
  status-agnostic — no join on `confirmed_at` / `unsubscribed_at`.
- **No 404 on unknown codes.** Stale links must continue to unfurl (generic)
  and continue to land users on `/` — matches the Phase 13 "signup never
  rejects" contract.
- **No retroactive update of already-shipped `/?ref=CODE` links.** Phase 13
  plumbing handles them; they unfurl generic forever, which is acceptable
  (same as today). Only newly emitted shares get `/r/CODE`.
- **No on-demand server render of OG PNGs at request time.** Build-time
  commit is the chosen pattern (mirrors Phase 8).
- **No refactor of `scripts/render-og-image.mjs`.** The generic OG render
  stays untouched; team-render is a new sibling script.
- **No change to `Layout.astro`'s `og` prop shape.** It already accepts
  `image: string` — the route just passes the per-team or generic URL.

</domain>

<decisions>
## Implementation Decisions

### Route shape & behavior

- **D-01:** `/r/CODE` returns a thin HTML shell whose `<head>` carries
  personalized `og:image`, `og:title`, `og:description`, `og:url`,
  `twitter:title`, `twitter:description`, `twitter:image` (Layout.astro
  already wires these — pass the right `og` prop). The shell also emits
  `<meta http-equiv="refresh" content="0; url=/?ref=CODE">` and an inline
  `<script>location.replace('/?ref=CODE')</script>`. Bots scrape meta;
  humans bounce to `/?ref=CODE` within ~0ms so the existing Phase 13/14
  hidden-ref + form-POST carry-through plumbing on `/` fires unchanged.
- **D-02:** **Unknown / malformed / unresolvable CODE** — same thin shell,
  but `og:image = /og-image.png` (generic), no team in title, JS bounce to
  `/` (no `?ref=`, nothing to attribute). 200 OK, never 404. Stale shared
  links continue to unfurl and continue to deliver recipients to the
  landing page. Mirrors Phase 13's "signup never rejects" contract.
- **D-03:** **Unsubscribed users still personalize.** `lookupByReferralCode`
  returns `email + referral_code` only (no status join) — and intentionally
  stays that way. Phase 14 D-17's "hide share UI in `/manage`'s
  unsubscribed branch" only stops the *sharer* from being prompted to
  recruit; it does not invalidate links they shared before unsubscribing.
  A recipient of a shared link never sees the sharer's email or status.
- **D-04:** Route file: **`src/pages/r/[code].astro`** with
  `export const prerender = false`. Astro dynamic-route pattern. Frontmatter
  reads `Astro.params.code`, calls `lookupByReferralCode`, branches per
  resolved / unresolved, then renders the Layout shell.

### Per-team image design

- **D-05:** **One parameterized SVG template** at
  `references/og-image-team.svg` with a `{{TEAM_LABEL}}` token (and a
  `{{HEADLINE_FONT_SIZE}}` token — see D-08). New build-time script
  `scripts/render-team-og-images.mjs` loads the template, loops
  `references/teams.json`, string-substitutes per slug, and feeds each
  resulting SVG into the same `Resvg` config the generic OG render uses.
  48 outputs from one source. Easy to evolve later.
- **D-06:** **Visual variance is team-name swap only.** Same chrome as the
  generic `references/og-image.svg`: dot wordmark top-left, banner pill,
  3-line headline, sub line, URL bottom-left, decorative flag rectangles
  right-side. No per-team accent color, no per-team flag art. Trim-safe;
  ships in time.
- **D-07:** **Headline copy** (replaces the generic 3-line headline):
  ```
  Following [TEAM].
  Every match in your zone.
  One ping before kickoff.
  ```
  Line 3 stays in `#d94a1f` accent — preserves the existing visual
  hierarchy from `references/og-image.svg:35`.
- **D-08:** **Auto-scale headline font-size by label length.** Script
  computes:
  ```
  fontSize = labelLen <= 12 ? 64
           : labelLen <= 16 ? 52
           : 44
  ```
  Applied to all 3 headline lines (for consistent block height — only
  line 1 actually has the team name, but lines 2–3 follow so the
  composition stays balanced). Verified case: "Bosnia and Herzegovina"
  (22 chars) fits at 44pt. No per-team config required; works for any
  future team-list edit.

### Build, storage & verification

- **D-09:** **Commit 48 PNGs to `public/og/<slug>.png`**, same pattern Phase 8
  established for `public/og-image.png`. Per-PNG budget < 300KB; expected
  total ~4–7MB in git. Re-running the script is a no-op when SVG source +
  team list are unchanged (deterministic font config — `loadSystemFonts:
  false`). Deploy is unchanged: `public/` rsync continues to ship the
  files to the droplet. `npm run og:render-teams` is the manual entrypoint
  for the operator (no CI gate enforces re-render; lives in the same
  trust contract as the existing `npm run og:render`).
- **D-10:** **Trim-fallback fires at request time** via
  `existsSync(resolve(<repo-root>, 'public/og/' + slug + '.png'))` in the
  `/r/[code].astro` frontmatter. Missing PNG → `og:image = /og-image.png`
  (generic), but `og:title` / `og:description` / `<title>` still
  personalize per team. Ships with **partial coverage** if needed
  (e.g. UEFA-only on day one) and adds more teams later with **no code
  change** — just commit additional PNGs and the route picks them up on
  next deploy.
- **D-11:** **New script `scripts/render-team-og-images.mjs`**, separate
  from `scripts/render-og-image.mjs`. Reuses the same `Resvg` config:
  same `fontFiles` (`JetBrainsMono-Bold.ttf`, `Inter-Regular.ttf`,
  `Inter-Bold.ttf` from `references/fonts/`), same `loadSystemFonts:
  false`, same `fitTo: { mode: 'width', value: 1200 }`. Per-PNG
  verification mirrors the generic script's 6 checks: file exists,
  PNG signature, IHDR width 1200, IHDR height 630, size < 300KB,
  LAND-02 grep on the *substituted* SVG (each iteration grepped
  individually to catch a team name accidentally matching a banned
  term). New `npm run og:render-teams` script in `package.json`.
- **D-12:** **End-to-end verification two ways.**
  (a) **Render-time**: the script prints
  `[og:render-teams] 48/48 PASS` (or `N/48 PASS` if partial) and exits 1
  on any single fail. CI-style strict gate.
  (b) **Runtime smoke**: extend `scripts/smoke-signup.mjs` with two new
  cases mirroring Phase 14 D-18:
  - `SHARE-r-known` — GET `/r/<row.referral_code>`, grep response body
    for both `og:image" content="https://oddlympics.app/og/<team-slug>.png`
    (or generic if PNG missing) AND `og:title" content="Following <Team>`.
  - `SHARE-r-unknown` — GET `/r/notarealcode`, grep for generic
    `og:image" content="https://oddlympics.app/og-image.png` and no
    team-named title.
  Exit 0 = both PASS. Same script, same exit contract Phase 14 already
  uses.

### Phase 14 link migration

- **D-13:** **Migrate all four Phase 14 surfaces** to `/r/CODE`:
  - `src/pages/pending.astro:77` — `const shareUrl = location.origin + '/?ref=' + rc;`
    → `... + '/r/' + rc;`
  - `src/pages/confirmed.astro:90` — same swap.
  - `src/pages/manage.astro:70` — `shareUrl = base + '/?ref=' + user.referral_code;`
    → `... + '/r/' + ...`.
  - `src/lib/email.ts:29` — `const shareUrl = SITE_URL + '/?ref=' + referralCode;`
    → `... + '/r/' + ...`.
  The `shareText(teamLabel, url)` helper in `src/lib/copy.ts` is **untouched**
  — it accepts any URL. Already-shipped Phase 14 links (`/?ref=CODE`) continue
  to function indefinitely: Phase 13's hidden-ref carry-through still records
  `referred_by`, the unfurl just stays generic. Acceptable — same as today.

### Meta text personalization

- **D-14:** On `/r/CODE` with a **resolved** code:
  - `og:title` = `Following [TEAM] · oddlympics`
  - `og:description` = `Every World Cup match in your time zone. One ping before kickoff.`
  - `<title>` = `Following [TEAM] · oddlympics`
  - `twitter:title` / `twitter:description` / `twitter:image` auto-mirror via
    `Layout.astro:61-67` (`twitter:title = og.title`,
    `twitter:description = og.twitterDescription ?? og.description`,
    `twitter:image = og.image`). No changes to `Layout.astro` needed.
  - `og:url` = `${PUBLIC_SITE_URL}/r/${code}` (canonical for the share).

  On `/r/CODE` with an **unresolved** code:
  - `og:title` = current generic landing title (e.g. `oddlympics — your team's World Cup matches`).
  - `og:description` = current generic landing description.
  - `og:image` = `/og-image.png` (generic).
  - `og:url` = `${PUBLIC_SITE_URL}/` (canonical for the generic landing).

### Body content during bounce

- **D-15:** `/r/CODE` renders the **`<Layout>` shell** (banner pill, footer,
  shared chrome) with a minimal body:
  ```
  <div class="wrap" style="padding: 4rem 0;">
    <p>Redirecting… if you're not redirected,
       <a href="/?ref={code}">tap here</a>.</p>
  </div>
  ```
  - JS users blink past it (<50ms).
  - No-JS users see consistent oddlympics chrome and one anchor to continue.
  - Meta-refresh fires for clients that respect it (most do).
  - The `<meta http-equiv="refresh">` lives in `Layout.astro`'s existing
    `<slot name="head" />` — the route slots it in, no Layout edit needed.
  - The anchor `href` is `/?ref=CODE` for resolved codes, `/` for unresolved
    (no `?ref=` to carry).
  - Footer stays on for consistency (the user only sees the body for the
    sliver of time before JS bounces).

### Claude's Discretion

- **Whether to fire a Plausible custom event** (`Share Unfurl` or `Ref Route Hit`)
  on `/r/CODE` server-render. Cheap. Measures how often unfurls actually
  resolve vs. how often the share button is clicked (Phase 14's `Share Click`).
  Recommended but not blocking — the loop is already measurable via
  `referred_by` + form-submit telemetry.
- **Exact placement of the redirect notice in the body** — inside `.wrap`
  with some padding, or as a banner-style strip. The notice is briefly
  visible, so house-style polish is welcome but not critical.
- **Whether the team slug → display label lookup in `/r/[code].astro` calls
  `teamLabel(slug)` from `src/lib/teams.ts:16-18` directly or imports a
  thin `og.ts` helper that wraps the existence-check + label-fetch.** Either
  is fine — `teamLabel` is already the single source of truth.
- **Plan/wave split.** Suggested:
  - **Wave 1** (parallel): SVG template + render script + `npm run og:render-teams`
    wired up; route file `/r/[code].astro` with the resolved/unresolved branches.
  - **Wave 2** (blocked on Wave 1): migrate the four Phase 14 share-URL emit
    sites to `/r/CODE`; commit the 48 PNGs.
  - **Wave 3** (blocked on Wave 2): extend `scripts/smoke-signup.mjs`; run
    locally against `npm run serve` for the gate.
- **Order of `references/teams.json` iteration in the render script** — purely
  cosmetic for the console output. Confederation-grouped (matches landing
  `<select>` order) reads nicely.
- **Whether the route uses Astro's static-or-runtime `fileURLToPath` for the
  `existsSync` path resolution** — equivalent options; planner picks the one
  consistent with how `db.ts` resolves the SQLite path.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope (read first)
- `.planning/ROADMAP.md` §"Phase 15: Personalized Open Graph" — goal,
  depends-on (Phase 14), the 4 success criteria (SC1–SC4 are authoritative,
  including the SC4 scope-trim fallback).
- `.planning/REQUIREMENTS.md` §"Personalized Open Graph" — OG-02
  (per-team OG images, 48 teams), OG-03 (shared link unfurls with sharer's
  team image); §"Out of Scope" (no rewards / leaderboard / fraud system).
- `.planning/PROJECT.md` §"Current Milestone: v2.1 Referral & Social
  Sharing" + "Key Decisions" — the **long-pole / first-trim framing**
  for per-team OG, the deadline anchor (2026-06-11).

### Prior-phase decisions (read before planning)
- `.planning/phases/14-share-experience/14-CONTEXT.md` — Phase 14 explicitly
  deferred the `/r/CODE` route and per-team OG to Phase 15 (D-14, D-10);
  the share-URL emit sites that Phase 15 migrates are catalogued here
  (`pending.astro:77`, `confirmed.astro:90`, `manage.astro:70`,
  `email.ts:29`); the `shareText(teamLabel, url)` helper contract is
  locked in 14-D-08 (signature unchanged in Phase 15); D-18 establishes
  the smoke-signup.mjs response-body grep pattern Phase 15 reuses.
- `.planning/phases/13-referral-code-attribution/13-CONTEXT.md` — referral
  code shape (8 chars, `[a-z0-9]`, public, opaque, **not** HMAC-signed) at
  D-01; status-agnostic `lookupByReferralCode` at D-07 (this is the prepared
  statement `/r/[code].astro` calls); the "signup never rejects" / "unknown
  ref silently ignored" contract Phase 15's D-02 mirrors.
- `.planning/phases/08-open-graph-image/08-CONTEXT.md` — the resvg toolchain
  pattern Phase 15's render script reuses verbatim: vendored
  `@resvg/resvg-js`, `loadSystemFonts: false`, `fitTo: { mode: 'width',
  value: 1200 }`, fonts in `references/fonts/`, deterministic render across
  dev/CI, the 6 post-render checks (file exists / PNG sig / IHDR W / IHDR H
  / size budget / LAND-02 grep), commit-PNG-to-`public/` storage pattern,
  manual `npm run og:render` operator entrypoint.

### Existing code to edit (READ before editing)
- `src/lib/db.ts:174-176` — `lookupByReferralCode` prepared statement.
  Returns `{ email, referral_code }`. **No schema change** in Phase 15.
- `src/lib/teams.ts:16-18` — `teamLabel(slug)`. Single source of truth for
  the slug → display label mapping used in D-07 / D-14.
- `src/components/Layout.astro:50-69` — the `og` prop shape that already
  emits `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`,
  `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`,
  `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
  **No prop-shape changes needed** — Phase 15's route just passes the right
  values. The `<slot name="head" />` at `:81` is where the meta-refresh
  goes (D-15).
- `src/pages/index.astro:15` — `const OG_IMAGE = 'https://oddlympics.app/og-image.png';`
  pattern for building the absolute OG URL. Phase 15's route uses
  `${PUBLIC_SITE_URL}/og/<slug>.png` or `${PUBLIC_SITE_URL}/og-image.png`
  for the trim fallback. (Reads from `process.env.PUBLIC_SITE_URL` like
  `src/lib/email.ts:9`.)
- `src/pages/pending.astro:77` — share-URL emit site. Migrate to `/r/`.
- `src/pages/confirmed.astro:90` — share-URL emit site. Migrate to `/r/`.
- `src/pages/manage.astro:70` — share-URL emit site. Migrate to `/r/`.
- `src/lib/email.ts:29` — share-URL emit site in `sendMagicLink`.
  Migrate to `/r/`.
- `scripts/render-og-image.mjs` — **read but do not edit.** Phase 15's
  new script is a sibling; the generic OG render path stays untouched.
- `references/og-image.svg` — **read for visual reference.** Phase 15's new
  `references/og-image-team.svg` keeps the same chrome but with token
  placeholders for headline text and font-size.
- `scripts/smoke-signup.mjs` — extend per D-12 with two new cases
  (`SHARE-r-known`, `SHARE-r-unknown`).
- `package.json` — add `og:render-teams` script next to the existing
  `og:render`.

### Existing infrastructure (depends on, must not break)
- `references/teams.json` — 48 teams, slug/label/confederation. Source of
  truth for both the render loop and the per-team meta. No new fields
  added in this phase (D-06 / Phase 14 D-10).
- `references/fonts/` — JetBrainsMono-Bold.ttf, Inter-Regular.ttf,
  Inter-Bold.ttf. Vendored in Phase 8; reused as-is.
- `@resvg/resvg-js` — npm dep, vendored. Same config across both render
  scripts (D-11).

### Codebase conventions (downstream MUST match)
- `.planning/codebase/CONVENTIONS.md` — strict TS, `node:` prefix,
  prepared statements, no framework JS, defensive `try/catch`-wrapped
  inline scripts, why-only comments, the `Layout.astro`-wraps-every-page
  rule.
- `.planning/codebase/ARCHITECTURE.md` — hybrid static + server Astro;
  `prerender = false` for any route that varies its response per
  request — governs D-04. Server-rendered routes run inside
  `dist/server/entry.mjs` under systemd.
- `CLAUDE.md` "Conventions established" — sans body, mono accents,
  `--accent: #b8350d` for in-app text, `#d94a1f` for OG/image accent
  (these differ historically — the OG SVG uses `#d94a1f`, preserved in
  D-07).

No external ADRs/specs — requirements are fully captured in ROADMAP.md
SC1–SC4 + REQUIREMENTS.md OG-02/OG-03 + the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lookupByReferralCode` — `src/lib/db.ts:174-176`**: the only DB call the
  new route makes per request. `SELECT email, referral_code FROM vip_signups
  WHERE referral_code = ?` — already narrowed, already prepared. Note it
  returns `email`, not `team` — the route resolves `email → team` via a
  second prepared statement (planner can extend `db.ts` with a narrow
  `lookupTeamByReferralCode` returning `referral_code + team` to make this
  a single SELECT, or use `getByEmail` as a follow-on; mild Discretion).
- **`teamLabel(slug)` — `src/lib/teams.ts:16-18`**: slug → human label.
  Already used by `sendMagicLink` (`email.ts:26`), the consumer landing,
  and the share-text helper. Phase 15's render script and `/r/[code].astro`
  both consume it.
- **`@resvg/resvg-js` config — `scripts/render-og-image.mjs:40-55`**: the
  deterministic-render contract (`loadSystemFonts: false`, explicit
  `fontFiles`, `fitTo` width-lock). Phase 15's new render script copies
  it verbatim.
- **6-check post-render verification — `scripts/render-og-image.mjs:62-101`**:
  PASS/FAIL counter + 6 checks (file-exists, png-signature, ihdr-width-1200,
  ihdr-height-630, size-lt-300kb, land-02-clean). Phase 15 loops this set
  per team and aggregates.
- **`PUBLIC_SITE_URL` constant pattern — `src/lib/email.ts:9` + `src/pages/manage.astro:69`**:
  reads `process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321'`. Phase 15's
  route uses this when building absolute OG URLs (Facebook + Twitter require
  absolute URLs for `og:image`).
- **`Layout.astro`'s `og` prop + `<slot name="head" />` — `src/components/Layout.astro:18-27, 81`**:
  the route passes a fully-formed `og` prop and slots the meta-refresh into
  the head. **No edits to Layout.astro needed.**
- **`scripts/smoke-signup.mjs` D-18 pattern**: response-body grep against
  the running server. Phase 15 extends with two new cases under the same
  exit-0-or-1 contract.

### Established Patterns
- **Dynamic route file naming — `src/pages/[route].astro`**: Astro convention.
  Phase 15 introduces the first nested dynamic route in this codebase
  (`src/pages/r/[code].astro`). Mechanics are identical to the existing
  static-named server pages (`manage.astro`, `schedule.astro` — both
  `prerender = false`).
- **303 redirects with query params + inline script readers**: Phase 14
  established this for the `&rc=` carry-through to `/pending` and
  `/confirmed`. Phase 15 does NOT use 303 — the route renders HTML
  directly so the bot can scrape it. The "redirect" is a meta-refresh
  + JS `location.replace`, not an HTTP 30x.
- **Build-time PNG render + commit (Phase 8 pattern)**: deterministic
  output, manual operator entrypoint, no CI gate enforces re-render.
  Phase 15 follows verbatim with the new script.
- **Defensive inline `<script>` blocks**: every script in this codebase
  is wrapped in `try/catch` (Phase 13 D-13, Phase 14 D-03). The bounce
  script (`location.replace('/?ref=' + code)`) follows the same idiom.
- **String concatenation in inline `<script>` for templated values**:
  Phase 14's `pending.astro:77` builds `shareUrl` via `location.origin
  + '/?ref=' + rc`. Phase 15's bounce uses an Astro-frontmatter-injected
  literal (`<script>location.replace({JSON.stringify('/?ref=' + code)})</script>`),
  which is safer for the server-rendered context.

### Integration Points
- `lookupByReferralCode` (Phase 13) ← read by `/r/[code].astro` (D-01 / D-02 /
  D-04).
- `teamLabel(slug)` (`src/lib/teams.ts`) ← consumed by `/r/[code].astro`
  (D-14: build personalized title) and `scripts/render-team-og-images.mjs`
  (D-07: inject team label into SVG).
- `references/og-image-team.svg` (new) ← consumed by
  `scripts/render-team-og-images.mjs` (D-05) → outputs
  `public/og/<slug>.png` × 48 (D-09).
- `existsSync('public/og/<slug>.png')` (D-10) ← called by
  `/r/[code].astro` frontmatter per request — branches `og:image`
  between per-team and generic.
- `/r/CODE` (new) ← emitted by `pending.astro`, `confirmed.astro`,
  `manage.astro`, `email.ts` (D-13). Old `/?ref=CODE` links continue to
  resolve correctly through Phase 13's hidden-ref carry-through.
- `scripts/smoke-signup.mjs` ← extends with two new cases (D-12);
  exit-0 contract preserved.

</code_context>

<specifics>
## Specific Ideas

- **Per-team PNG URL canonical form:** `https://oddlympics.app/og/usa.png`
  — absolute (Facebook + Twitter requirement), built from
  `${PUBLIC_SITE_URL}/og/${slug}.png`. Slug is the existing
  `references/teams.json` slug field (lowercase ASCII, underscores for
  multi-word — e.g. `united_states`, `czech_republic`).
- **Resolved-code response (head):**
  ```
  <head>
    <title>Following USA · oddlympics</title>
    <meta property="og:title" content="Following USA · oddlympics" />
    <meta property="og:description" content="Every World Cup match in your time zone. One ping before kickoff." />
    <meta property="og:image" content="https://oddlympics.app/og/united_states.png" />
    <meta property="og:url" content="https://oddlympics.app/r/k7m2qx9a" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Following USA · oddlympics" />
    <meta name="twitter:description" content="Every World Cup match in your time zone. One ping before kickoff." />
    <meta name="twitter:image" content="https://oddlympics.app/og/united_states.png" />
    <meta http-equiv="refresh" content="0; url=/?ref=k7m2qx9a" />
  </head>
  ```
- **Unresolved-code response (head):**
  ```
  <title>oddlympics — your team's World Cup matches</title>
  <meta property="og:image" content="https://oddlympics.app/og-image.png" />
  <meta property="og:url" content="https://oddlympics.app/" />
  <!-- og/twitter title + description match the generic landing -->
  <meta http-equiv="refresh" content="0; url=/" />
  ```
- **Resolved-code body:**
  ```
  <div class="wrap" style="padding: 4rem 0;">
    <p>Redirecting…
       if you're not redirected,
       <a href="/?ref=k7m2qx9a">tap here</a>.</p>
  </div>
  ```
- **Render script invocation:**
  ```
  $ npm run og:render-teams
  [og:render-teams] england         92 KB → public/og/england.png
  [og:render-teams] france          88 KB → public/og/france.png
  [og:render-teams] bosnia          103 KB → public/og/bosnia.png  (44pt headline)
  ...
  [og:render-teams] 48/48 PASS
  ```
- **SVG template — headline section (replaces og-image.svg:32-36):**
  ```
  <g transform="translate(72, 252)" font-family="Inter" fill="#14151a">
    <text x="0" y="0"   font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2">Following {{TEAM_LABEL}}.</text>
    <text x="0" y="74"  font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2">Every match in your zone.</text>
    <text x="0" y="148" font-size="{{HEADLINE_FONT_SIZE}}" font-weight="700" letter-spacing="-1.2" fill="#d94a1f">One ping before kickoff.</text>
  </g>
  ```
  (Planner may refine line-spacing-y to keep the block height balanced
  across the three font-size buckets; the y-offsets above are the existing
  64pt values.)
- **Smoke cases — copy-pasta sketch for `scripts/smoke-signup.mjs`:**
  ```
  // SHARE-r-known
  const r1 = await fetch(`${BASE}/r/${row.referral_code}`, { redirect: 'manual' });
  assert(r1.status === 200, 'r/known returns 200');
  const body1 = await r1.text();
  assert(body1.includes(`og:image" content="`) && (body1.includes(`/og/${row.team}.png`) || body1.includes('/og-image.png')), 'r/known carries og:image (per-team or fallback)');
  assert(body1.match(/og:title" content="Following [^"]+ · oddlympics"/), 'r/known carries personalized og:title');

  // SHARE-r-unknown
  const r2 = await fetch(`${BASE}/r/notarealcode`, { redirect: 'manual' });
  assert(r2.status === 200, 'r/unknown still 200');
  const body2 = await r2.text();
  assert(body2.includes('og:image" content="https://oddlympics.app/og-image.png"') || body2.includes(`og:image" content="http://localhost:4321/og-image.png"`), 'r/unknown carries generic og:image');
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Per-team accent color** — D-06 considered + rejected for runway reasons.
  Cheap one-time data load (small color table in a sibling file). Revisit
  post-launch if A/B testing shows unfurl engagement needs more visual punch.
- **Per-team flag block art** — same rationale. Would require either drawing
  48 simple SVG flag glyphs or accepting Windows-inconsistent emoji rendering
  (already rejected in Phase 14 D-10). Strong candidate for a post-launch
  polish phase once the share loop is proven.
- **301 forward from `/?ref=CODE` to `/r/CODE`** — would canonicalize old
  links to the new route so even old shipped links unfurl personalized.
  Tradeoffs: more code on the `/` prerender (it can't 301 — it's prerendered),
  would have to do it at the Caddy or middleware layer, breaks the
  intentional "old links keep working as-is" stance in D-13. Revisit only
  if old-link unfurl quality becomes a measured pain point.
- **Plausible custom event on `/r/` server-render** — Claude's Discretion in
  Phase 15 D-area. Implement if planner has the capacity; otherwise
  post-launch quick-add.
- **Short-label override field on `references/teams.json`** — was the third
  option for handling long team names in D-08. Auto-scaling font-size
  obviates the need, but a manual `shortLabel` override remains a clean
  fallback if any future team's label looks visually awkward at the smallest
  bucket.
- **Refactor `scripts/render-og-image.mjs` to share helpers with the new
  team-render script** — both scripts will have duplicated Resvg config
  + verification logic. Discretion now (D-11 chose separate); revisit if
  a third image-render need appears.
- **REF-F1 ("you've referred N friends" counter on `/manage`)** —
  unchanged from Phase 14 deferred list; Future Requirements.
- **REF-F2 (leaderboard, rewards, milestone unlocks)** — unchanged from
  Phase 14 deferred list; Future Requirements.

None new from discussion that don't fit existing-roadmap or
Future-Requirements buckets — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-personalized-open-graph*
*Context gathered: 2026-05-23*
