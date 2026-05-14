# Phase 7: Legal pages - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship `/privacy` and `/terms` as Astro static pages (`prerender = true`) serving canonical legal copy on the same site shell as the v2.0 landing page. Pages exist to satisfy paid-ad reviewer requirements (Meta, Google) and GDPR/CCPA disclosure obligations. Pure content — no form, no JS, no data persistence.

In scope:
- New `src/pages/privacy.astro` rendering canonical privacy copy (~200 words from the copy doc).
- New `src/pages/terms.astro` rendering canonical terms copy (~150 words from the copy doc).
- Two new canonical-copy files: `references/privacy.md` and `references/terms.md` (extracted from `references/oddlympics_landing_copy.md` stubs, ESP placeholder gap-filled with "Resend") — created in a pre-plan docs sweep, not as a Phase 7 plan task.
- Same consumer footer as landing (Manage / Privacy / Terms / Contact + "Independent project · Not affiliated with FIFA").
- Same `--max: 720px` content container, same mobile breakpoint (520px), same type scale as landing.
- LAND-02 compliance — zero occurrences (case-insensitive) of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` anywhere in served HTML or inline assets on either page.

Out of scope (other phases own):
- Landing page rewrite — Phase 6 (shipped).
- OG image asset rendering — Phase 8.
- `/manage` editor + one-time banner — Phase 9.
- Confirmation email body update — Phase 10.
- End-to-end + AC5/AC7 verification on prod — Phase 11 (this phase only confirms the routes return 200 with the right copy locally + post-deploy spot-check).
- Token semantics for unsubscribe — covered in Phase 9 (MANAGE-02).
- Header bar with a wordmark back-link — explicitly rejected (D-05). Footer is the only nav surface, matching landing.
- Layout.astro extraction — deferred to v1.1 per CLAUDE.md; Phase 7 pastes a trimmed `<style is:global>` block per page (D-07).

</domain>

<decisions>
## Implementation Decisions

### Canonical copy source-of-truth

- **D-01:** Hand-author HTML in `privacy.astro` and `terms.astro` (no markdown→HTML build pipeline). Mirrors Phase 6 D-02 precedent — `references/*.md` is the editorial canonical source; the `.astro` file is a hand-translation. Rationale: pages are ~200 / ~150 words; a Content-Collections layer adds frontmatter wiring + body CSS scoping for marginal benefit. Editing the `.md` is a docs commit; the `.astro` update follows in the same Phase 7 PR.

- **D-02 [informational]:** Pre-plan docs sweep — single commit before `/gsd-plan-phase 7` (completed in commit `08c4d4a` before this plan ran; not a Phase 7 plan task):
  1. Create `references/privacy.md` by extracting the `## /privacy stub` blockquote from `references/oddlympics_landing_copy.md` (lines 125–155).
  2. Create `references/terms.md` by extracting the `## /terms stub` blockquote (lines 159–173).
  3. Gap-fill the ESP placeholder `[Your ESP — Resend, Buttondown, ConvertKit, etc.]` (copy doc line 153) → "Resend".
  4. Drop the leading `>` blockquote markers when extracting (the source uses them only to visually frame the stub inside the larger copy doc).
  5. Confirm wording matches REQUIREMENTS.md LEGAL-01 / LEGAL-02 declarations before commit.
  - Commit message: `docs(07): extract legal stubs to references/{privacy,terms}.md`.
  - This sweep is a precondition for planning, not a Phase 7 plan task. Mirrors Phase 6 D-01 pattern.

### "Last updated" date

- **D-03:** Hardcoded `LAST_UPDATED` constant in each `.astro` frontmatter. Bumped manually only when the legal *content* changes (a non-deploy code change does NOT trigger a bump). Rationale: legal-doc convention is to track content-edit date, not deploy date; LEGAL-01/02's literal "matches the deploy date" is satisfied at first deploy (the only deploy where content and deploy timing coincide). Auto-injecting git commit date would cause spurious updates on every CSS tweak — worse, not better, for legal correctness.

- **D-04:** Date format rendered as `May 13, 2026` (long-form US date) to match the copy doc's existing `**Last updated: May 12, 2026**`. Frontmatter constant can stay ISO (`LAST_UPDATED = '2026-05-13'`) with a small `formatDate()` helper or just inline both — planner decides. Single source per page.

### Page chrome

- **D-05:** Footer-only navigation, matching landing. No top header, no back-link, no wordmark bar. Page starts with the `<h1>` ("Privacy Policy" / "Terms"). The site footer (`Manage / Privacy / Terms / Contact / © 2026 Oddlympics · Independent project · Not affiliated with FIFA`) provides the only nav surface. Rationale: paid-ad reviewers expect simple legal pages; consumer-facing back-navigation works via browser back-button and the footer's sibling links.

- **D-06:** Email addresses (`privacy@oddlympics.app` in privacy, `hello@oddlympics.app` in both) render as `<a href="mailto:...">` wrapping `<code>...</code>`. Clickable from any device, monospace cue signals "this is an actual address you can use." The footer's existing `Contact` link is already `mailto:hello@oddlympics.app` per `src/pages/index.astro:192` — same pattern.

### CSS shell scope

- **D-07:** Trimmed `<style is:global>` per page — copy ONLY: `:root` token block, global `* { box-sizing }` reset, `html`/`body` base typography, `.wrap` container (with the same `--max: 720px`), `.site-footer` rule set, typography rules (`h1`, `h2`, `p`, `ul`, `li`, `strong`, `a`), and the `@media (prefers-reduced-motion)` block. Drop everything form-, banner-, FAQ-, and signup-grid-specific. Target ~80–120 lines per page. Layout.astro extraction stays deferred to v1.1 per CLAUDE.md.

- **D-08:** Inherit landing values exactly — same 520px mobile breakpoint, same h1/h2 type scale, same color tokens. Do NOT tune a "prose feel" variant. Visual consistency across landing ↔ privacy ↔ terms matters more than a marginally better measure for short legal copy.

### Claude's Discretion

The planner and executor decide all of the following (no user-visible impact):
- Whether `LAST_UPDATED` is stored as an ISO string + formatter helper or as the pre-formatted display string. Either is fine; pick whatever reads cleanest in frontmatter.
- Heading levels inside the body — the copy doc uses `**What we collect:**` bold-label headings; rendering those as `<h2>` vs `<strong>` is up to the planner (h2 is more semantic for sectioning; strong is closer to the doc's visual rhythm). Pick one and apply consistently across both pages.
- Whether the privacy page's "What we collect / What we don't / What we never do" list groups are `<h2>` + `<ul>` (semantic) or `<dl>` (slightly more correct for term/definition shape). `<h2>` + `<ul>` is the safe default.
- Whether to add a `<noscript>` block — almost certainly no (pages have no JS at all), but pure-content pages don't need one.
- Exact wording of the post-extraction `references/privacy.md` and `references/terms.md` beyond the gap-fill (D-02). Stick close to the copy-doc source; minor punctuation/whitespace normalization is fine but no rewrites.
- Whether `privacy.astro` and `terms.astro` share a sibling utility file for `formatDate()` / etc. — almost certainly not (each page is small enough that duplication is cleaner than a one-helper lib file).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 copy source of truth
- `references/oddlympics_landing_copy.md` §"/privacy stub" (lines 125–155) and §"/terms stub" (lines 159–173) — original canonical text. The pre-plan docs sweep (D-02) extracts these into the standalone files below.
- `references/privacy.md` — extracted at docs-sweep time, gap-filled (ESP → "Resend"). Source-of-truth for `src/pages/privacy.astro` body copy. Editorial reference, not a build-time import.
- `references/terms.md` — extracted at docs-sweep time. Source-of-truth for `src/pages/terms.astro` body copy. Editorial reference, not a build-time import.

### Requirements & scope
- `.planning/REQUIREMENTS.md` §"Legal pages" — LEGAL-01 (privacy disclosures: collected data, retention, no third-party tracking, Plausible cookie-free, GDPR/CCPA path, ESP named) and LEGAL-02 (terms: free through 2026-07-19, best-effort, no FIFA/ESPN/team affiliation, no fake emails, Michigan governing law, hello@oddlympics.app contact).
- `.planning/REQUIREMENTS.md` §"Acceptance criteria" — AC5 (200 on both routes with canonical copy + last-updated date) and AC7 (LAND-02 prohibited terms grep, verified in Phase 11).
- `.planning/ROADMAP.md` §"Phase 7: Legal pages" — goal, depends-on (Phase 6 site shell), 4 Success Criteria, the explicit "Canonical copy lives at references/privacy.md and references/terms.md" note.

### Project context
- `.planning/PROJECT.md` §"Current Milestone" — v2.0 consumer pivot; LAND-02 prohibited-terms guardrail applies to legal pages too.
- `CLAUDE.md` §"Architecture worth understanding before editing" — `prerender = true` pattern, inline `<style is:global>` per page (Layout.astro deferred to v1.1).
- `CLAUDE.md` §"Conventions established" — "Paste the same head pattern as a copy from index.astro" for any new page until Layout extraction happens.

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript — strict mode, `node:` prefix on built-ins, return-type annotations on exports.
- `.planning/codebase/CONVENTIONS.md` §"Astro patterns" — `export const prerender = true;` for static pages.
- `.planning/codebase/CONVENTIONS.md` §CSS — inline `<style is:global>` per page; CSS variables in `:root`.
- `src/pages/index.astro:186-196` — canonical site footer markup (Manage / Privacy / Terms / Contact + © line). Phase 7 pastes this verbatim.
- `src/pages/index.astro:252-290` — `:root` token block + html/body base + `.wrap` container that Phase 7 trims from.
- `src/pages/index.astro:564-600` — `.site-footer` rule set. Phase 7 pastes verbatim.

### Phase 6 precedent (site shell this builds on)
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions D-01 (docs sweep precedent) and D-02 (`references/*.md` as canonical source, hand-translate to .astro pattern).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Consumer site footer** (`src/pages/index.astro:186-196`) — exact markup for Manage / Privacy / Terms / Contact + © line. Paste verbatim into both legal pages.
- **`:root` token block** (`src/pages/index.astro:252-267`) — full color/typography token set. Paste verbatim.
- **`.site-footer` CSS** (`src/pages/index.astro:564-600`) — full rule set including focus-visible state and brightness hover. Paste verbatim.
- **`.wrap` container + base typography** (`src/pages/index.astro:269-290`) — `--max: 720px`, font-family, antialiasing. Paste verbatim.

### Established Patterns
- **Static page pattern** — `export const prerender = true;` in frontmatter; no API surface; no inline `<script>`. Confirmed safe path: `confirmed.astro`, `pending.astro`, `unsubscribed.astro` all follow this shape.
- **Inline `<style is:global>` per page** — CLAUDE.md §Conventions. Phase 7 stays in this pattern.
- **`mailto:` link pattern** — footer `Contact` link at `src/pages/index.astro:192` is `<a href="mailto:hello@oddlympics.app">Contact</a>`. Phase 7 reuses inside body copy with `<code>` wrap (D-06).

### Integration Points
- New routes `/privacy` and `/terms` are linked from the site footer in `index.astro:190-191` (already shipped in Phase 6). Phase 7 just creates the targets; no footer changes needed.
- `manage.astro` and `schedule.astro` will eventually carry the same footer (`/manage` redesign is Phase 9); the legal pages do NOT need to update those today.
- LAND-02 grep (Phase 11 AC7) — `curl https://oddlympics.app/privacy | grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics'` must return 0 matches. Phase 7's only obligation is to keep those strings out of the served HTML on both pages.

</code_context>

<specifics>
## Specific Ideas

- Privacy page `<h1>` text: `Privacy Policy`.
- Terms page `<h1>` text: `Terms`.
- "Last updated" line renders directly under the h1 (e.g., `Last updated: May 13, 2026`), `var(--fg-dim)` color, smaller than body.
- Privacy ESP line, post gap-fill: `Email delivery is handled by Resend. Their privacy policy also applies to message delivery.` (Drops the bracketed placeholder list.)
- Terms governing-law line stays verbatim: `Governed by the laws of Michigan, USA.`
- Free-service date in terms stays verbatim: `Your World Cup subscription will remain free through July 19, 2026.`
- Contact line at the end of both pages: `Questions: <a href="mailto:hello@oddlympics.app"><code>hello@oddlympics.app</code></a>`.
- Privacy-only GDPR/CCPA line: `Email <a href="mailto:privacy@oddlympics.app"><code>privacy@oddlympics.app</code></a> to request full deletion of your data. Requests honored within 30 days.`
- Both pages: no banner pill, no form, no JS, no Plausible event firing (analytics scoped to landing's `Signup Submit` only per ANLTC-01).

</specifics>

<deferred>
## Deferred Ideas

- **Shared `Layout.astro` extraction** — CLAUDE.md trigger long since fired (8 pages once Phase 7 ships). Phase 7 deliberately pastes the same head pattern (trimmed). Deferred to v1.1.
- **Build-time markdown rendering** — Astro Content Collections / remark transform considered; rejected for D-01 reasons (overhead vs ~350 total words). Revisit when there are >5 content-style pages or when copy is contributed by non-engineers.
- **Git-commit-date injection for "Last updated"** — considered; rejected for D-03 reasons (spurious updates on cosmetic deploys). Revisit only if there's a real legal-doc audit need that requires automatic recency.
- **Top header / wordmark back-link bar** — considered; rejected for D-05 reasons (footer-only consistency). Revisit if paid-ad reviewer feedback specifically calls out dead-end feel.
- **Prose-tuned measure (640px or narrower)** — considered; rejected for D-08 reasons (visual consistency outweighs marginal readability gain on short copy).
- **Live link to Resend's privacy policy** — copy says "Their privacy policy also applies" but does not link to it. Adding a link would be friendlier UX but adds an external dependency surface (Resend may rename or move their policy page). Out of scope; revisit only if a real legal review requests it.
- **Cookie banner** — not needed: Plausible is cookie-free, no third-party trackers, no cookies set by `/privacy` or `/terms`. The privacy copy itself states this. No banner required under GDPR for a cookie-free site.

</deferred>

---

*Phase: 7-Legal pages*
*Context gathered: 2026-05-13*
