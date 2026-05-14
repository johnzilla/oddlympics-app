# Phase 8: Open Graph image - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Render `references/og-image.svg` → `public/og-image.png` at exact 1200×630, <300KB, content-type `image/png`, committed as a checked-in artifact so the OG/Twitter image meta tags shipped in Phase 6 (`https://oddlympics.app/og-image.png`) resolve to a real asset. The rendered card shows the wordmark, banner pill (`WORLD CUP 2026 · JUNE 11 – JULY 19`), 3-line headline, sub-line, URL, and "Independent project · Not affiliated with FIFA" tag — all matching the existing landing-page copy and satisfying LAND-02 (zero prohibited terms).

In scope:
- Pin `@resvg/resvg-js` as a devDep; write `scripts/render-og-image.mjs`; add `npm run og:render` to package.json.
- Vendor JetBrains Mono + Inter (variable `.ttf`) into `references/fonts/` so the render is deterministic on macOS dev and Ubuntu CI alike.
- Edit `references/og-image.svg` `font-family` attributes from the CSS-generic stack (`ui-monospace, ...` / `ui-sans-serif, ...`) to the explicit vendored family names (mechanical swap only — no copy edits).
- Run the script once, commit `public/og-image.png` (Astro static path → served at `/og-image.png`).
- Automated verification: file exists, content-type `image/png`, dimensions exactly 1200×630, file size <300KB, LAND-02 grep on SVG source.

Out of scope:
- Editing the OG/Twitter image meta tags — already shipped verbatim in Phase 6 (`src/pages/index.astro:14-15, 54-61`) per Phase 6 D-06/D-08. Phase 8 must NOT touch them.
- Sub-line copy alignment with the landing meta description — explicitly rejected (D-04).
- Build-time `scripts/check-og-image.mjs` asset guard — explicitly rejected in Phase 6 (D-07). Phase 11 AC6 is the only end-to-end gate.
- opengraph.xyz / Slack / iMessage manual preview verification — Phase 11 AC6 owns this.
- A CI step that re-renders the PNG and fails on drift — explicitly rejected (D-02). Rely on PR review.
- Husky/lefthook pre-commit hook — out of scope (no Husky/lefthook in the project).
- Build-system migration to render-in-CI on every deploy — explicitly rejected; PNG is a committed artifact (D-01).
- Converting SVG text to paths — considered, rejected for D-03 reasons.

</domain>

<decisions>
## Implementation Decisions

### Render toolchain (resolves ROADMAP R-3)

- **D-01:** Add `@resvg/resvg-js` as a devDependency. Write `scripts/render-og-image.mjs` that reads `references/og-image.svg`, instantiates `Resvg` with the vendored font files (D-03), renders at fitTo `{ mode: 'width', value: 1200 }` (SVG viewBox is already `0 0 1200 630`), and writes the bytes to `public/og-image.png`. Add `"og:render": "node scripts/render-og-image.mjs"` to `package.json` scripts. **Commit the rendered PNG** — `public/og-image.png` is a checked-in artifact, not a build-time output. Re-render manually by running `npm run og:render` after any SVG edit.

  Rationale: pure-Node, no system deps, deterministic, and mirrors the Phase 6 "pin a Node-only tool, commit the artifact" pattern (puppeteer-core + chrome-headless-shell). Cost: ~1.5MB devDep install (prebuilt Rust binding). Resolves Roadmap R-3 option (a)/(b) hybrid — Node-only render + committed artifact.

- **D-02:** No drift guard. No CI step to re-render and diff, no pre-commit hook. Rationale: SVG edits are rare (consumer copy is locked for the milestone); if a contributor edits the SVG and forgets `npm run og:render`, PR review or Phase 11 AC6 catches the resulting visual breakage. Adding CI surface for a once-a-quarter risk is not worth the deploy-time cost.

### Font fidelity

