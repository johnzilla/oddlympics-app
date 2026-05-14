---
phase: 07-legal-pages
plan: 02
subsystem: legal-pages
tags: [legal, terms, prerender, site-shell]
dependency_graph:
  requires:
    - "src/pages/index.astro (v2.0 site shell — verbatim CSS + footer source)"
    - "src/pages/privacy.astro (sibling plan 07-01 — :root + footer byte-identical match target)"
    - "references/terms.md (canonical body copy)"
  provides:
    - "/terms route (LEGAL-02 declarations)"
  affects:
    - "Phase 11 AC5 (200 on /terms with canonical copy + last-updated)"
    - "Phase 11 AC7 (LAND-02 grep on prod HTML)"
tech_stack:
  added: []
  patterns:
    - "Numbered legal-clauses pattern — render references/terms.md `1. **Bold.** body` list as `<ol>` of `<li>` opening with `<strong>` (per PLAN action note; inline labels inside `<li>` are not section breaks, so no `<h2>` needed)."
    - "Cross-plan shell-parity proven via two-line diff: `:root` token block AND `.site-footer` markup are byte-identical between privacy.astro and terms.astro (`diff` exit 0 on both regions)."
key_files:
  created:
    - "src/pages/terms.astro"
    - ".planning/phases/07-legal-pages/07-02-SUMMARY.md"
  modified: []
decisions:
  - "Rendered numbered terms clauses as `<ol>` with each `<li>` opening with `<strong>` for the bold lead-in — the bold labels in references/terms.md (`**Free service.**` etc.) are inline labels inside list items, not section breaks, so they do NOT take `<h2>`. Plan 01's `<h2>` precedent applies to section-style `**Bold heading:**` patterns (privacy doc); the terms doc structure is different (numbered clauses) and the plan action explicitly directs this rendering."
  - "Stored LAST_UPDATED as the pre-formatted display string 'May 13, 2026' (same value as privacy.astro per CONTEXT D-03 — both pages share deploy date)."
  - "Used `<ol>` with `padding-left: 24px` + `li margin-bottom: 8px` (vs the privacy `<ul>` rule's 20px / 6px) — small bump to accommodate two-digit numbered counters without crowding. Sub-decision under CONTEXT discretion bullet 'whether the privacy page's list groups are <h2>+<ul> or <dl>': here, the source clearly directs `<ol>`."
  - "Dropped the @media (prefers-reduced-motion) block entirely (PATTERNS 5h allowance; same as plan 01) — no animated elements on legal pages."
metrics:
  duration: "~2 min"
  completed: "2026-05-14T02:12:28Z"
---

# Phase 07 Plan 02: Terms page Summary

Shipped `src/pages/terms.astro` — a prerendered Astro static page rendering canonical terms copy from `references/terms.md` on the v2.0 site shell, satisfying LEGAL-02 paid-ad-reviewer obligations.

## What was built

- **`src/pages/terms.astro`** (186 lines total, ~110-line `<style is:global>` block — inside CONTEXT D-07 80–120 target range):
  - Frontmatter: `export const prerender = true;` + `TITLE = 'Terms — Oddlympics'`, `DESCRIPTION` (single sentence, LAND-02-clean), `LAST_UPDATED = 'May 13, 2026'` (SCREAMING_SNAKE_CASE per CONVENTIONS.md). No TEAMS import, no confederation grouping, no OG/Twitter consts (PATTERNS Pattern 1 trim).
  - `<head>`: doctype + `<html lang="en">`, charset + viewport + favicon, `<title>` + description meta. Zero OG/Twitter tags, zero Plausible script, zero inline `<script>` blocks (PATTERNS Pattern 6, ANLTC-01 scope).
  - `<body>`: `<main>` → `<section class="content">` → `.wrap` containing `<h1>Terms</h1>`, `<p class="last-updated">`, intro `<p>` ("By using Oddlympics, you agree to the following:"), then `<ol>` with five `<li>` clauses each opening with `<strong>` for the bold lead-in (`Free service.`, `Best-effort delivery.`, `No affiliation.`, `Acceptable use.`, `Disputes.`), then the standalone `Questions:` paragraph with one mailto link (`hello@oddlympics.app`) wrapping `<code>` (D-06 pattern). Verbatim lines preserved from references/terms.md: `Your World Cup subscription will remain free through July 19, 2026.` and `Governed by the laws of Michigan, USA.`
  - `<footer class="site-footer">`: VERBATIM byte-for-byte copy of `src/pages/index.astro:186-196` — same four nav links (`/manage`, `/privacy`, `/terms`, `mailto:hello@oddlympics.app`), same `© 2026 Oddlympics · Independent project · Not affiliated with FIFA` line with U+00B7 middle-dot separators. **Confirmed BYTE-IDENTICAL to privacy.astro footer via `diff` (exit 0).**
  - `<style is:global>`: verbatim `:root` token block (--bg, --fg, --fg-dim, --line, --line-strong, --surface, --accent, --accent-ink, --accent-soft, --font-sans, --font-mono, --max: 720px, --pad-x), verbatim box-sizing + html/body baseline, verbatim `.wrap` container, NEW minimal body typography (h1 clamp(28px,5vw,40px), p 15px/1.55, ol with padding-left:24px, li 15px/1.55 margin-bottom:8px, strong 700, a in --accent with brightness(0.92) hover, code in --font-mono), NEW `.content` and `.last-updated` rules, verbatim `.site-footer` rule set, 520px mobile breakpoint substituted onto `.content`. `<h2>` rule dropped (no `<h2>` rendered). PATTERNS 5h reduced-motion block dropped. **`:root` block confirmed BYTE-IDENTICAL to privacy.astro via `diff` (exit 0).**

