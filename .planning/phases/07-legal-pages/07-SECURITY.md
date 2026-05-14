---
phase: 07-legal-pages
audited: 2026-05-14
auditor: gsd-security-auditor
asvs_level: 1
block_on: critical
threats_total: 17
threats_closed: 17
threats_open: 0
status: SECURED
files_audited:
  - src/pages/privacy.astro
  - src/pages/terms.astro
  - dist/client/privacy/index.html
  - dist/client/terms/index.html
register_origin: plan-authored
---

# Phase 07 Legal Pages — Security Audit

## Scope

Two prerendered static Astro pages (`/privacy`, `/terms`) rendering canonical
copy from `references/{privacy,terms}.md` on the v2.0 consumer site shell.
Threat register declared in `07-01-PLAN.md` (T-07-01..08) and `07-02-PLAN.md`
(T-07-09..17). Register is plan-authored — auditor verifies each mitigation
against the implemented code; does not scan for new vulnerabilities.

Trust boundaries (from plan):
1. Author → repo: hand-translation of `references/*.md` into `*.astro`.
2. Build pipeline → served HTML: Astro prerender to `dist/client/*/index.html`.
3. User browser → page: one-way GET of static HTML, no inputs accepted.

## Threat Verification (17/17 CLOSED)

### Plan 07-01 — Privacy page

| Threat | Category | Disposition | Status | Evidence |
|--------|----------|-------------|--------|----------|
| T-07-01 | Tampering (body copy drift) | mitigate | CLOSED | `grep -cF` on `dist/client/privacy/index.html` returns 1 for each LEGAL-01 literal: `Resend`, `Plausible`, `cookie-free`, `30 days`, `privacy@oddlympics.app`. Body matches `references/privacy.md` clause-by-clause. |
| T-07-02 | Information disclosure (prohibited-term leak) | mitigate | CLOSED | `grep -ciE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/privacy/index.html` → `0`. Source `src/pages/privacy.astro` same regex → `0`. |
| T-07-03 | Tampering (footer drift from index.astro) | mitigate | CLOSED | `diff src/pages/index.astro:186-196 src/pages/privacy.astro:63-73` → exit 0 (byte-identical). Built HTML contains: `href="/manage"`, `href="/terms"`, `mailto:hello@oddlympics.app`, `Independent project`, `Not affiliated with FIFA` (each grep count = 1). |
| T-07-04 | Spoofing (last-updated date) | mitigate | CLOSED | `LAST_UPDATED = 'May 13, 2026'` hardcoded at `src/pages/privacy.astro:6`. Built HTML contains `May 13, 2026` (`grep -cF` = 1). Matches CONTEXT D-03/D-04 convention. |
| T-07-05 | XSS via copy injection (mailto links) | accept | CLOSED | Rationale verified: zero `<script` and zero `<form`/`<input` in source (`grep -cE '<script\|<form\|<input' src/pages/privacy.astro` → 0) and in built HTML (`dist/client/privacy/index.html` same regex → 0). mailto hrefs are hard-coded string literals at lines 51, 58, 69 with no template interpolation. No request-time data path. |
| T-07-06 | Repudiation (unchanged disclosure claim) | accept | CLOSED | Git history is the audit log per CONTEXT D-01. `references/privacy.md` and `src/pages/privacy.astro` co-located in repo; solo-dev ASVS L1 posture. No additional repudiation surface warranted. |
| T-07-07 | Denial of service (cached prerendered HTML) | accept | CLOSED | Static HTML at `dist/client/privacy/index.html` (4239 bytes). Zero per-request server state, zero DB writes, zero JS. Inherits Caddy/systemd resilience from DEPLOY.md. DoS surface identical to `/`. |
| T-07-08 | Elevation of privilege | accept | CLOSED | No auth surface, no privileged operations, no DB writes. Page is pure-content GET. Nothing to elevate. |

### Plan 07-02 — Terms page