- **D-03:** Vendor JetBrains Mono Variable (for the wordmark, banner, URL, FIFA tag) + Inter Variable (for the 3-line headline and sub-line) as `.ttf` files in `references/fonts/`. Pass them to resvg via the `font: { fontFiles: [...], loadSystemFonts: false }` option in the render script. Edit `references/og-image.svg` to replace the CSS-generic font-family stacks with explicit vendored family names: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` → `'JetBrains Mono'`, and `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` → `Inter`.

  Rationale: resvg falls back to system fontdb when given CSS generics, producing different output on macOS dev (Menlo/Helvetica) than Ubuntu CI (DejaVu) — non-deterministic across contributors. Vendoring two variable fonts (~500KB total) eliminates the host-font dependency entirely. Variable fonts because they cover both needed weights (700 bold + 400 regular) in a single file each.

### SVG copy lock

- **D-04:** Ship `references/og-image.svg` byte-for-byte as the source-of-truth for the render, with the single mechanical exception of the `font-family` attribute swap (D-03). No copy sweep, no sub-line rewrite.

  Rationale: the 3-line headline, banner pill, URL, and FIFA-disclaimer already match landing verbatim; the sub-line ("Pick your team. Free for the whole tournament. No ads.") is intentionally card-tuned — 8 words, one line at 22px, communicates the value prop. Forcing the long landing meta-description ("Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.") would require either a smaller type size or a 2-line break and looks cramped at 1200×630.

### Verification gate

- **D-05:** Automated checks only. After `npm run og:render`, assert:
  1. `public/og-image.png` exists.
  2. First 8 bytes match the PNG signature (`89 50 4E 47 0D 0A 1A 0A`).
  3. IHDR chunk width (bytes 16–19) === 1200, height (bytes 20–23) === 630.
  4. `fs.statSync('public/og-image.png').size < 300_000`.
  5. LAND-02 grep on the source: `! grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics' references/og-image.svg` exits 0 (greps the source, since the PNG bytes don't contain text).

  Phase 11 AC6 owns the prod-side end-to-end gate (200 OK on `https://oddlympics.app/og-image.png` + opengraph.xyz preview + Slack + iMessage). Phase 8 does NOT duplicate that gate — mirrors Phase 6 D-07 single-gate strategy.

### Claude's Discretion

The planner and executor decide all of the following (no user-visible impact):
- Where the verify script lives: a standalone `scripts/verify-og-image.mjs`, inlined into `scripts/render-og-image.mjs` as a post-render check, or appended to an existing smoke script. Either is fine.
- Exact `Resvg` constructor options beyond the obvious ones (e.g., `dpi`, `background`, `imageRendering`). The viewBox-honored render at fitTo width=1200 is the canonical path; rationale comments in the script are welcome.
- Which builds of JetBrains Mono Variable + Inter Variable to vendor (Google Fonts mirror, rsms/inter GitHub release, JetBrains official release). Pick whichever delivers a clean sub-300KB-per-file variable `.ttf` with at least Latin Basic coverage. Document the source URL in a comment at the top of the render script for future re-vendoring.
- Whether to font-subset before vendoring. Probably unnecessary at this byte budget; if a contributor wants to subset to Latin Basic to save bytes, that's fine but not required.
- Whether `npm run og:render` also logs the rendered dimensions + file size for ergonomics. Almost certainly yes.
- Plan split — 1 plan (toolchain + vendor fonts + SVG family swap + render + commit + verify, all in one PR) vs. 2 plans (a: vendor fonts + tooling; b: render + commit + verify). 1 plan is fine for a single small surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source asset (the file this phase renders)
- `references/og-image.svg` — committed source. Already shipped (Phase 6 moved it here). 76 lines, ~3.9KB. ViewBox `0 0 1200 630`. Six required elements: wordmark, banner pill, 3-line headline, sub-line, URL, FIFA-disclaimer tag.

