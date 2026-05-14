# Phase 7: Legal pages — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 2 new pages (`src/pages/privacy.astro`, `src/pages/terms.astro`)
**Analogs found:** 2 / 2 (both exact role match — same prerendered-page shell as Phase 6 landing)

## Scope of this phase

Phase 7 ships **two pure-content prerendered pages** that copy the Phase 6 landing site shell (footer + `.wrap` container + `:root` token block + base typography), strip every form/banner/FAQ/signup-grid-specific rule, and substitute hand-translated body copy from `references/privacy.md` / `references/terms.md`.

**No new patterns are introduced.** Every line of CSS, every meta tag pattern, every footer attribute pulls from `src/pages/index.astro` verbatim. The only genuinely new content is body markup wrapping the canonical legal copy — no in-codebase analog exists for that, but it's plain HTML (`<h1>`, `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<a>`) requiring zero pattern guidance beyond CONTEXT D-07 / D-08.

**Pre-plan docs sweep** (already complete, commit `08c4d4a`):
- `references/privacy.md` — extracted from `references/oddlympics_landing_copy.md` §"/privacy stub", ESP gap-fill applied (`[Your ESP — …]` → `Resend`).
- `references/terms.md` — extracted from `references/oddlympics_landing_copy.md` §"/terms stub".
- These are **inputs to planning, NOT Phase 7 plan tasks** per CONTEXT D-02. Plans only translate them into `.astro` body markup.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/pages/privacy.astro` | page (Astro prerendered static page; pure content) | request-response (browser GET; no form, no JS, no URL-param swap) | `src/pages/index.astro` (Phase 6, post-rewrite) | exact (same role, same data flow minus the form + inline scripts) |
| `src/pages/terms.astro` | page (Astro prerendered static page; pure content) | request-response (browser GET; no form, no JS, no URL-param swap) | `src/pages/index.astro` (Phase 6, post-rewrite) | exact (same role, same data flow minus the form + inline scripts) |

**Why `index.astro` is the only analog:** A grep for the Phase 6 shell markers (`--font-sans`, `site-footer`) across `src/pages/*.astro` returns only `index.astro`. The other prerendered pages (`pending.astro`, `confirmed.astro`, `unsubscribed.astro`) still use the v1 dark-mono shell — they are NOT acceptable analogs for Phase 7, which must match the v2.0 consumer landing visually (CONTEXT §domain, §D-08).

**Secondary reference (NOT a code analog, copy source only):**
- `references/privacy.md` — full canonical body for `privacy.astro` (~200 words).
- `references/terms.md` — full canonical body for `terms.astro` (~150 words).

---

## Pattern Assignments

Both new pages share the same shell-derivation patterns. Each pattern below applies to BOTH `privacy.astro` AND `terms.astro` unless explicitly scoped to one.

### `src/pages/privacy.astro` and `src/pages/terms.astro` (page, request-response)

**Analog:** `src/pages/index.astro` (lines cited below from the post-Phase-6 file at `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/pages/index.astro`).

#### Pattern 1 — Frontmatter + `prerender = true`

**Source:** `src/pages/index.astro:1-40` (full frontmatter block).

Phase 7 trims this radically — no JSON imports, no confederation grouping, no OG image, no Twitter card. Just the title/description/last-updated triplet.

```astro
---
export const prerender = true;

const TITLE = 'Privacy Policy — Oddlympics';
const DESCRIPTION = 'How Oddlympics handles your data: what we collect, what we don\'t, and your GDPR/CCPA rights.';
const LAST_UPDATED = 'May 13, 2026';
---
```

**MUST preserve from analog:**
- `export const prerender = true;` (CLAUDE.md §"Architecture worth understanding" — CDN-cacheable; same pattern as `pending.astro`, `confirmed.astro`, `unsubscribed.astro`).
- Hoisted const naming convention (`SCREAMING_SNAKE_CASE` for module constants, per CONVENTIONS.md §Naming and `index.astro:6-15`).

**Per-page deltas:**
- `privacy.astro`: `TITLE = 'Privacy Policy — Oddlympics'`, `DESCRIPTION` describes the privacy disclosures.
- `terms.astro`: `TITLE = 'Terms — Oddlympics'`, `DESCRIPTION` describes the terms.

**`LAST_UPDATED` format (CONTEXT D-03 / D-04):** Hardcoded long-form US string (`'May 13, 2026'`) is simplest. Storing as ISO + a `formatDate()` helper is allowed but adds no benefit at this scale — single source per page either way. Bumped manually only when *content* changes, not on cosmetic deploys.

**MUST NOT include from analog:**
- `import { TEAMS } from '../lib/teams';` (no team data needed).
- `CONFEDERATION_ORDER`, `CONFEDERATION_LABEL`, `groupedTeams` (no select).
- `OG_TITLE`, `OG_DESCRIPTION`, `TWITTER_DESCRIPTION`, `SITE_URL`, `OG_IMAGE`, `OG_IMAGE_ALT` consts — legal pages don't need OG cards (CONTEXT §domain — paid-ad reviewers land directly, not via social shares).

#### Pattern 2 — `<head>` shell (minimal)

**Source:** `src/pages/index.astro:44-69` (full `<head>`).

Phase 7 strips the OG/Twitter card tags and the Plausible analytics script. Result:

```astro
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
```

**MUST preserve from analog (lines 42-48, 62):**
- `<!doctype html>` + `<html lang="en">` shell (LAND-03 SEO; matches Phase 6).
- `<meta charset="utf-8" />` + `<meta name="viewport" content="width=device-width, initial-scale=1" />` (Lighthouse baseline).
- `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` — same favicon path.
- `<title>{TITLE}</title>` and `<meta name="description" content={DESCRIPTION} />` — same template-interpolation pattern.

**MUST NOT include from analog:**
- Lines 49-61 — every `og:*` and `twitter:*` meta tag (CONTEXT §specifics: no banner, no form, no analytics).
- Lines 63-68 — Plausible `<script async src=…>` and the `plausible.init()` shim. Legal pages have **no JS at all** (CONTEXT D §specifics). ANLTC-01 scopes analytics to landing's `Signup Submit` only; firing analytics on legal pages would muddy that event surface and contradict the privacy copy itself.

**LAND-02 grep gate:** The served HTML for both pages MUST return 0 matches for `bitcoin|lightning|crypto|world domination|personal olympics` (case-insensitive). The Plausible script URL contains `pa-wRAab3seDWDDBnGbRbe0K.js` — safe. The favicon URL contains nothing prohibited. No `og:image` URL is rendered, so no risk there either.

#### Pattern 3 — `<body>` structure (content only, no form)

**Source structure (skeletal):** `src/pages/index.astro:70-196` (full body — `<main>` → `<section class="hero">` → footer).

Phase 7's body is dramatically simpler — one content `<section>` (no banner pill, no headline-and-form pairing, no below-fold sections, no FAQ) plus the footer. Skeleton:

```astro
<body>
  <main>
    <section class="content">
      <div class="wrap">
        <h1>Privacy Policy</h1>
        <p class="last-updated">Last updated: {LAST_UPDATED}</p>

        <!-- Body copy from references/privacy.md, translated to HTML -->
        <h2>What we collect</h2>
        <ul>
          <li>Your email address (so we can send you alerts)</li>
          <li>The team(s) you select</li>
          <li>Your time zone (detected from your browser, used only to calculate match times)</li>
          <li>Standard server logs (IP, user agent) retained for 30 days for abuse prevention</li>
        </ul>

        <!-- … remaining sections from references/privacy.md … -->

        <p>Email delivery is handled by Resend. Their privacy policy also applies to message delivery.</p>
        <p>Email <a href="mailto:privacy@oddlympics.app"><code>privacy@oddlympics.app</code></a> to request full deletion of your data. Requests honored within 30 days.</p>
        <p>Questions: <a href="mailto:hello@oddlympics.app"><code>hello@oddlympics.app</code></a></p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <!-- Pattern 4 below — verbatim from index.astro:186-196 -->
  </footer>
</body>
```

**MUST preserve from analog:**
- `<main>` wrapping the content (semantic; matches `index.astro:71`).
- `<section>` → `<div class="wrap">` nesting (matches `index.astro:72-73`, `123-124`, `143-144`, etc.). The `.wrap` rule (Pattern 5 below) is what enforces the 720px content container.
- Footer placement *outside* `<main>` (matches `index.astro:186` — `<footer>` is a sibling of `<main>`, not nested).

**MUST change from analog:**
- Class on `<section>`: use `class="content"` (or similar single-purpose name) — NOT `class="hero"` or `class="below"`. The hero/below CSS rules are explicitly NOT copied (Pattern 5 below).
- First DOM element inside `.wrap` is `<h1>` directly (CONTEXT D-05: footer-only nav, no header bar, no wordmark, page starts with the heading).
- Body markup is hand-translated from `references/privacy.md` / `references/terms.md`. Drop the leading `# Privacy Policy — Oddlympics` line (becomes the `<h1>`), drop the `**Last updated: …**` line (becomes the `<p class="last-updated">`), translate each `**Bold heading:**` followed by a bullet list into either `<h2>` + `<ul>` (recommended, more semantic — CONTEXT discretion) or `<strong>` + `<ul>`. **Pick one pattern and apply consistently across both pages** (CONTEXT discretion bullet 2).
- Email addresses render per CONTEXT D-06 as `<a href="mailto:…"><code>…</code></a>` — see Pattern 7 below.

**MUST NOT include from analog:**
- Lines 74-119 (the banner pill, `<h1 class="headline">`, `<p class="subhead">`, `<form id="signup-form">`, hidden inputs, honeypot, submit button, fineprint, error, trust line).
- Lines 121-183 (all 4 below-fold sections + the FAQ `<details>` accordions).
- Lines 198-248 (all 3 inline `<script is:inline>` blocks — tz-label, error swap, Plausible submit listener). Legal pages have no `?error=` to swap, no tz to display, no submit event to track.

#### Pattern 4 — Site footer (paste verbatim)

**Source:** `src/pages/index.astro:186-196`.

```astro
<footer class="site-footer">
  <div class="wrap">
    <nav class="links">
      <a href="/manage">Manage subscription</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="mailto:hello@oddlympics.app">Contact</a>
    </nav>
    <p class="copy">© 2026 Oddlympics · Independent project · Not affiliated with FIFA</p>
  </div>
</footer>
```

**MUST preserve VERBATIM from analog (CONTEXT §code_context: "Paste verbatim"):**
- Every attribute, every element, every link target, every label.
- The mailto `Contact` link uses `hello@oddlympics.app` (matches CONTEXT D-06 — Contact in the footer is sibling to the privacy/terms inline contact pattern).
- The © line text exactly: `© 2026 Oddlympics · Independent project · Not affiliated with FIFA`. Note the middle-dot separators (` · `, U+00B7), not hyphens.

**Sanity check:** The footer is the only navigation surface on Phase 7 pages (CONTEXT D-05). It links back to `/manage`, sideways to `/privacy` ↔ `/terms`, and to `mailto:`. No top header, no wordmark bar, no back-link — explicitly rejected in D-05.

**Self-link cosmetics:** `privacy.astro`'s footer will link to `/privacy` (itself); `terms.astro`'s footer will link to `/terms` (itself). This is fine — matches `index.astro`'s behavior (no special "current page" treatment). Don't add `aria-current="page"` unless future a11y work calls for it (out of scope this phase).

#### Pattern 5 — `<style is:global>` block (trim of `index.astro:252-607`)

**Source (full block):** `src/pages/index.astro:252-607`. Phase 7 copies **only** specific selectors and drops the rest. Target ~80–120 lines per page per CONTEXT D-07.

##### 5a. `:root` token block — paste VERBATIM

**Source:** `src/pages/index.astro:253-267`.

```css
:root {
  --bg: #fafaf7;
  --fg: #14151a;
  --fg-dim: #5a5d68;
  --line: #e4e4dd;
  --line-strong: #c9cbc4;
  --surface: #ffffff;
  --accent: #d94a1f;
  --accent-ink: #ffffff;
  --accent-soft: #fbe9e0;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --max: 720px;
  --pad-x: clamp(20px, 5vw, 48px);
}
```

**MUST preserve VERBATIM:** Every token, every value, every name. CONTEXT D-08 explicitly bans tuning a "prose feel" variant — visual consistency with landing trumps a marginally better measure for short legal copy.

**Trim allowance:** `--line-strong` and `--accent-soft` are technically only used by form-card CSS that Phase 7 drops. Leave them in the token block anyway — they're cheap, removing them creates drift between pages, and Layout.astro extraction (v1.1) will normalize this.

##### 5b. Box-sizing reset + html/body baseline — paste VERBATIM

**Source:** `src/pages/index.astro:269-282`.

```css
* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body { min-height: 100dvh; }
```

**MUST preserve VERBATIM:** Same base typography (15px / 1.55 / sans-serif), same antialiasing, same `100dvh` body height.

##### 5c. `.wrap` container — paste VERBATIM

**Source:** `src/pages/index.astro:284-289`.

```css
.wrap {
  max-width: var(--max);
  margin: 0 auto;
  padding-left: var(--pad-x);
  padding-right: var(--pad-x);
}
```

**MUST preserve VERBATIM:** The `--max: 720px` content container is the visual-consistency contract (CONTEXT §domain — "same `--max: 720px` content container").

##### 5d. Content-section padding — add NEW (small, derived from `.hero` rhythm)

The analog `.hero` rule (`index.astro:292-295`) is `padding-top: 64px; padding-bottom: 32px;`. Phase 7's content section has no hero, but needs comparable top/bottom breathing room. Add a single new rule:

```css
.content {
  padding-top: 64px;
  padding-bottom: 32px;
}

.last-updated {
  margin: 0 0 24px;
  font-size: 13px;
  color: var(--fg-dim);
}
```

The `.last-updated` style mirrors the analog's `.fineprint` rule (`index.astro:411-415`) and `.trust` rule (`index.astro:426-430`) — both 13px / `--fg-dim`. Per CONTEXT specifics: "renders directly under the h1 ... `var(--fg-dim)` color, smaller than body."

##### 5e. Body typography (h1, h2, p, ul, li, strong, a) — derive minimal rules

The analog has these scattered across `.headline` (line 312), `.eyebrow` (448), `section.below p` (458), `section.below a` (469). Phase 7 needs unscoped versions because the legal content section isn't `.hero` or `.below`. Recommended new block (still under the same `<style is:global>`):

```css
h1 {
  margin: 0 0 8px;
  font-family: var(--font-sans);
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--fg);
}

h2 {
  margin: 32px 0 12px;
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  color: var(--fg);
}

p {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--fg);
}

ul {
  margin: 0 0 16px;
  padding-left: 20px;
}

li {
  margin-bottom: 6px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--fg);
}

strong { font-weight: 700; }

a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

a:hover { filter: brightness(0.92); }

code {
  font-family: var(--font-mono);
  font-size: 0.95em;
}
```

**Match rationale per CONTEXT D-08 ("Inherit landing values exactly"):**
- `h1`: copies the analog's `.headline` (`index.astro:312-320`) — same `clamp(28px, 5vw, 40px)`, same weight, same line-height, same letter-spacing.
- `h2`: 17px / 700 matches the analog's `.subhead` size (line 322-328) for hierarchical contrast; or 13px uppercase like `.eyebrow` (line 448-456) if planner prefers tighter visual hierarchy — CONTEXT D-08 discretion allows either, **pick one and apply consistently across both pages**.
- `p`: copies `section.below p` (line 458-463) — 15px / 1.55 / `--fg`.
- `a`: copies `section.below a` + `:hover` (line 469-475) — `var(--accent)` underlined, `filter: brightness(0.92)` on hover.
- `code`: NEW (analog has no inline `<code>` use). `var(--font-mono)` for the email-address pattern per CONTEXT D-06.

**Heading-level discretion (CONTEXT discretion bullet 2):** The copy doc uses `**Bold:**` for section breaks. Render those as `<h2>` (more semantic, recommended) OR as inline `<strong>` paragraphs (closer to the doc's visual rhythm). **Decide once, apply to both pages.** If you choose `<strong>`, the `h2` CSS rule above can be dropped.

##### 5f. `.site-footer` rule set — paste VERBATIM

**Source:** `src/pages/index.astro:564-595`.

```css
.site-footer {
  border-top: 1px solid var(--line);
  padding: 32px 0 64px;
}

.site-footer .links {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.site-footer a {
  font-size: 13px;
  color: var(--fg-dim);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.site-footer a:hover { filter: brightness(0.92); }

.site-footer a:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(217, 74, 31, 0.15);
  border-radius: 4px;
}

.site-footer .copy {
  margin: 16px 0 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--fg-dim);
}
```

**MUST preserve VERBATIM:** Every selector, every value. Note `.site-footer .copy` uses `var(--font-mono)` — the only place mono appears in Phase 7 (plus inline `<code>` blocks for emails per D-06). This matches the landing's micro-accent scoping for mono (UI-SPEC §Typography).

##### 5g. Mobile breakpoint — paste (trimmed)

**Source:** `src/pages/index.astro:598-600`.

The analog rule targets `.hero` specifically (`@media (max-width: 520px) { .hero { padding-top: 36px; } }`). Phase 7 substitutes `.content`:

```css
@media (max-width: 520px) {
  .content { padding-top: 36px; }
}
```

**Why:** CONTEXT §domain locks the 520px breakpoint and the same padding contraction; only the selector changes because the section class is `.content` not `.hero`.

##### 5h. Reduced-motion block — paste (trimmed)

**Source:** `src/pages/index.astro:603-606`.

Analog targets `details summary::after` transition + button transform — neither exists in Phase 7. The block becomes either empty (drop entirely) OR a single rule that's still applicable. Recommended: **drop the block** since neither selector exists.

If the planner wants to preserve the convention's presence (forward-compat for future hover states), it can stay as:

```css
@media (prefers-reduced-motion: reduce) {
  /* no animated elements on legal pages — placeholder preserved for shell consistency */
}
```

Either is fine; an empty placeholder block is harmless and signals shell-fidelity to a future reader. CONTEXT D-07 doesn't mandate keeping it.

##### 5i. Selectors to EXPLICITLY drop (do NOT copy)

These analog selectors target DOM that Phase 7 doesn't render — copying them would inflate the file and create dead CSS:

- Lines 291-310: `.hero`, `.banner` (pill)
- Lines 312-320: `.headline` (now `h1` instead, see 5e)
- Lines 322-328: `.subhead`
- Lines 330-440: `.form-card`, `.field`, `.field label`, all input/select selectors, focus-visible variants, `.cta`, `button[type="submit"]` + state variants, `.fineprint`, `.error`, `.trust`, `.hp` (honeypot)
- Lines 442-475: `section.below`, `.eyebrow`, `section.below p`, `section.below p.muted`, `section.below a` + hover — replaced by the unscoped `p`/`a` rules in 5e
- Lines 477-513: `.steps`, `.steps li`, `.steps .num`, `.steps .body`
- Lines 515-561: All `details`, `summary`, `details[open]`, `::after`, `::-webkit-details-marker`, `details p` rules

**Pre-merge size check:** Final `<style is:global>` block should land at ~80–120 lines (CONTEXT D-07). If it's >150, audit for stray copies; if it's <60, audit for missing typography rules.

#### Pattern 6 — No inline `<script>` blocks anywhere

**Source contrast:** `src/pages/index.astro:198-248` (three inline script blocks for tz-label, error swap, Plausible submit). Phase 7 has **none** (CONTEXT §specifics: "no JS").

**MUST NOT include:**
- No `<script async src="…/pa-*.js">` and no Plausible global-shim block (despite Pattern S4 from Phase 6's PATTERNS.md). Legal pages stay analytics-silent per ANLTC-01.
- No `?error=` URL-param COPY map (no errors to surface).
- No tz-label swap (no `#tz-label` element).

