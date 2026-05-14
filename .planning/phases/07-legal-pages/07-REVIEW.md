---
phase: 07-legal-pages
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/pages/privacy.astro
  - src/pages/terms.astro
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (no blockers; 2 warnings, 3 info)

## Summary

Two new prerendered Astro pages — `src/pages/privacy.astro` and `src/pages/terms.astro` — render canonical legal copy from `references/{privacy,terms}.md` on the same v2.0 consumer site shell as `index.astro`. The pages are pure-content, no JS, no form, no server-side data flow. As a result, the security threat surface is minimal: there is no user input, no token handling, no DB write, no cookie. The STRIDE register in `07-01-PLAN.md` / `07-02-PLAN.md` covers the real risks (copy tampering, LAND-02 leak, footer drift, stale dates) and the implementation mitigates each one.

Verification evidence collected during review:

- **LAND-02 source grep:** `grep -ciE 'bitcoin|lightning|crypto|world domination|personal olympics' src/pages/{privacy,terms}.astro` → `0` / `0` (PASS).
- **LAND-02 built-HTML grep:** same regex on `dist/client/{privacy,terms}/index.html` (produced by the Phase 7 build that is already on disk) → `0` / `0` (PASS).
- **Shell parity (footer):** `diff` of `index.astro:186-196` against `privacy.astro:63-73` and `terms.astro:40-50` is **empty** — both footers are byte-identical to the canonical source, including the four nav targets and the U+00B7 middle-dot separators in the © line.
- **Shell parity (:root + base + .wrap):** `diff` of `index.astro:252-290` against the same span in each legal page is empty except for one trailing blank line on the index side (cosmetic; outside the pasted block). Tokens (`--max: 720px`, `--accent: #d94a1f`, `--pad-x: clamp(20px, 5vw, 48px)`, etc.) match exactly.
- **No script blocks, no OG/Twitter meta tags:** `grep -nE 'twitter:|og:|<script' src/pages/{privacy,terms}.astro` → no hits (PASS — ANLTC-01 scope honored).
- **Non-ASCII byte audit:** only `—` (U+2014), `©` (U+00A9), and `·` (U+00B7) appear; no smart quotes; ASCII apostrophes (0x27) throughout body copy as required.
- **All plan ACs satisfied** in the source: `Resend`, `Plausible`, `cookie-free`, `privacy@oddlympics.app`, `hello@oddlympics.app`, `30 days`, `Last updated`, `Michigan`, `July 19, 2026`, `best-effort`, `fake or other`, `FIFA`, `not affiliated`, `Independent project`, `--max: 720px` all present.

No bugs, security defects, or blockers were found. The findings below are quality observations.

## Warnings

### WR-01: Heading hierarchy inconsistency between `privacy.astro` and `terms.astro`

**File:** `src/pages/terms.astro:22-33`, `src/pages/privacy.astro:22-58`
**Issue:** `privacy.astro` renders five `<h2>` section headings (`What we collect`, `What we don't collect`, `What we never do`, `Your rights`, `Email delivery is handled by`). `terms.astro` renders zero `<h2>` — it goes `<h1>Terms</h1>` → `<ol>` with `<strong>` inline labels. The plan acknowledges this divergence (`07-02-PLAN.md:138`: "if plan 01 uses `<h2>` for the privacy section headings, this plan's bold lead-ins inside the numbered list stay as `<strong>` … they are inline labels inside an `<li>`, not section breaks. No `<h2>` is needed inside `<ol>` items."), so this is by design. However, it leaks into the CSS shell as a defect: `privacy.astro` declares an `h2` rule (lines 137-143) and `terms.astro` does NOT declare an `h2` rule (the plan called this out as "h2 rule is OPTIONAL"). Yet `terms.astro` STILL inherits the global `h1` declaration (line 104) just fine, and its `<h1>` font-family is set to `var(--font-sans)`, which is correct. No bug ships from this — `terms.astro` has nothing to break — but the cross-page CSS asymmetry is exactly the kind of drift that the Pattern 5 trim aimed to avoid. If a later edit adds an `<h2>` to terms.astro (e.g., a new "Refunds" section), it will fall back to the UA default 1.5em margin/24px font-size, NOT the privacy page's 17px / `margin: 32px 0 12px`. This is a real maintainability hazard that won't surface until somebody breaks it.
**Fix:** Either (a) paste the same `h2` rule from `privacy.astro:137-143` into `terms.astro` (3 lines of CSS, zero rendered cost since no `<h2>` exists on the page today), or (b) add a single-line comment in `terms.astro`'s style block explaining that `<h2>` is intentionally omitted so future editors don't add one without also adding the rule.

```css
/* In src/pages/terms.astro, after the h1 rule (~line 113): */
h2 {
  margin: 32px 0 12px;
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  color: var(--fg);
}
```

### WR-02: `LAST_UPDATED` in `.astro` and `**Last updated:**` in `references/*.md` are out of sync