### Requirements & scope
- `.planning/REQUIREMENTS.md` §"Open Graph image" → **OG-01**: `/og-image.png` at exact 1200×630, content-type `image/png`, <300KB, contains all six required elements, source SVG checked into repo for rebuildability.
- `.planning/REQUIREMENTS.md` §"Acceptance criteria" → **AC6** (verified in Phase 11): `/og-image.png` returns 200, `image/png` content-type, exactly 1200×630, opengraph.xyz preview renders headline + banner + URL cleanly.
- `.planning/REQUIREMENTS.md` §"Landing page" → **LAND-02** binds the OG image too: zero occurrences of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics`.
- `.planning/ROADMAP.md` §"Phase 8: Open Graph image" — goal, 4 Success Criteria, **Risk note R-3** (SVG→PNG toolchain choice; this CONTEXT resolves R-3 via D-01).

### Phase 6 prior decisions (LOCKED — do not relitigate)
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions → **D-06**: meta tags hardcoded at `https://oddlympics.app/og-image.png` (1200×630) and committed in Phase 6 — Phase 8 must NOT touch the meta tags, must NOT change the URL, must NOT change the dimensions.
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions → **D-07**: Phase 11 AC6 is the only end-to-end gate. Phase 8 stays in this lane (no duplicate gate, no `scripts/check-og-image.mjs`).
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions → **D-08**: hardcoded `https://oddlympics.app/*` URLs throughout — no `Astro.site` derivation.
- `.planning/phases/06-landing-page-form-meta-analytics/06-01-PLAN.md` lines 36–60, 139–146 — the exact OG/Twitter image meta tags as shipped: `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:image:alt=Oddlympics — World Cup 2026 alerts in your time zone`, `twitter:image`. Verify the rendered PNG matches these values.

### Project context
- `.planning/PROJECT.md` §"Current Milestone" — v2.0 consumer pivot; LAND-02 prohibited-terms guardrail applies to the OG image too (verified: SVG source currently has none of the five terms).
- `CLAUDE.md` §"Stack" — Node 22 pinned for prod/CI (devDep must work on Node 22; `@resvg/resvg-js` prebuilt binaries cover Node 22).
- `CLAUDE.md` §"Conventions established" — minimalist aesthetic, mono font, accent `hsl(18 70% 56%)` ≈ `#d94a1f`. SVG already uses `#d94a1f` for the accent.

### Toolchain precedents to mirror
- `.planning/phases/06-landing-page-form-meta-analytics/06-03-PLAN.md` — `puppeteer-core` + `chrome-headless-shell` "pin a Node-only tool to avoid system deps, run via `npx` / npm script" pattern. Phase 8 D-01 follows the same shape with `@resvg/resvg-js`.
- `scripts/smoke-landing.mjs`, `scripts/smoke-signup.mjs` — existing `scripts/` directory pattern for one-shot Node verification helpers. New `scripts/render-og-image.mjs` (and optionally `scripts/verify-og-image.mjs`) follow this pattern.

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript / scripts — `node:` prefix on built-ins (`node:fs`, `node:path`, `node:buffer`); ESM throughout (`"type": "module"`); minimal comments (why-only).
- `astro.config.mjs` — Astro `output: 'server'` with `@astrojs/node` standalone adapter; static assets under `public/` are served verbatim. Confirms `public/og-image.png` → served at `/og-image.png` with content-type auto-detected from the file.
- `package.json` scripts — existing naming style is short kebab-or-colon (`smoke:landing`, `check:land-02`, `serve`, `start`). New `og:render` matches.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Source SVG** (`references/og-image.svg`, 76 lines, 3.9KB) — already shipped, LAND-02 clean, includes all six required elements. Phase 8 only edits the `font-family` attrs (D-03), nothing else.
- **OG/Twitter meta tags** (`src/pages/index.astro:14-15, 54-61`) — already shipped pointing at `https://oddlympics.app/og-image.png`. Phase 8 only needs the URL to resolve.
- **`scripts/` directory** — existing one-shot Node script pattern (`smoke-landing.mjs`, `smoke-signup.mjs`, `launch-blast.mjs`, `send-kickoff-notifications.mjs`, `ingest-schedule.mjs`). New `render-og-image.mjs` slots in here.
- **`public/` directory** — `public/favicon.svg` already shipped under it. `public/og-image.png` is the only new asset Phase 8 commits.

### Established Patterns
- **Pin Node-only tools as devDeps over system packages** — Phase 6 added `puppeteer-core` + `chrome-headless-shell` rather than relying on a system Chrome. Phase 8 follows the same logic with `@resvg/resvg-js`.
- **Commit artifacts that result from a tool run** — deploy-time simplicity, no CI surface, deterministic across hosts. Phase 8 commits `public/og-image.png` for the same reason.
- **One canonical source per asset** — `references/og-image.svg` is the only place the SVG bytes live; `public/og-image.png` is derived. Same shape as `references/teams.json` → DB.
- **LAND-02 grep guard** — existing `check:land-02` npm script greps `dist/client/index.html`. Phase 8 adds an analogous grep on `references/og-image.svg` to its verify step.