**Sanity:** This is by far the simplest static-page shape in the project — closer to a typical CMS page than to the other consumer pages, which all have at least the Plausible shim. Don't reach for an inline-script pattern out of habit.

#### Pattern 7 — `mailto:` link with `<code>` wrap (NEW micro-pattern, per CONTEXT D-06)

**Source partial:** `src/pages/index.astro:192` — `<a href="mailto:hello@oddlympics.app">Contact</a>` (footer use; plain text label, no `<code>`).

Phase 7 introduces the variant for inline body copy:

```html
<a href="mailto:hello@oddlympics.app"><code>hello@oddlympics.app</code></a>
<a href="mailto:privacy@oddlympics.app"><code>privacy@oddlympics.app</code></a>
```

**MUST preserve from analog convention:**
- `mailto:` scheme + plain email URI (no `?subject=…` query — see CONTEXT silence on subject lines).
- `var(--accent)` link color via the `a` rule in 5e — matches footer link styling.

**MUST add (not in analog):**
- `<code>…</code>` inner wrap. The `code` selector in 5e gives it `var(--font-mono)` + slightly smaller (`0.95em`). Per CONTEXT D-06: "Clickable from any device, monospace cue signals 'this is an actual address you can use.'"

**Page-specific use:**
- `privacy.astro`: TWO mailto links — `privacy@oddlympics.app` (data-deletion request line) AND `hello@oddlympics.app` (Questions footer line). Per CONTEXT §specifics.
- `terms.astro`: ONE mailto link — `hello@oddlympics.app` (Questions footer line). Per CONTEXT §specifics.

