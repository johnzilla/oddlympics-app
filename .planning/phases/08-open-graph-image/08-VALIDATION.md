---
phase: 8
slug: open-graph-image
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `08-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in (`node:fs`, `node:buffer`, `node:child_process`) — no test runner |
| **Config file** | none — verification inlined in `scripts/render-og-image.mjs` post-render |
| **Quick run command** | `node scripts/render-og-image.mjs` |
| **Full suite command** | `node scripts/render-og-image.mjs` (same; all 5 checks run post-render) |
| **Estimated runtime** | ~2 seconds (resvg render + byte-format checks) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/render-og-image.mjs`
- **After every plan wave:** Run `node scripts/render-og-image.mjs` (single phase, single command)
- **Before `/gsd-verify-work`:** All 5 checks must pass + `npm run build` succeeds
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-XX | 01 | 1 | OG-01 | — | PNG file exists | unit (byte) | `node scripts/render-og-image.mjs` → check 1 | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | OG-01 | — | First 8 bytes = PNG sig `89 50 4E 47 0D 0A 1A 0A` | unit (byte) | `node scripts/render-og-image.mjs` → check 2 | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | OG-01 | — | IHDR width (bytes 16–19, BE u32) === 1200 | unit (byte) | `node scripts/render-og-image.mjs` → check 3 | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | OG-01 | — | IHDR height (bytes 20–23, BE u32) === 630 | unit (byte) | `node scripts/render-og-image.mjs` → check 4 | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | OG-01 | — | `fs.statSync('public/og-image.png').size < 300_000` | unit (byte) | `node scripts/render-og-image.mjs` → check 5 | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | LAND-02 | — | Zero prohibited terms in SVG source | unit (grep) | `! grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' references/og-image.svg` | ❌ W0 | ⬜ pending |
| 8-01-XX | 01 | 1 | OG-01 | — | `/og-image.png` returns 200 + `image/png` (prod) | smoke (manual) | Phase 11 AC6 only (deferred — out of phase 8 scope) | ❌ deferred | ⬜ deferred |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/render-og-image.mjs` — render script + inlined 5 post-render byte/grep checks
- [ ] `references/fonts/JetBrainsMono-Bold.ttf` — vendored static TTF (NameID 1 = `JetBrains Mono`, weight 700)
- [ ] `references/fonts/Inter-Regular.ttf` — vendored static TTF (NameID 1 = `Inter`, weight 400)
- [ ] `references/fonts/Inter-Bold.ttf` — vendored static TTF (NameID 1 = `Inter`, weight 700)
- [ ] `@resvg/resvg-js` devDep — `npm install --save-dev @resvg/resvg-js`
- [ ] `og:render` npm script entry in `package.json`

*Per RESEARCH §"Variable fonts do NOT work with resvg-js 2.6.2": this validation map assumes static TTFs, overriding CONTEXT D-03's "variable fonts" wording.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| opengraph.xyz preview renders headline + banner + URL cleanly | OG-01 / AC6 | Third-party scraper rendering is the prod truth | Open `https://www.opengraph.xyz/url/https%3A%2F%2Foddlympics.app` post-deploy; assert visual elements present |
| Slack share renders the OG card cleanly | OG-01 / AC6 | Slack's scraper has its own cache + rendering quirks | Paste `https://oddlympics.app` into a Slack channel post-deploy; assert preview card shows headline + banner + URL |
| iMessage share renders the OG card cleanly | OG-01 / AC6 | iMessage Link Preview uses its own scraper | iMessage `https://oddlympics.app` to self post-deploy; assert preview card renders |

*All three manual checks are owned by Phase 11 AC6, not Phase 8. Phase 8's gate is the local 5 automated checks only (CONTEXT D-05).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (5 checks inlined in `scripts/render-og-image.mjs`)
- [ ] Sampling continuity: single-command runs all checks — no continuity gap
- [ ] Wave 0 covers all MISSING references (script, 3 TTFs, devDep, npm script)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter (after execute-phase confirms all tasks have automated verify)

**Approval:** pending