### Integration Points
- Astro static-asset path: anything in `public/` is copied verbatim to `dist/client/` at build time and served as a static file (no SSR). `public/og-image.png` → `https://oddlympics.app/og-image.png` after deploy.
- The deploy workflow (`.github/workflows/deploy.yml`) rsyncs `dist/` and `npm rebuild better-sqlite3`s on the droplet. No deploy-workflow changes needed for Phase 8 — the PNG ships as part of the normal rsync.
- Phase 11 AC6 will curl `https://oddlympics.app/og-image.png` post-deploy and assert 200 + content-type + dimensions. Phase 8 produces the asset that AC6 verifies on prod.

</code_context>

<specifics>
## Specific Ideas

- Render script path: `scripts/render-og-image.mjs`. Mirrors `scripts/smoke-signup.mjs` naming style.
- npm script name: `og:render` (colon-namespaced, matches `smoke:landing` + `check:land-02`).
- Output path: `public/og-image.png` (Astro static).
- Font dir: `references/fonts/` (co-located with `references/og-image.svg` — they're render-time-only inputs, not served assets).
- Font files to vendor: JetBrains Mono Variable + Inter Variable, both `.ttf`, with at least Latin Basic coverage (en-dash `–` is U+2013, apostrophe `'` is U+2019 — both in Latin Basic).
- SVG `font-family` attr swap (mechanical):
  - `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` → `'JetBrains Mono'`
  - `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` → `Inter`
- Render call shape (rough, planner refines):
  ```js
  new Resvg(svgBuffer, {
    font: {
      fontFiles: ['references/fonts/JetBrainsMono-Variable.ttf',
                  'references/fonts/Inter-Variable.ttf'],
      loadSystemFonts: false,
    },
    fitTo: { mode: 'width', value: 1200 },
  }).render().asPng()
  ```
- Verify checks (≤5 lines of Node each, no extra devDep):
  1. `fs.existsSync('public/og-image.png')`
  2. First 8 PNG signature bytes match `[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]`
  3. IHDR chunk width (bytes 16–19, big-endian u32) === 1200; height (bytes 20–23) === 630
  4. `fs.statSync('public/og-image.png').size < 300_000`
  5. SVG-source LAND-02 grep returns no matches
- Plan-time: confirm `@resvg/resvg-js` latest version is compatible with Node 22 — quick `npm view @resvg/resvg-js engines` check before pinning.

</specifics>

<deferred>
## Deferred Ideas

- **CI-side re-render + git-diff drift guard** — considered (D-02), rejected as not worth the deploy-time cost for a once-a-quarter risk. Revisit if a real SVG-edit-without-re-render incident happens.
- **Husky / lefthook pre-commit hook** — considered (D-02), rejected (no Husky/lefthook in the project; not adding one for a one-off guard).
- **Visual-regression baseline byte-compare** — considered (D-05), rejected; valuable only if we expected frequent SVG edits, which we don't. Revisit if the OG card becomes a high-churn surface (e.g., per-event variants in v2 multi-event coverage).
- **opengraph.xyz / Slack / iMessage manual preview as a Phase 8 gate** — considered (D-05), deferred to Phase 11 AC6. Adopt earlier only if the launch gate is delayed past 2026-05-19.
- **Sub-line copy alignment to landing meta description** — considered (D-04), rejected for visual-density reasons. Revisit if a social-share post-mortem shows the card's sub-line confuses users.
- **Per-team OG image variants** (e.g., a card branded with the user's team's flag) — out of scope; would require per-URL Open Graph overrides and a render-on-request pipeline. v2 territory after WC validates the personalization graph.
- **Font subsetting** — considered as Claude's-discretion polish, deferred unless byte budget becomes a concern.
- **Convert SVG text to paths** — considered as a font-determinism alternative (D-03), rejected; doubles the source-of-truth surface and makes copy edits harder.

</deferred>

---

*Phase: 8-Open Graph image*
*Context gathered: 2026-05-14*