**File:** `src/pages/privacy.astro:6`, `src/pages/terms.astro:6`, `references/privacy.md:3`, `references/terms.md:3`
**Issue:** Both `privacy.astro` and `terms.astro` set `LAST_UPDATED = 'May 13, 2026'`. The canonical source-of-truth files set `**Last updated: May 12, 2026**` (privacy.md line 3, terms.md line 3). D-01 in `07-CONTEXT.md` makes the `references/*.md` files the canonical editorial source; D-03 makes the `.astro` `LAST_UPDATED` the date that ships. So the dates are *expected* to drift apart by the time the docs sweep commit lands before the .astro creation commit — and they did, by one day. The risk is that future maintainers reading `references/privacy.md` will assume the policy was last edited on May 12, and the LEGAL-01 truth row "Last-updated date matching the deploy date" stops being recheckable from the canonical doc alone. Today the discrepancy is one day and harmless; over a year of cosmetic deploys with no copy changes (per D-03's "bumped manually only when the legal content changes") the dates can diverge by months, and any LEGAL audit will need to reconcile two sources.
**Fix:** Either (a) bump both `references/privacy.md` and `references/terms.md` to `May 13, 2026` (matches the shipping date and re-aligns canonical with rendered — one-line edit each), or (b) add a comment in each `.astro` frontmatter pointing at the canonical doc and explaining the asymmetry:

```astro
// Bumped per D-03 when legal content changes; references/privacy.md
// shows the date the canonical text was last edited.
const LAST_UPDATED = 'May 13, 2026';
```

Option (a) is preferred — it eliminates the drift entirely instead of documenting it.

## Info

### IN-01: `:root` block carries four unused CSS custom properties

**File:** `src/pages/privacy.astro:78-92`, `src/pages/terms.astro:55-69`
**Issue:** `--line-strong: #c9cbc4`, `--surface: #ffffff`, `--accent-ink: #ffffff`, and `--accent-soft: #fbe9e0` are declared in the `:root` block of both files but never referenced in their own CSS (they are used in `index.astro`'s hero/form CSS, which is intentionally not copied per Pattern 5i). Each unused custom property adds ~30 bytes to the inline CSS payload of every served page. This is **intentional** per Decision D-07 ("Trimmed `<style is:global>` per page — copy ONLY: `:root` token block …") — verbatim paste of the token block is the agreed-upon shell-parity contract so Layout.astro extraction (deferred to v1.1) is a mechanical move. Not a defect; logging for retention.
**Fix:** No action. When Layout.astro lands in v1.1, the token block consolidates into one file and the unused-on-some-pages issue disappears for free.

### IN-02: CSS duplicated across `privacy.astro` and `terms.astro` (~140 lines each, ~85% overlap)

**File:** `src/pages/privacy.astro:77-217`, `src/pages/terms.astro:54-186`
**Issue:** The `<style is:global>` blocks in the two new pages are ~140 lines each, of which the `:root` token block, the `*`/`html,body` baseline, `.wrap`, `.content`, `.last-updated`, `.site-footer` rule set, and the `@media (max-width: 520px)` mobile breakpoint are byte-for-byte identical. Privacy has `ul`/`li`/`h2` rules that terms lacks; terms has `ol`/`li` rules that privacy lacks; the rest is duplication. This is by design per `CLAUDE.md` Conventions ("Astro CSS lives inline per page … the refactor itself is deferred to v1.1") and explicitly called out in `07-CONTEXT.md` Deferred section. Both pages will need to be re-edited in lockstep if any shell token (e.g., `--accent` repaint) changes before Layout.astro lands. Not a defect; logging for retention.
**Fix:** No action in this phase. v1.1 Layout.astro extraction collapses both blocks into one shared file. Until then, any token change must be made in all 8 pages (index, pending, confirmed, unsubscribed, manage, schedule, privacy, terms) — Phase 7 ships with 2 more sites of duplication, but it's the documented project convention.

### IN-03: Built-HTML descriptions are long but within reasonable head-tag limits

**File:** `src/pages/terms.astro:5`
**Issue:** `DESCRIPTION` is 153 characters (`'Terms of use for Oddlympics: free service through July 19, 2026, best-effort delivery, no FIFA or team affiliation, Michigan (USA) governing law.'`). Google search-snippet truncation typically kicks in around 155-160 chars (mobile) or 130 (desktop). At 153 chars this is right at the edge — likely fine, but the trailing "Michigan (USA) governing law." clause is the part most at risk of being clipped in result listings. `privacy.astro:5` is 110 chars, comfortably inside. Not a defect; legal pages aren't ranked content so search snippet quality is low-stakes.
**Fix:** No action required. If you want a safety margin, shorten `terms.astro:5` to e.g. `'Terms of use for Oddlympics: free through July 19, 2026, best-effort delivery, no FIFA affiliation, Michigan (USA) law.'` (118 chars).

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