## Tasks executed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create `src/pages/terms.astro` from index.astro shell + references/terms.md body | `efd24e8` | `src/pages/terms.astro` |
| 2 | Build + serve verification (no source changes; verifies dist/ output) | (verification-only, no commit) | — |

## Verification evidence

**Build:** `npm run build` → exit 0 ("Complete!"). Astro 5 with `@astrojs/node` standalone adapter emitted `dist/client/terms/index.html` (3,786 bytes).

**LAND-02 grep on built HTML (AC7 evidence):**
```
$ grep -ciE 'bitcoin|lightning|crypto|world domination|personal olympics' dist/client/terms/index.html
0
```
LAND-02 prohibited-term hits: **0/5** → PASS.

**LEGAL-02 declaration coverage on built HTML (7/7 PASS + `not affiliated` case-insensitive PASS):**

| Literal | Status |
| ------- | ------ |
| `July 19, 2026` | OK (free-service end date) |
| `best-effort` | OK (best-effort delivery declaration) |
| `FIFA` | OK |
| `fake or other` | OK (acceptable use prohibition) |
| `Michigan` | OK (governing law) |
| `hello@oddlympics.app` | OK (Questions contact) |
| `May 13, 2026` | OK (LAST_UPDATED) |
| `not affiliated` (case-insensitive) | OK (covers footer © line + body no-affiliation clause) |

**Shell-parity grep on built HTML (6/6 PASS):**

| Literal | Status |
| ------- | ------ |
| `--max: 720px` | OK (verified with `grep -F -- '--max: 720px'`) |
| `href="/manage"` | OK |
| `href="/privacy"` | OK |
| `mailto:hello@oddlympics.app` | OK |
| `Independent project` | OK |
| `Not affiliated with FIFA` | OK |

**Cross-plan shell parity (manual diff against privacy.astro):**
- `:root` token block: `diff` exit 0 → **BYTE-IDENTICAL** to privacy.astro `:root`.
- `<footer class="site-footer">…</footer>` markup: `diff` exit 0 → **BYTE-IDENTICAL** to privacy.astro footer.

**Source-level checks (Task 1 verify):**
- Zero `<script` tags in source.
- Zero `og:` or `twitter:` meta properties.
- All four footer nav links present (`/manage`, `/privacy`, `/terms`, `mailto:hello@oddlympics.app`).
- `--max: 720px` present in `<style is:global>`.

**Live server check (Path A — built server):**
- Started `node ./dist/server/entry.mjs` in background.
- Server log: `[@astrojs/node] Server listening on http://localhost:4321`.
- `curl -sS -o /dev/null -w '%{http_code}' http://localhost:4321/terms` → **`200`**.
- (Note: same as plan 01 — adapter binds to `localhost` only, `127.0.0.1` connection-refused; the 200 against `http://localhost:4321/terms` satisfies the AC since `localhost` is the loopback the server advertises.)

**Verification path used:** Path A (built-server smoke against `dist/server/entry.mjs`). Built HTML output path: `dist/client/terms/index.html`. Curl status captured: **`200`**.

## Success criteria

- [x] `src/pages/terms.astro` exists, is committed (`efd24e8`), renders as a prerendered Astro static page.
- [x] `/terms` returns HTTP 200 against `node dist/server/entry.mjs`.
- [x] All LEGAL-02 declarations present in rendered HTML: free service through `July 19, 2026`, best-effort delivery, no FIFA/ESPN/team affiliation, prohibition on submitting `fake or other` people's emails, Michigan (USA) governing law, `hello@oddlympics.app` contact, Last-updated date `May 13, 2026`.
- [x] Visual shell parity with v2.0 landing AND with privacy.astro: byte-identical `:root` tokens, byte-identical `.site-footer` markup, same `--max: 720px` container, same fonts.
- [x] Zero LAND-02 prohibited-term occurrences in rendered HTML.
- [x] No inline `<script>` blocks; no OG/Twitter meta tags; no analytics surface.

## Deviations from Plan

None — plan executed exactly as written. All decisions taken were among the planner's discretion bullets (CONTEXT) or PATTERNS allowances and are logged under `decisions:` above. The plan action explicitly directed `<strong>` (not `<h2>`) for the bold lead-ins inside the numbered list — that wording matches the structural difference between privacy (section-style headings) and terms (numbered clauses with inline labels), and the directive was followed verbatim.

## Self-Check

**File existence checks:**
- `src/pages/terms.astro` — FOUND (186 lines).
- `dist/client/terms/index.html` — FOUND (built, 3,786 bytes).
- `.planning/phases/07-legal-pages/07-02-SUMMARY.md` — created by this Write.

**Commit checks:**
- `efd24e8` — `git log --oneline | grep efd24e8` returns the Task 1 commit → FOUND.

## Self-Check: PASSED
