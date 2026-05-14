---
phase: 07-legal-pages
verified: 2026-05-14T08:35:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 07: Legal Pages Verification Report

**Phase Goal:** `/privacy` and `/terms` return 200 with canonical copy on the same site shell as the landing page, satisfying paid-ad reviewer requirements.
**Verified:** 2026-05-14T08:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | `GET /privacy` returns 200 with copy declaring: data collected (email, team, timezone, server logs), retention (logs ≤ 30 days), no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion path (`privacy@oddlympics.app`, 30 days), Resend named as ESP. Last-updated date matches deploy date. | VERIFIED | Live curl against `node ./dist/server/entry.mjs` → HTTP `200`. Built HTML `dist/client/privacy/index.html` (4239 bytes) contains: `email`, `team`, `time zone`, `server logs`, `IP`, `user agent`, `30 days` (in "Standard server logs (IP, user agent) retained for 30 days for abuse prevention"), `Plausible`, `cookie-free`, `privacy@oddlympics.app`, `GDPR`, `CCPA`, `Resend` (in "Email delivery is handled by Resend"), `May 13, 2026`. |
| 2 | `GET /terms` returns 200 with copy declaring: free service through 2026-07-19, best-effort delivery, no FIFA/ESPN/team affiliation, prohibition on submitting fake/others' emails, Michigan (USA) governing law, `hello@oddlympics.app` for questions. Last-updated date matches deploy date. | VERIFIED | Live curl against built server → HTTP `200`. Built HTML `dist/client/terms/index.html` (3786 bytes) contains: `July 19, 2026` (rendered form of 2026-07-19), `Best-effort delivery`, `FIFA`, `ESPN`, `not affiliated`, `fake or other people's email addresses`, `Michigan, USA`, `hello@oddlympics.app`, `May 13, 2026`. |
| 3 | Both pages match the landing page shell (same fonts, same consumer footer); no nav menu required. | VERIFIED | Byte-identical `:root` token block across `privacy.astro` / `terms.astro` / `index.astro` (`diff` exit 0). Byte-identical `<footer class="site-footer">` markup across all three (`diff` exit 0). Both built HTMLs contain `--font-sans` and `--font-mono` tokens, `--max: 720px` container, `--accent: #d94a1f` accent. Zero `<header>` elements; the only `<nav>` in each built page is `<nav class="links">` inside the footer — footer-only navigation per D-05. |
| 4 | Both pages pass LAND-02 — zero occurrences (case-insensitive) of `bitcoin`, `lightning`, `crypto`, `world domination`, `personal olympics` anywhere in rendered HTML or inline assets. | VERIFIED | `grep -ciE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/privacy/index.html` → `0`. Same regex on `dist/client/terms/index.html` → `0`. The pages are single-file prerendered HTML with inline `<style>` block; no external assets to scan separately. |

**Score:** 4/4 truths verified

### PLAN Frontmatter Must-Haves (combined)

The two plans declare 20 truths total (9 for privacy, 11 for terms). All are subsumed by or strictly stronger than the 4 ROADMAP SCs above. Spot-check of plan-specific truths:

| Plan Truth | Status | Evidence |
| ---------- | ------ | -------- |
| `/privacy` declares email, team, timezone, server logs collected | VERIFIED | Built HTML "What we collect" `<ul>` contains all four. |
| `/privacy` declares logs retained 30 days | VERIFIED | "Standard server logs (IP, user agent) retained for 30 days for abuse prevention". |
| `/privacy` declares GDPR/CCPA path via `privacy@oddlympics.app` within 30 days | VERIFIED | Built HTML has the D-06 pattern `<a href="mailto:privacy@oddlympics.app"><code>privacy@oddlympics.app</code></a> to request full deletion of your data. Requests honored within 30 days.` and the trailing `GDPR / CCPA requests honored within 30 days` line. |
| `/privacy` names Resend as ESP | VERIFIED | "Email delivery is handled by Resend. Their privacy policy also applies to message delivery." |
| Email addresses render as `<a href=mailto:><code>` (per D-06) | VERIFIED | Both pages use the exact pattern; verified via `grep -F '<a href="mailto:hello@oddlympics.app"><code>hello@oddlympics.app</code></a>'` and the privacy-only `privacy@oddlympics.app` equivalent. |
| `LAST_UPDATED` rendered as long-form US date | VERIFIED | Both pages render `Last updated: May 13, 2026` (per D-03/D-04). |
| `/terms` declares free service through 2026-07-19 | VERIFIED | "Your World Cup subscription will remain free through July 19, 2026." |
| `/terms` declares best-effort delivery, no liability for FIFA reschedules or delivery failures | VERIFIED | Item 2 in `<ol>`: "Best-effort delivery. We try our best to deliver match alerts on time. If a match is rescheduled by FIFA, or if email delivery fails for technical reasons, we are not liable for missed games." |
| `/terms` declares no FIFA/ESPN/team affiliation | VERIFIED | "We are not affiliated with FIFA, ESPN, any national team, or any broadcaster." |
| `/terms` prohibits submitting fake or others' email addresses | VERIFIED | "Don't use the signup form to submit fake or other people's email addresses." |
| `/terms` names Michigan, USA as governing law | VERIFIED | "Governed by the laws of Michigan, USA." |
| Both pages no inline `<script>` blocks, no analytics surface | VERIFIED | `grep -c '<script' dist/client/{privacy,terms}/index.html` → `0` / `0`. No Plausible script. No OG/Twitter meta (`grep -cE 'og:|twitter:' ...` → `0` / `0`). |

All plan-frontmatter truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/pages/privacy.astro` | Astro prerendered privacy policy page, `export const prerender = true`, ≥100 lines | VERIFIED | 217 lines. Frontmatter line 2: `export const prerender = true;`. Contains all required literals (`Privacy Policy`, `privacy@oddlympics.app`, `hello@oddlympics.app`, `Resend`, `Plausible`, `30 days`, `Last updated`, `site-footer`, `--max: 720px`, `Independent project`). Zero LAND-02 hits in source. Zero `<script` tags. Zero `og:`/`twitter:` meta. |
| `src/pages/terms.astro` | Astro prerendered terms page, `export const prerender = true`, ≥100 lines | VERIFIED | 186 lines. Frontmatter line 2: `export const prerender = true;`. Contains all required literals (`Terms`, `hello@oddlympics.app`, `Michigan`, `July 19, 2026`, `best-effort`, `Last updated`, `site-footer`, `--max: 720px`, `Independent project`, `FIFA`). Zero LAND-02 hits in source. Zero `<script` tags. Zero `og:`/`twitter:` meta. |
| `dist/client/privacy/index.html` | Prerendered emitted HTML | VERIFIED | Exists, 4239 bytes, all LEGAL-01 declaration literals present. |
| `dist/client/terms/index.html` | Prerendered emitted HTML | VERIFIED | Exists, 3786 bytes, all LEGAL-02 declaration literals present. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/pages/privacy.astro` | `references/privacy.md` body copy | hand-translated body (per D-01) | WIRED | Body text in built HTML matches the canonical doc clause-by-clause: collected data, don't-collect, never-do, rights, ESP, contact. The Resend gap-fill from D-02 is present. Regex `Resend.*Plausible.*privacy@oddlympics.app` matches built HTML in document order. |
| `src/pages/terms.astro` | `references/terms.md` body copy | hand-translated body (per D-01) | WIRED | Numbered `<ol>` items match the source's five-clause structure verbatim. Regex `2026-07-19` (rendered as `July 19, 2026`) + `Michigan` + `hello@oddlympics.app` matches built HTML. |
| `privacy.astro` footer | `/manage`, `/privacy`, `/terms`, `mailto:hello@oddlympics.app` | verbatim copy of `index.astro:186-196` | WIRED | `diff` of footer block against `index.astro` → BYTE-IDENTICAL. All four nav targets present in built HTML. © line `© 2026 Oddlympics · Independent project · Not affiliated with FIFA` present with U+00B7 middle-dots. |
| `terms.astro` footer | (same four targets) | verbatim copy of `index.astro:186-196` | WIRED | `diff` against `index.astro` → BYTE-IDENTICAL. `diff` against `privacy.astro` footer → BYTE-IDENTICAL. |
| `privacy.astro <style is:global>` | `index.astro` `:root` + `.wrap` + `.site-footer` | verbatim CSS tokens + container + footer rules | WIRED | `diff` of `:root` block against `index.astro` → BYTE-IDENTICAL. `--max: 720px`, `--accent: #d94a1f`, `--font-sans`, `--font-mono` all present in both built HTMLs. |
| `terms.astro <style is:global>` | `index.astro` `:root` + `.wrap` + `.site-footer` | verbatim CSS tokens + container + footer rules | WIRED | Same as above. |

