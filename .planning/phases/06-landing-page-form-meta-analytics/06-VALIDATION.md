---
phase: 6
slug: landing-page-form-meta-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none in repo — Phase 6 verification is end-to-end via build + grep + node smoke scripts (matches project convention; `scripts/smoke-signup.mjs` was the Phase 5 precedent) |
| **Config file** | none |
| **Quick run command** | `npx astro check && npm run build` |
| **Full suite command** | `npx astro check && npm run build && node scripts/smoke-landing.mjs` (the smoke script will be created in this phase to exercise the rendered landing page + form post) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx astro check`
- **After every plan wave:** Run `npm run build` (catches CSP, prerender, and Astro frontmatter errors that `astro check` misses)
- **Before `/gsd-verify-work`:** `npx astro check && npm run build && node scripts/smoke-landing.mjs` must be green and Lighthouse mobile ≥ 90 on Perf/A11y/BP/SEO (manual, run once against the built server)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> The planner fills this in. Each task should have at least one automated assertion or a Wave 0 stub. Below is the suggested skeleton; the planner refines per-plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-XX | 01 | 1 | LAND-01..04 | — | Static page renders headline + banner pill + four sections + footer | grep build output | `grep -F "Your team's matches" dist/client/index.html` | ❌ W0 | ⬜ pending |
| 06-02-XX | 02 | 2 | FORM-01..03 | T-FORM-injection | Form posts team + email + hidden timezone + honeypot + requested_sport=world_cup; bad team → 303 to /?error=bad-form | grep + curl smoke | `node scripts/smoke-landing.mjs` | ❌ W0 | ⬜ pending |
| 06-03-XX | 03 | 1 | META-01 | — | Head contains og:* + twitter:card; zero occurrences of bitcoin\|lightning\|crypto\|world domination\|personal olympics | grep dist | `! grep -qiE "bitcoin\|lightning\|crypto\|world domination\|personal olympics" dist/client/index.html` | ❌ W0 | ⬜ pending |
| 06-04-XX | 04 | 2 | ANLTC-01 | — | Form submit fires `plausible('Signup Submit', { props: { team: <slug> } })`; Plausible init unchanged | grep + smoke | `grep -F "Signup Submit" dist/client/index.html` | ❌ W0 | ⬜ pending |
| 06-05-XX | 05 | 3 | LAND-03 | — | Lighthouse mobile ≥ 90 on Perf/A11y/Best Practices/SEO; no horizontal scroll at 390/768/1280px | manual | (run Lighthouse against `npm run serve` once) | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-landing.mjs` — end-to-end smoke covering: GET / returns 200, head has all required meta tags, body has headline + four sections + footer, POST /api/signup with valid team+email+timezone returns 303 to /pending, prohibited-term grep returns zero hits, Plausible init + custom event call both present in HTML
- [ ] (Optional) `scripts/check-lighthouse.mjs` — wrapper around Lighthouse CLI to assert mobile scores ≥ 90 on the four categories

*If none: "Existing infrastructure covers all phase requirements." — not the case here; the smoke script must be authored.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse mobile ≥ 90 across Perf / A11y / Best Practices / SEO | LAND-03 | Requires Chromium + Lighthouse CLI; not part of automated CI today | `npm run build && npm run serve` in one terminal, then `lighthouse http://localhost:4321 --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./lighthouse.json` in another. Assert each `categories.*.score >= 0.9`. |
| Plausible custom goal `Signup Submit` configured in dashboard | ANLTC-01 (R-4) | The dashboard is external; cannot be asserted from source. | Operator action before deploy: log into plausible.io, project `oddlympics.app`, add custom event goal `Signup Submit`. Without this, events are accepted but never counted. |
| OG / Twitter card validation in third-party debuggers | META-01 | External services; rate-limited. | Once landed to staging, paste the URL into Facebook Sharing Debugger and an X (Twitter) card validator and screenshot a passing render. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (smoke-landing.mjs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner per-task verification map is filled)

**Approval:** pending
