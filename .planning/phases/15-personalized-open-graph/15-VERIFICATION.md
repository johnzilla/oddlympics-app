---
phase: 15-personalized-open-graph
verified: 2026-05-23T20:30:00Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a shared /r/<code> URL in a social platform unfurl debugger (e.g., Twitter/X Card Validator, LinkedIn Post Inspector, Facebook Debugger, or Slack link preview) pointing at production (https://oddlympics.app/r/<code>) and confirm the preview shows the team-specific image, not the generic OG image."
    expected: "The unfurl card shows 'Following <Team> · oddlympics' as the title and renders the per-team PNG (e.g., /og/england.png) as the preview image — not /og-image.png."
    why_human: "Social-platform unfurl behavior (bot-side scraping of og:meta, CDN caching of previews, per-platform rendering) cannot be verified by grep or response-body analysis alone. The route serves the correct meta (verified by smoke), but real-world unfurl confirmation requires hitting a live social validator."
---

# Phase 15: Personalized Open Graph Verification Report

**Phase Goal:** When a referral link is shared on a social platform, the link preview unfurls with an image of the sharer's team — making the share visually personal. Resolve the server-rendered-referral-route mechanism so a prerendered landing page can still serve per-referrer OG meta.
**Verified:** 2026-05-23T20:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A server-rendered `/r/[code]` route exists that emits per-team OG meta for resolved codes | VERIFIED | `src/pages/r/[code].astro` exists (71 lines), `prerender = false`, resolves code via `lookupTeamByReferralCode`, emits `og:title = 'Following <Team> · oddlympics'` and `og:image = ${SITE_URL}/og/${row.team}.png` |
| 2  | The CR-01 fix is in place: FS-probe replaced by VALID_TEAMS allow-list lookup | VERIFIED | Commit `75a9114` — no `existsSync`, no `fileURLToPath`, no `repoRoot` in `[code].astro`. Line 38: `const pngExists = VALID_TEAMS.has(row.team)` |
| 3  | Per-team OG images exist for all 48 World Cup teams | VERIFIED | `ls public/og/*.png | wc -l` = 48; `file public/og/england.png` = "PNG image data, 1200 x 630, 8-bit/color RGBA, non-interlaced"; all files within 1KB–300KB size bounds |
| 4  | Unresolved/malformed codes return 200 with generic OG meta, never 404 | VERIFIED | Unresolved branch in `[code].astro:47-58` returns generic title + `/og-image.png`; smoke SHARE-r-unknown asserts `res.status === 200` and absence of "Following" prefix |
| 5  | Code-shape gate runs before DB lookup or HTML echo | VERIFIED | `[code].astro:13-14`: `const CODE_SHAPE = /^[a-z0-9]{8}$/; const code = CODE_SHAPE.test(rawCode) ? rawCode : ''` — gate precedes DB call at line 21 |
| 6  | Bounce mechanism is meta-refresh + try/catch-wrapped location.replace | VERIFIED | `[code].astro:63`: `<meta http-equiv="refresh" ...>`; line 69: `try { location.replace(bounceUrl); } catch {}` via `define:vars` |
| 7  | noindex applied to redirect intermediary route | VERIFIED | `[code].astro:61`: `<Layout title={pageTitle} og={ogProps} noindex>` |
| 8  | All four share-URL emit sites migrated from `/?ref=CODE` to `/r/CODE` | VERIFIED | `pending.astro:77`, `confirmed.astro:90`, `manage.astro:70`, `email.ts:29` all contain `/r/`; exhaustive grep `grep -RnE "'/\?ref='" src/` returns zero matches |
| 9  | SVG template has correct token counts | VERIFIED | `{{TEAM_LABEL}}` count = 1; `{{HEADLINE_FONT_SIZE}}` count = 3 (per `grep -c`) |
| 10 | Render script exists, is syntax-valid, and has correct font-size buckets and exit-code contract | VERIFIED | `scripts/render-team-og-images.mjs` (128 lines); `node --check` exits 0; `labelLen <= 12 ? 64 : labelLen <= 16 ? 52 : 44` buckets present; `process.exit(1)` on any FAIL |
| 11 | `npm run og:render-teams` script entry in package.json | VERIFIED | `package.json:21`: `"og:render-teams": "node scripts/render-team-og-images.mjs"` |
| 12 | SHARE-r-known smoke requires per-team og:image (not fallback) post CR-01 fix | VERIFIED | `smoke-signup.mjs:592`: `!body.includes('/og/' + row.team + '.png')` — fallback no longer accepted for known codes |
| 13 | SHARE-r-unknown smoke asserts generic og:image and no "Following" title | VERIFIED | `smoke-signup.mjs:615-624`: asserts `/og-image.png` in body and absence of "Following" prefix |
| 14 | Phase 8 generic OG image (`public/og-image.png`) is unchanged | VERIFIED | SUMMARY 15-03 confirms md5 match; render script does not modify `og-image.png` (separate sibling per D-11) |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/r/[code].astro` | Server-rendered referral route with per-team OG meta | VERIFIED | 71 lines, `prerender = false`, resolves via `lookupTeamByReferralCode`, VALID_TEAMS allow-list for PNG probe |
| `src/lib/db.ts` | `lookupTeamByReferralCode` prepared statement | VERIFIED | Lines 178-183: narrowed SELECT (referral_code, team), positioned after `lookupByReferralCode` |
| `references/og-image-team.svg` | Parameterized SVG template with `{{TEAM_LABEL}}` and `{{HEADLINE_FONT_SIZE}}` | VERIFIED | Both tokens present with correct counts; D-07 headline copy confirmed |
| `scripts/render-team-og-images.mjs` | Render + verify script for 48 teams | VERIFIED | 128 lines, syntax-valid, correct Resvg config, 6-check per team, D-12a exit contract |
| `package.json` | `og:render-teams` script entry | VERIFIED | Line 21, valid JSON |
| `public/og/` | 48 team PNGs | VERIFIED | 48 PNG files, 1200x630, all < 300KB |
| `scripts/smoke-signup.mjs` | SHARE-r-known and SHARE-r-unknown cases | VERIFIED | Both cases present (lines 570-629); per-team og:image required for known codes |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/pages/r/[code].astro` | `src/lib/db.ts (lookupTeamByReferralCode)` | named import | WIRED | `import { lookupTeamByReferralCode } from '../../lib/db'` line 3; called at line 22 |
| `src/pages/r/[code].astro` | `src/lib/teams.ts (teamLabel, VALID_TEAMS)` | named import | WIRED | `import { teamLabel, VALID_TEAMS } from '../../lib/teams'` line 4; both used in resolved branch |
| `src/pages/r/[code].astro` | `src/components/Layout.astro` | default import, og + noindex props | WIRED | Line 61: `<Layout title={pageTitle} og={ogProps} noindex>` |
| `scripts/render-team-og-images.mjs` | `references/og-image-team.svg` | readFileSync | WIRED | Line 35: `readFileSync(tmplPath, 'utf8')` where tmplPath points to the template |
| `scripts/render-team-og-images.mjs` | `references/teams.json` | JSON import | WIRED | Line 23: `import teams from '../references/teams.json' with { type: 'json' }` |
| `scripts/render-team-og-images.mjs` | `@resvg/resvg-js` | Resvg class | WIRED | Line 22: `import { Resvg } from '@resvg/resvg-js'` |
| `package.json scripts` | `scripts/render-team-og-images.mjs` | npm script entry | WIRED | `"og:render-teams": "node scripts/render-team-og-images.mjs"` |
| `src/pages/pending.astro` | `src/pages/r/[code].astro` | share URL `/r/CODE` | WIRED | Line 77: `location.origin + '/r/' + rc` |
| `src/pages/confirmed.astro` | `src/pages/r/[code].astro` | share URL `/r/CODE` | WIRED | Line 90: `location.origin + '/r/' + rc` |
| `src/pages/manage.astro` | `src/pages/r/[code].astro` | share URL `/r/CODE` | WIRED | Line 70: `base + '/r/' + user.referral_code` |
| `src/lib/email.ts` | `src/pages/r/[code].astro` | share URL `/r/CODE` | WIRED | Line 29: `SITE_URL + '/r/' + referralCode` |
| `scripts/smoke-signup.mjs (SHARE-r-known)` | `src/pages/r/[code].astro` | fetch GET /r/<code> | WIRED | Line 582: `fetch(\`\${BASE}/r/\${row.referral_code}\`, { redirect: 'manual' })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/pages/r/[code].astro` | `row.team` | `lookupTeamByReferralCode.get(code)` — parameterized SELECT against `vip_signups` | Yes — live SQLite read | FLOWING |
| `src/pages/r/[code].astro` | `pngExists` | `VALID_TEAMS.has(row.team)` — allow-list set built from `references/teams.json` at import time | Yes — all 48 slugs have committed PNGs | FLOWING |
| `src/pages/r/[code].astro` | `ogProps.image` | Conditional: `${SITE_URL}/og/${row.team}.png` if `pngExists`, else generic | Yes — resolves to specific team PNG for valid teams | FLOWING |

---

### Behavioral Spot-Checks

Step 7b skipped — dev server is not running and cannot be started without side effects. The smoke results documented in 15-05-SUMMARY.md (19/19 PASS post-CR-01-fix) and the commit message for `75a9114` ("Verified via dev server: /r/15b7c97m (england) -> og:image content='.../og/england.png'") serve as the best available substitute.

---

### Probe Execution

No probes declared in PLAN frontmatter. `scripts/smoke-signup.mjs` is the runtime verification harness; its execution requires a live server with a seeded DB and was confirmed at 19/19 PASS per 15-05-SUMMARY.md and the CR-01 fix commit.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OG-02 | 15-02, 15-03 | A per-team Open Graph image exists for each of the 48 World Cup teams | SATISFIED | 48 PNGs at `public/og/<slug>.png`, all 1200x630, all < 300KB, all LAND-02-clean per render-time 6-check. `references/og-image-team.svg` + `scripts/render-team-og-images.mjs` are the toolchain. |
| OG-03 | 15-01, 15-04 | A shared referral link unfurls on social platforms with the sharer's team image | SATISFIED (with human confirmation pending) | `/r/[code].astro` emits `og:image = ${SITE_URL}/og/${row.team}.png` for resolved codes; VALID_TEAMS allow-list ensures every known team resolves to its PNG. All four share-URL emit sites now produce `/r/CODE` URLs. Social unfurl behavior itself requires human validation (see Human Verification Required section). |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/manage.astro` | 352 | `'TBD'` as Astro JSX display literal | INFO | This is a sports-domain display label for matches with opponents not yet determined — not a code debt marker. Value flows to rendered HTML as visible text, intentionally. Not a blocker. |

No TBD/FIXME/XXX debt markers found in any phase-15-modified files. The `manage.astro:352` occurrence is `{m.home_tla ?? 'TBD'}` — a JSX ternary fallback string for a match display where the team three-letter abbreviation is null, not a code completion marker. No issue reference required.

Deferred warnings from 15-REVIEW.md (WR-02 through WR-07, IN-02 through IN-04) are explicitly deferred per the code review frontmatter — none are blockers for this phase's goal.

---

### Human Verification Required

#### 1. Social Platform Unfurl Test

**Test:** Using a social debugger tool (Twitter/X Card Validator at `https://cards-dev.twitter.com/validator`, LinkedIn Post Inspector, Facebook Sharing Debugger at `https://developers.facebook.com/tools/debug/`, or Slack by pasting a link in a channel), enter a production URL `https://oddlympics.app/r/<real-code>` where `<real-code>` is a valid referral code in the production DB (obtainable from a past signup confirmation email or from the production DB).

**Expected:** The card preview shows:
- Title: "Following [Team Name] · oddlympics"
- Image: the per-team PNG (e.g., a 1200x630 branded card with "Following England." as the headline), not the generic oddlympics image

**Why human:** Social-platform unfurl behavior involves bot-side HTTP scraping of `og:meta` tags, platform-side image caching, CDN behavior, and per-platform rendering. The route emits the correct meta (verified by response-body smoke at 19/19 PASS), but actual social-card rendering can only be confirmed by hitting a live social validator against production. This is SC3's real test — "the response would actually unfurl correctly in a social validator."

---

### Gaps Summary

No gaps found. All 14 must-have truths are VERIFIED.

The CR-01 blocker (FS-probe always returning false in production) was resolved in commit `75a9114` before this verification was run. The fix replaces the `existsSync` filesystem probe with a `VALID_TEAMS.has(row.team)` allow-list check — eliminating both the path-resolution bug and a per-request syscall. The smoke was simultaneously tightened (WR-01) to require the per-team PNG specifically for known codes, ensuring this class of regression cannot silently re-enter.

The only pending item is human confirmation of the actual social unfurl behavior on production — an inherently un-automatable check.

---

_Verified: 2026-05-23T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