All key links wired.

### Data-Flow Trace (Level 4)

Skipped — these pages are pure prerendered static content with no dynamic data. The `LAST_UPDATED` constant is a hardcoded module-level string (per D-03). No state, no fetch, no DB, no JS. Data-flow trace not applicable.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| `GET /privacy` returns 200 | `curl -sS -o /dev/null -w '%{http_code}' http://localhost:4321/privacy` against `node ./dist/server/entry.mjs` | `200` | PASS |
| `GET /terms` returns 200 | `curl -sS -o /dev/null -w '%{http_code}' http://localhost:4321/terms` against built server | `200` | PASS |
| `GET /` still returns 200 (regression check) | curl against built server | `200` | PASS |
| `GET /manage` still returns 200 (regression check) | curl against built server | `200` | PASS |
| `GET /schedule` still returns 200 (regression check) | curl against built server | `200` | PASS |
| Phase 6 landing smoke (18 cases, regression check) | `node scripts/smoke-landing.mjs` against built server | `pass=18 fail=0` | PASS |
| `npm run build` succeeds | (already verified by orchestrator) | exit 0, both `index.html` files emitted | PASS |

### Probe Execution

No phase-specific probes declared in PLAN/SUMMARY. The phase shipped two smoke-style checks (curl 200 + grep coverage on built HTML) that were re-run by this verifier; they map to the Behavioral Spot-Checks table above. No `scripts/*/tests/probe-*.sh` exist in this repository.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LEGAL-01 | 07-01-PLAN.md | `/privacy` renders canonical privacy copy from `references/privacy.md`. Declares: collected (email, team, timezone, server logs), retention (≤30 days), no sale, no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion via `privacy@oddlympics.app` within 30 days, ESP named. Last-updated matches deploy date. Same site shell. | SATISFIED | All declaration literals present in built `dist/client/privacy/index.html`; live HTTP 200; byte-identical shell with `index.astro`. REQUIREMENTS.md already marks LEGAL-01 as Complete. |
| LEGAL-02 | 07-02-PLAN.md | `/terms` renders canonical terms copy from `references/terms.md`. Declares: free through 2026-07-19, best-effort delivery (no liability for FIFA reschedules / delivery failures), no FIFA/ESPN/team affiliation, prohibition on fake/others' emails, Michigan (USA) governing law, `hello@oddlympics.app` contact. Last-updated matches deploy date. Same site shell. | SATISFIED | All declaration literals present in built `dist/client/terms/index.html`; live HTTP 200; byte-identical shell with `index.astro`. REQUIREMENTS.md already marks LEGAL-02 as Complete. |

No orphaned requirements: ROADMAP Phase 7 declares exactly LEGAL-01 + LEGAL-02; both plans claim those IDs respectively; both are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | The two new files contain no `TODO`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, "coming soon", "not yet implemented", or `return null/{}/[]` patterns. No console.log. No empty handlers. No hardcoded empty data flowing to render. |