---

## Shared Patterns (cross-page, both privacy.astro AND terms.astro)

### Pattern S1 — `prerender = true` for cacheable static pages

**Source:** `src/pages/index.astro:4`, plus `pending.astro`, `confirmed.astro`, `unsubscribed.astro` (all confirmed via Phase 6's PATTERNS.md §S1).

**Apply to:** Both new files. MUST stay `true`. Legal pages have no per-request server-side state — making them server-rendered would be wasteful and break the CDN-caching contract that ad-network bots will benefit from on cold loads.

### Pattern S2 — `<style is:global>` inline CSS per page, no Layout.astro

**Source:** `src/pages/index.astro:252-607`, also at `pending.astro`, `confirmed.astro`, `unsubscribed.astro`, `manage.astro`, `schedule.astro` (per Phase 6 PATTERNS.md §S3).

**Apply to:** Both new files. Each page gets its own trimmed `<style is:global>` block (CONTEXT D-07). Layout.astro extraction is **explicitly deferred to v1.1** per CLAUDE.md §Conventions, despite the trigger having long since fired (8 pages once Phase 7 ships). When the extraction happens later, it'll be a single focused commit consolidating all 8 pages — NOT bundled with Phase 7 feature work.

**Anti-pattern (do NOT do this in Phase 7):** Creating `src/components/LegalLayout.astro` or `src/layouts/Layout.astro` as a "partial" extraction. Either extract everything, or extract nothing. Phase 7's job is to ship, not to refactor.

### Pattern S3 — CSS variable names (existing convention)

**Source:** `src/pages/index.astro:253-267`.

**Apply to:** Both new files. The token names (`--bg`, `--fg`, `--fg-dim`, `--line`, `--line-strong`, `--surface`, `--accent`, `--accent-ink`, `--accent-soft`, `--font-sans`, `--font-mono`, `--max`, `--pad-x`) are the project's established palette. Adding new tokens would create drift; using inline literals would lose theme-coherence with landing.

### Pattern S4 — `<a href="mailto:…">` for any email address in copy or footer

**Source:**
- Footer: `src/pages/index.astro:192` (`Contact` link → `hello@oddlympics.app`).
- Body convention (new in Phase 7 per CONTEXT D-06): `<a href="mailto:…"><code>…</code></a>` for any email address embedded in legal copy.

**Apply to:** Both new files. See Pattern 7 above for full markup.

### Pattern S5 — LAND-02 prohibited-terms grep gate (negative pattern)

**Source:** Phase 6 PATTERNS.md §"Negative Patterns" (lines 485-503) + Phase 7 CONTEXT.md §domain + §code_context.

The strings `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` (case-insensitive) **MUST NOT** appear anywhere in:
- The rendered HTML body
- Inline `<style>` content (CSS variable names, comments, content strings)
- Inline `<script>` content (Phase 7 has none, but verify nothing slips into a build artifact)
- The page `<title>` or `<meta name="description">`
- Any `href` or attribute value
- The hand-translated body markup from `references/{privacy,terms}.md` (spot-check: a `grep -i` of those files returns zero matches as of commit `08c4d4a` — confirm before merge)

**Verification (deferred to Phase 11 AC7 for prod, but Phase 7 plans MUST include a local check):**

```bash
npm run build && grep -i -E 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/privacy/index.html dist/client/terms/index.html
# expected: exit 1 (no matches)
```

Note: Astro emits prerendered output under `dist/client/<route>/index.html` for routes without trailing slashes; the exact path may vary by Astro 5 config — fall back to `find dist/client -name '*.html'` if uncertain.

### Pattern S6 — Pre-plan docs sweep precedent (informational; NOT a Phase 7 plan task)

**Source:** Phase 6 CONTEXT §D-01 ("docs sweep precedent") → applied for Phase 7 as CONTEXT §D-02.

Already complete in commit `08c4d4a docs(07): extract legal stubs to references/{privacy,terms}.md`. Plans reference these files as inputs, not as work items.

---

## No Analog Found

| File / Pattern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Body markup translating bullet-list legal sections (privacy + terms) | content markup | static | The other prerendered pages (`pending`, `confirmed`, `unsubscribed`) all use short single-paragraph copy — no project precedent for multi-section legal-doc structure. **Mitigation:** This is plain HTML (`<h1>`, `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<a>`, `<code>`) with no semantic novelty. The `references/{privacy,terms}.md` files are the verbatim source; translation rules are fully specified in CONTEXT §specifics + Pattern 3 above. Heading-level choice (`<h2>` vs `<strong>`) is left to executor discretion per CONTEXT discretion bullet 2 — pick one and apply consistently across both pages. |
| `LAST_UPDATED` constant + render pattern | frontmatter const | static | No project precedent for a date constant in a `.astro` frontmatter. Phase 7 introduces it. Format decision (ISO + formatter helper vs. pre-formatted display string) is executor discretion per CONTEXT D-04 + discretion bullet 1 — both are fine; pre-formatted string is slightly less code. |

Neither "no-analog" gap is a risk — they're both content-shaped, not architecture-shaped. The planner does not need to reach for RESEARCH.md patterns; CONTEXT + this pattern map are sufficient.

---

## Pattern Fidelity Summary (for the planner)

| Must preserve VERBATIM from `index.astro` | Must drop (don't copy) | Executor discretion |
|-------------------------------------------|------------------------|---------------------|
| `export const prerender = true;` (line 4) | Lines 2 (`TEAMS` import), 17-39 (confederation grouping) | Whether `LAST_UPDATED` is ISO + helper or pre-formatted string |
| `<!doctype html><html lang="en">` shell (lines 42-43) | Lines 49-61 (OG + Twitter meta tags) | Whether `<strong>` or `<h2>` for in-body section breaks (pick once, apply both pages) |
| `<meta charset="utf-8" />` + `<meta name="viewport">` (lines 45-46) | Lines 63-68 (Plausible script + shim) | Whether to keep `@media (prefers-reduced-motion)` as an empty placeholder block or drop entirely |
| `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` (line 62) | Lines 74-119 (banner, headline, subhead, form, honeypot, fineprint, error, trust) | Whether the `code` selector lives in the per-page style block or gets inlined — per-page block is cleaner |
| `.site-footer` markup (lines 186-196) — every byte | Lines 121-183 (4 below-fold sections + FAQ) | Whether `references/{privacy,terms}.md` is left untouched after the docs sweep, or gets minor punctuation/whitespace cleanup — minor cleanup is fine per CONTEXT discretion bullet 5; no rewrites |
| `:root` token block (lines 253-267) | Lines 198-248 (all three inline `<script>` blocks) | Whether the in-body `<section>` is named `.content`, `.legal`, `.prose`, or other — single-purpose name; not stylistically important |
| `* { box-sizing }` + html/body baseline (lines 269-282) | Lines 291-310 (`.hero`, `.banner`) | — |
| `.wrap` rule (lines 284-289) — `--max: 720px` content container | Lines 312-440 (form-card, button, fineprint, error, trust, honeypot CSS) | — |
| `.site-footer` CSS rule set (lines 564-595) | Lines 442-561 (section.below, eyebrow, steps, details/summary FAQ) | — |
| 520px mobile breakpoint mechanism (line 598) | — | — |
| `mailto:` link convention (line 192 — extended with `<code>` wrap in body per D-06) | — | — |

---

## Metadata

- **Analog search scope:** `src/pages/*.astro` (6 files), `references/*.md` (2 newly extracted + 1 source copy doc).
- **Files scanned:** 9 (6 .astro pages confirmed `index.astro` is the only Phase-6-shell match; 3 reference files).
- **Pattern extraction date:** 2026-05-13.
- **Linked artifacts:** `07-CONTEXT.md` (this phase), `06-CONTEXT.md` + `06-PATTERNS.md` (Phase 6 precedent), `src/pages/index.astro` (sole code analog), `references/privacy.md`, `references/terms.md` (canonical body copy, extracted in commit `08c4d4a`), `CLAUDE.md` (`<style is:global>` convention + Layout.astro deferral + LAND-02 grep gate).
