---
phase: 6
slug: landing-page-form-meta-analytics
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-13
completed: 2026-05-14
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
| 06-01-T1 | 01 | 1 | LAND-01, LAND-02, LAND-04, FORM-01, FORM-02, FORM-03, META-01 | T-06-01..09 | Full rewrite of src/pages/index.astro: new frontmatter + head (META-01 tags) + body (banner + headline + sub-headline with SSR span + form with 48-team confederation-grouped select + 4 below-fold sections + footer) + retuned <style is:global>. Honeypot retained verbatim. Prohibited terms scrubbed. | grep build output | `npm run build && npx astro check && ! grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' dist/client/index.html && [ "$(grep -c '<optgroup ' dist/client/index.html)" = "6" ] && grep -F "Your team's matches" dist/client/index.html` | ✅ src/pages/index.astro exists | ✅ green |
| 06-02-T1 | 02 | 2 | ANLTC-01, FORM-03 (retained) | T-06-10..16 | Append one inline `<script is:inline>` block to src/pages/index.astro implementing tz-label swap + ?error= COPY-map verbatim + Plausible Signup Submit listener (D-09/11/12). XSS-safe via textContent. Fire-and-forget submit (no preventDefault). | grep + build | `npm run build && grep -F 'Signup Submit' dist/client/index.html && grep -F 'tz-label' dist/client/index.html && ! grep -F 'innerHTML' src/pages/index.astro && ! grep -F 'preventDefault' src/pages/index.astro` | ✅ src/pages/index.astro exists | ✅ green |
| 06-03-T1 | 03 | 3 | LAND-01..04, FORM-01..03, META-01, ANLTC-01 (all assertions) | T-06-17..21 | Author scripts/smoke-landing.mjs (~80-120 LOC, Node-native, mirrors scripts/smoke-signup.mjs harness): GET / + body grep across 15+ evidence tags; POST /api/signup with valid + bad-team payloads to verify 303 redirects. Add `smoke:landing` and `check:land-02` to package.json scripts. | smoke harness | `npm run build && node scripts/smoke-landing.mjs` | ✅ scripts/smoke-landing.mjs shipped (commit ffa627b) | ✅ green (18/18 PASS) |
| 06-03-T2 | 03 | 3 | ANLTC-01 (R-4 / D-10) | T-06-19, T-06-20 | Pre-deploy operator action: configure Plausible custom goal `Signup Submit` at https://plausible.io/oddlympics.app/settings/goals; add Day-2-ops row to DEPLOY.md citing CONTEXT D-10. | manual (dashboard) + grep DEPLOY.md | `grep -F "Plausible custom-goal" DEPLOY.md` (post-merge sanity grep) | manual + ✅ DEPLOY.md row at line 114 (commit 17dfbc5) | ✅ green (operator confirmed goal exists) |
| 06-03-T3 | 03 | 3 | LAND-03, LAND-04, CONTEXT D-03..D-05 (AC3 dry run) | — | Manual: Lighthouse mobile ≥ 90 across Perf/A11y/Best Practices/SEO (soft gate; Phase 11 AC8 hard gate). 3-viewport visual at 390/768/1280px. 3-zone tz spoof (America/Detroit → "Detroit time" / Europe/London → "London time" / Africa/Lagos → "Lagos time"). `?error=bad-email` URL renders FORM-03 verbatim copy. | manual + Lighthouse CLI | `npx --yes lighthouse http://localhost:4321 --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./references/lighthouse-phase-06.json --chrome-flags="--headless --no-sandbox"` then node assertion that all four `categories.*.score >= 0.9` | ✅ references/lighthouse-phase-06.json + 3 viewport screenshots (commit 4c49148) | ✅ green (Perf 1.00 / A11y 0.94 / BP 1.00 / SEO 1.00; all 4 tz zones + 3 viewports + ?error= render verified via headless puppeteer) |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (smoke-landing.mjs)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (after planner per-task verification map is filled)

**Approval:** green (all 9 phase requirement IDs evidenced via smoke + Lighthouse JSON + headless-puppeteer + operator-confirmed dashboard goal — see 06-03-SUMMARY.md §Self-Check)