| Threat | Category | Disposition | Status | Evidence |
|--------|----------|-------------|--------|----------|
| T-07-09 | Tampering (body copy drift, legal declarations) | mitigate | CLOSED | `grep -cF` on `dist/client/terms/index.html`: `July 19, 2026`=2, `best-effort`=1, `Michigan`=2, `fake or other`=1, `FIFA`=2, `hello@oddlympics.app`=1. Case-insensitive `not affiliated` → 1. Body matches `references/terms.md` clause-by-clause. |
| T-07-10 | Information disclosure (prohibited-term leak) | mitigate | CLOSED | `grep -ciE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/terms/index.html` → `0`. Source `src/pages/terms.astro` same regex → `0`. |
| T-07-11 | Tampering (footer drift) | mitigate | CLOSED | `diff src/pages/index.astro:186-196 src/pages/terms.astro:40-50` → exit 0 (byte-identical). Built HTML contains: `href="/manage"`, `href="/privacy"`, `mailto:hello@oddlympics.app`, `Independent project`, `Not affiliated with FIFA` (each grep count = 1). |
| T-07-12 | Spoofing (governing law / free-through date) | mitigate | CLOSED | Built HTML contains exact literal `Governed by the laws of Michigan, USA.` (count=1) and `free through July 19, 2026` (count=1). Both pinned to `references/terms.md` source lines 7, 11. |
| T-07-13 | Spoofing (last-updated date) | mitigate | CLOSED | `LAST_UPDATED = 'May 13, 2026'` hardcoded at `src/pages/terms.astro:6`. Built HTML contains `May 13, 2026` (`grep -cF` = 1). Matches CONTEXT D-03 convention. |
| T-07-14 | XSS via copy injection (mailto link) | accept | CLOSED | Rationale verified: zero `<script` and zero `<form`/`<input` in source (`grep -cE '<script\|<form\|<input' src/pages/terms.astro` → 0) and in built HTML (`dist/client/terms/index.html` same regex → 0). mailto hrefs are hard-coded literals at lines 35, 46 with no template interpolation. |
| T-07-15 | Repudiation (unchanged declaration claim) | accept | CLOSED | Same posture as T-07-06: git history is the audit log; `references/terms.md` co-evolves with `src/pages/terms.astro` per CONTEXT D-01. Solo-dev ASVS L1. |
| T-07-16 | Denial of service (cached prerendered HTML) | accept | CLOSED | Static HTML at `dist/client/terms/index.html` (3786 bytes). Zero per-request state, zero JS, inherits Caddy/systemd resilience. |
| T-07-17 | Elevation of privilege | accept | CLOSED | No auth surface, no privileged operations, no DB writes. Pure-content GET. |

## Accept-disposition rationale audit

For each `accept` threat the planner's rationale was verified against the
actual code (not just intent):

- **No `<script>` in source or built HTML.** `grep -cE '<script' src/pages/{privacy,terms}.astro dist/client/{privacy,terms}/index.html` → all 4 counts = 0. Plausible script intentionally scoped to landing only per ANLTC-01.
- **No `<form>` and no `<input>` anywhere.** Same regex including those tags → all 4 counts = 0.
- **No `og:` or `twitter:` meta.** `grep -cE 'og:|twitter:' src/pages/{privacy,terms}.astro dist/client/{privacy,terms}/index.html` → all 4 counts = 0.
- **mailto hrefs are hard-coded literals**, not template-interpolated: 5 occurrences across the two source files (privacy.astro lines 51, 58, 69; terms.astro lines 35, 46), each a static string in the Astro template.

The "no XSS surface" claim (T-07-05, T-07-14) and the "no per-request server
state" claim (T-07-07, T-07-16) are therefore CONFIRMED against the
implemented code, not just the plan's intent.

## Cross-plan shell parity

Verified byte-identical CSS shell + footer between the new pages and the
canonical `src/pages/index.astro` source:

- Footer block `index.astro:186-196` vs `privacy.astro:63-73` → `diff` exit 0.
- Footer block `index.astro:186-196` vs `terms.astro:40-50` → `diff` exit 0.

This supports T-07-03 and T-07-11 ("footer drift" tampering threats).

## Unregistered Flags

`07-01-SUMMARY.md` and `07-02-SUMMARY.md` do not declare a `## Threat Flags`
section — these plans introduced no new attack surface beyond the prerendered
static HTML covered by the existing threat register. No unregistered flags.

## Accepted Risks Log

| Threat | Risk | Rationale | Owner |
|--------|------|-----------|-------|
| T-07-05 | Hypothetical XSS via mailto links | All hrefs are hard-coded string literals in Astro templates. Page has no JS, no form, no request-time interpolation. Verified: 0 `<script>`, 0 `<form>`, 0 `<input>` in source and built HTML. | johnzilla |
| T-07-06 | Author repudiation on disclosure changes | Git history is the audit log per CONTEXT D-01. `references/*.md` co-evolve with `*.astro` in the same PR. Solo-dev ASVS L1 posture; additional repudiation controls (signed commits, separate review log) not warranted at this scale. | johnzilla |
| T-07-07 | DoS via cached prerendered HTML | Static page with zero per-request server state. Surface identical to `/`. Inherits Caddy + systemd hardening already documented in DEPLOY.md. | johnzilla |
| T-07-08 | EoP — n/a | Page has no auth, no privileged operations, no DB writes. Nothing to elevate. | johnzilla |
| T-07-14 | Hypothetical XSS via terms mailto link | Same as T-07-05; verified against terms.astro source and built HTML. | johnzilla |
| T-07-15 | Author repudiation on terms changes | Same as T-07-06. | johnzilla |
| T-07-16 | DoS via cached terms HTML | Same as T-07-07. | johnzilla |
| T-07-17 | EoP — n/a | Same as T-07-08. | johnzilla |

## Outcome

All 17 declared threats are CLOSED. Of those, 9 `mitigate` threats have
positive grep evidence in the implemented code (source + built HTML), and 8
`accept` threats have their stated rationale confirmed against the implemented
code (zero JS, zero form, zero input, zero OG/Twitter, zero request-time
interpolation). Phase 07 is cleared for the Phase 11 launch gate (which will
re-run the LAND-02 grep and 200-OK checks against production HTML).