### Code Review Cross-Check (from 07-REVIEW.md)

The Phase 07 code review (depth: standard, 2 files reviewed) found **0 blockers, 2 warnings, 3 info**. The warnings are quality / future-maintenance hazards, not goal-failure conditions:

- **WR-01** (terms.astro missing `h2` CSS rule even though privacy.astro has one) — confirmed: `grep` shows 0 `<h2>` elements and 0 `h2` CSS rule in `terms.astro`. Cosmetic / future-edit hazard only; no rendering impact today because no `<h2>` is emitted by `terms.astro`. Does not affect any of the 4 SCs.
- **WR-02** (`references/{privacy,terms}.md` show `May 12, 2026` while `.astro` files render `May 13, 2026`) — confirmed: one-day drift between canonical doc and rendered page. D-03/D-04 explicitly defines the `.astro` `LAST_UPDATED` as the deploy-aligned value; the canonical reference doc is editorial source-of-truth (D-01), not the rendering input. The rendered `May 13, 2026` is what ships and what SC1/SC2 evaluate. Documentation drift, not a goal failure.

Both warnings are flagged here for awareness; neither blocks goal achievement.

### Human Verification Required

(none — all 4 ROADMAP SCs are observable from the codebase / built HTML / live curl)

The Phase 11 launch gate will re-verify `/privacy` and `/terms` return 200 with canonical copy on production (`https://oddlympics.app/privacy`, `https://oddlympics.app/terms`) and re-run the LAND-02 grep on prod HTML. That is a cross-phase obligation, not a local-mode gap.

### Gaps Summary

No gaps. The phase goal — paid-ad-reviewer-ready `/privacy` and `/terms` returning 200 with canonical copy on the v2.0 site shell, free of LAND-02 prohibited terms — is achieved.

Evidence chain:

1. Both `src/pages/privacy.astro` (217 lines) and `src/pages/terms.astro` (186 lines) exist, are committed (`51db1d8`, `efd24e8`), prerendered (`export const prerender = true;`), and emit static HTML to `dist/client/{privacy,terms}/index.html` on `npm run build`.
2. Live `node ./dist/server/entry.mjs` returns HTTP 200 for both routes; the existing Phase 6 landing smoke (18 cases) still passes against the same built server — no regression.
3. Built HTML for `/privacy` carries every LEGAL-01 declaration literal: collected data (email, team, time zone, server logs IP/user agent), 30-day retention, no third-party tracking cookies, Plausible cookie-free, GDPR/CCPA deletion via `privacy@oddlympics.app` within 30 days, Resend named as ESP, `Last updated: May 13, 2026`.
4. Built HTML for `/terms` carries every LEGAL-02 declaration literal: free service through `July 19, 2026`, best-effort delivery with explicit no-liability for FIFA reschedules and delivery failures, no FIFA/ESPN/team affiliation, prohibition on fake or other people's emails, Michigan (USA) governing law, `hello@oddlympics.app` for questions, `Last updated: May 13, 2026`.
5. Visual shell parity is provably byte-identical: `diff` of the `:root` token block and the `<footer class="site-footer">` markup between `privacy.astro`, `terms.astro`, and `index.astro` all exit 0. Both built HTMLs contain `--max: 720px`, `--font-sans`, `--font-mono`, `--accent: #d94a1f`, all four footer nav targets, and the `Independent project · Not affiliated with FIFA` © line with U+00B7 middle-dots.
6. LAND-02 prohibited-terms grep on both built HTML files returns `0` matches. No inline `<script>` blocks, no `og:`/`twitter:` meta, no Plausible script — analytics surface correctly scoped to landing only per ANLTC-01.

---

_Verified: 2026-05-14T08:35:00Z_
_Verifier: Claude (gsd-verifier)_
