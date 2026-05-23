---
phase: 15-personalized-open-graph
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - package.json
  - scripts/render-team-og-images.mjs
  - scripts/smoke-signup.mjs
  - src/lib/db.ts
  - src/lib/email.ts
  - src/pages/confirmed.astro
  - src/pages/manage.astro
  - src/pages/pending.astro
  - src/pages/r/[code].astro
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
  resolved: 3
  deferred: 9
status: partial
resolution:
  CR-01: resolved (commit fixing FS-probe → VALID_TEAMS allow-list)
  WR-01: resolved (smoke now requires per-team og:image specifically)
  IN-01: resolved (misleading comment removed with FS probe)
  WR-02: deferred (render coverage check — post-launch hardening)
  WR-03: deferred (Cache-Control on /r/[code] — perf, not correctness)
  WR-04: deferred (tmp-file leak on SIGTERM — minor cleanliness)
  WR-05: deferred (?? '' dead defense in signup.ts — readability)
  WR-06: deferred (share-card duplication across 3 pages — Layout-style extraction)
  WR-07: deferred (TEAM_LABEL_JSON size on /pending — acceptable for v1)
  IN-02: deferred (copyFallback dup — resolves with WR-06)
  IN-03: deferred (SELECT can narrow to just `team` — readability)
  IN-04: deferred (og:url provenance on unresolved branch — minor analytics)
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Adversarial review of the Phase 15 personalized-open-graph implementation at
standard depth. Focus areas: XSS / path-traversal in `src/pages/r/[code].astro`,
SQL safety of the new `lookupTeamByReferralCode` statement, shell-arg safety in
the per-team OG render script, URL composition in the four migrated share-URL
emit sites, and cross-file regressions in Phase 13/14 reference plumbing.

**Headline finding (CR-01):** the per-team OG image will never reach a social-card
scraper in production because `repoRoot` resolves to `<deploy>/dist/`, not the
repo root, so the `existsSync` probe at `r/[code].astro:41` always returns false
and the route silently falls through to the generic `/og-image.png`. The Phase 15
smoke (`SHARE-r-known`) does not catch this because its assertion accepts the
fallback PNG as PASS. The whole milestone deliverable is dead on arrival in prod.

Security posture is otherwise solid: the new prepared statement is correctly
parameterized; the `/r/[code]` shape gate (`/^[a-z0-9]{8}$/`) is applied before
any DB lookup or HTML echo; the `execSync` `grep` invocation in the render
script uses `JSON.stringify` to quote its argv; the share-card DOM writes use
`textContent`/property assignment everywhere. No XSS, SQL-injection, path-
traversal, or open-redirect vector found.

Other warnings concern test coverage (smoke accepts the fallback), render-script
coverage gaps, per-page share-card duplication, and a dead `?? ''` guard. Info
items flag stale comments, narrowable SELECTs, and minor information design.

## Critical Issues

### CR-01: `repoRoot` resolves to `dist/`, not the repo root — per-team OG `existsSync` probe always returns false in production

**File:** `src/pages/r/[code].astro:24-26,41`

**Issue:** The route resolves the repo root from `import.meta.url`:

```ts
const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../../');
const pngExists = existsSync(resolve(repoRoot, 'public/og', row.team + '.png'));
```

The comment claims this is `src/pages/r/[code].astro` → 4 levels up = repo root.
That is true **at build time only**. At runtime, Astro bundles this route to
`dist/server/pages/r/_code_.astro.mjs` (verified against the built artifact).
Resolving `../../../../` from that lands on `<deploy-root>/dist`, not the repo
root. With production `WorkingDirectory=/opt/oddlympics` (`deploy/oddlympics.service:15`),
`repoRoot` at runtime is `/opt/oddlympics/dist`.

Astro copies `public/` into `dist/client/` at build time — not `dist/public/`.
The actual on-disk location of every PNG in production is
`/opt/oddlympics/dist/client/og/<team>.png`. The probe checks
`/opt/oddlympics/dist/public/og/<team>.png` and **always returns false**.

Verified locally: the built `dist/` has PNGs at `dist/client/og/*.png` and no
`dist/public/og/` directory exists.

**Impact:** Phase 15's headline deliverable — personalized OG images for shared
links — never fires in production. Every social-card scraper (Twitter, Facebook,
LinkedIn, Slack, Discord, iMessage, Telegram) that hits `/r/<code>` is served
the generic `og-image.png` via the trim-fallback (D-10) branch. The personalized
og:title still works (it doesn't depend on `pngExists`), but the OG IMAGE — the
whole point of rendering 48 per-team PNGs in Plan 15-03 — is dead.

The `SHARE-r-known` smoke (`scripts/smoke-signup.mjs:574-602`) accepts the
fallback as PASS (`smoke-signup.mjs:589-591`), so this regression slipped
through. See also WR-01.

**Fix:** Probe a path that exists at runtime. Either:

(a) Use Astro's actual client output directory:

```ts
// Astro copies public/ → dist/client/ at build time; in dev (astro dev),
// the source still serves public/ directly. Handle both.
const pngExists =
  existsSync(resolve(repoRoot, 'client/og', row.team + '.png')) ||  // prod (repoRoot = dist/)
  existsSync(resolve(repoRoot, 'public/og', row.team + '.png'));    // dev fallback
```

(b) Better: stop relying on filesystem probing at request time. The set of
shipped PNGs is known at build time and tracked in `references/teams.json`:

```ts
import { VALID_TEAMS } from '../../lib/teams';
// Every team in references/teams.json has a corresponding rendered PNG,
// enforced by scripts/render-team-og-images.mjs.
const pngExists = row.team !== null && VALID_TEAMS.has(row.team);
```

This removes the FS probe entirely, eliminating both the path-resolution bug
and a per-request `stat()` syscall.

Pair the fix with WR-01 so the smoke test catches a future regression.

## Warnings

### WR-01: `SHARE-r-known` smoke accepts the fallback OG image as PASS, hiding personalization regressions

**File:** `scripts/smoke-signup.mjs:589-595`

**Issue:**

```js
const hasOgImage =
  body.includes('og:image" content="') &&
  (body.includes(`/og/${row.team}.png`) || body.includes('/og-image.png'));
```

The OR on the second clause means a regression that silently downgrades every
request to the generic image — exactly the CR-01 scenario — still passes this
assertion. The case is labelled `D-12b: personalized og:image` but does not
actually require personalization. This is why CR-01 was not caught during
phase execution.

**Fix:** Drop the fallback alternative for the known-code case:

```js
const hasOgImage =
  body.includes('og:image" content="') && body.includes(`/og/${row.team}.png`);
if (!hasOgImage) {
  console.error(`  expected per-team og:image /og/${row.team}.png, got fallback or missing`);
  return false;
}
```

Keep the generic-only assertion on `SHARE-r-unknown` (already correct).

### WR-02: Render script does not verify every team in `references/teams.json` has a corresponding PNG

**File:** `scripts/render-team-og-images.mjs:47-120`

**Issue:** The script verifies each just-rendered PNG, but if `references/teams.json`
later gains a team without re-running the script, `public/og/<new_slug>.png`
is missing, with no CI check that catches it (acknowledged at lines 6-8). The
smoke at `smoke-signup.mjs:582` uses `LIMIT 1` and may not select the row with
the missing PNG, so the gap doesn't surface there either.

**Fix:** Add a coverage assertion at the end of the script, independent of which
PNGs were rendered this run:

```js
let coverageFail = 0;
for (const team of teams) {
  const p = resolve(outDir, `${team.slug}.png`);
  if (!existsSync(p)) {
    console.error(`[og:render-teams] coverage FAIL: missing ${p}`);
    coverageFail++;
  }
}
if (coverageFail > 0) process.exit(1);
```

Costs ~1ms; catches the "added a team, forgot to re-render" foot-gun the
README warning already admits exists.

### WR-03: `/r/[code]` bypasses CDN cache — per-request DB lookup + FS probe for effectively static-per-code content

**File:** `src/pages/r/[code].astro:9,29-31,41`

**Issue:** Every share-link click — including every social-card scraper crawl
— hits the Node server, opens a SQLite read, and calls `existsSync`. For a
launch-day blast the `/r/` route becomes the hottest endpoint on a single
$6/mo droplet, and no `Cache-Control` headers are set so Caddy / upstream
caches can't absorb it.

The data is effectively immutable per code (once signed up, a user's team
and code don't change without intervention). A `Cache-Control: public,
max-age=300` would let Caddy absorb a scraper storm.

Performance is out of v1 scope, but a launch-day request flood that drops
real share-card previews is a correctness failure too.

**Fix:**

```astro
---
// at top of /r/[code].astro
Astro.response.headers.set('Cache-Control', 'public, max-age=300');
---
```

5 minutes is probably fine — user-team changes are rare and stale cards harmless.

### WR-04: Per-team SVG temp files can leak on script crash

**File:** `scripts/render-team-og-images.mjs:106-119`

**Issue:** `unlinkSync(tmpSvg)` is in `finally`, which is fine for normal flow.
But if the script is killed (Ctrl-C, OOM, SIGTERM) between `writeFileSync(tmpSvg, ...)`
(line 107) and the inner `finally`, the tmp file leaks. The `process.pid`
suffix bounds the leak, but `os.tmpdir()` accumulates orphans across crashes.

Minor cleanliness issue, not a security or correctness defect. Worth tightening
only if the script ever runs in CI.

**Fix:** Either widen the try/finally to cover the SVG render too, or accept
the bounded leak. Suggested rewrite:

```js
const tmpSvg = resolve(tmpdir(), `og-team-${slug}-${process.pid}.svg`);
try {
  writeFileSync(tmpSvg, svg);
  // ... render + outPath write + checks
  execSync(/* ... */);
  check(slug, 'land-02-clean', true);
} catch {
  check(slug, 'land-02-clean', false);
} finally {
  try { unlinkSync(tmpSvg); } catch {}
}
```

### WR-05: `signup.ts:165` passes `''` to `sendMagicLink` if `row.referral_code` is null — would produce a 404 `/r/` link in the outbound email

**File:** `src/pages/api/signup.ts:165`

**Issue:**

```ts
await sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code ?? '');
```

If `row.referral_code` were ever `null` (the type permits it, `db.ts:125`),
`sendMagicLink` builds `shareUrl = SITE_URL + '/r/' + ''` = `https://oddlympics.app/r/`
— a 404. The `signup.ts:157-160` guard does narrow `row.referral_code` to
non-null before this line, so the `?? ''` is dead defense — but it muddles
the call site. Either the `??` is genuinely defending against something
(in which case the user gets a broken share link in their confirmation
email) or it's not (in which case it should be removed).

**Fix:** Drop the `?? ''`. The line 157 guard already narrowed to non-null:

```ts
await sendMagicLink(rawEmail, token, rawTeam, tz, row.referral_code);
```

This matches the explicit guard style in `manage.astro:68-73`.

### WR-06: Duplicate share-card markup, CSS, and JS across `pending.astro`, `confirmed.astro`, and `manage.astro`

**Files:**
- `src/pages/pending.astro:52-128`
- `src/pages/confirmed.astro:18-137`
- `src/pages/manage.astro:310-336,480-519`

**Issue:** Three identical CSS blocks for `.share-card`, three near-identical
share-button click handlers (same AbortError handling, same `copyFallback`,
same `Copied!` UX), and three sets of identical element IDs. A future tweak
to share UX (e.g., AbortError fallback fix, analytics ping) requires editing
three files in lockstep.

This is exactly the "per-page CSS duplication is what let the dark/light theme
drift" pattern called out in `CLAUDE.md` as justification for the Layout.astro
extraction. Same risk class.

**Fix:** Extract a `<ShareCard>` Astro component receiving `shareUrl` and
`shareText` props; move both the markup and the inline click handler into the
component. Alternatively accept the duplication for v1 and explicitly schedule
an extraction post-launch.

### WR-07: `pending.astro` inlines the full 48-entry `TEAM_LABEL_JSON` map on every prerendered response

**File:** `src/pages/pending.astro:7-10,68`

**Issue:** Every visit to `/pending` — with or without `?team=` — ships the
slug→label map inline via `define:vars`. ~2KB raw (~600 bytes gzipped) per
response, including link-preview fetches and direct visits without share
params. The map exists for a single optional code path.

**Fix:** Either accept the cost (it gzips small; probably fine for v1) or
switch `/pending` to `prerender = false` so the frontmatter can inline only
the requested slug's label. Trade-off: loses CDN cache on `/pending`. For v1
the 2KB cost is acceptable — document the trade-off so a future reader
doesn't mistake it for a mistake.

## Info

### IN-01: Misleading comment in `/r/[code].astro:23-26` describes source-tree path, not runtime path

**File:** `src/pages/r/[code].astro:23-26`

**Issue:** The comment "`fileURLToPath(import.meta.url) is src/pages/r/[code].astro
→ 4 levels up = repo root`" describes the source layout. Even after CR-01 is
fixed, this comment will mislead the next auditor who traces the source path
and concludes (incorrectly) the math is right.

**Fix:** When fixing CR-01, replace with:

```ts
// At runtime this file lives at dist/server/pages/r/_code_.astro.mjs;
// resolving '../../../../' lands on <deploy>/dist, not the repo root.
// Probe dist/client/og/ (where Astro copies public/) — not public/og/.
```

### IN-02: `pending.astro` and `confirmed.astro` re-declare `copyFallback` byte-identical — easy to drift

**Files:**
- `src/pages/pending.astro:99-108`
- `src/pages/confirmed.astro:107-116`

**Issue:** Two identical functions in two prerendered pages. Phase 14 origin.
Minor — but increases the chance one is fixed and the other isn't. Same class
as WR-06; flagged separately so the fix-time reviewer can pick the cheapest
dedup path (e.g., a `/share.js` external module load) without rewriting the
whole share-card extraction.

**Fix:** Resolve as part of WR-06 — move both `copyFallback` and the
`navigator.share` click handler into the shared `<ShareCard>` component.

### IN-03: `lookupTeamByReferralCode` SELECTs `referral_code` even though only `team` is consumed

**File:** `src/lib/db.ts:181-183`

**Issue:**

```sql
SELECT referral_code, team FROM vip_signups WHERE referral_code = ?
```

The caller (`r/[code].astro:30-31`) types the row as
`{ referral_code: string; team: string | null }` but only reads `row.team`
from line 37 onward. The redundant column reads suggest the statement was
copy-paste-adapted from `lookupByReferralCode` without trimming.

**Fix:** Narrow to `SELECT team FROM …` and update the type cast at
`r/[code].astro:30-31` to `{ team: string | null } | undefined`. Trivial
readability win, no behavior change.

### IN-04: `og:url` for unknown-code path loses share-link provenance

**File:** `src/pages/r/[code].astro:50-60`

**Issue:** For a shape-invalid or unresolved code, `ogProps.url` is set to
`${SITE_URL}/`. A scraper that follows the original URL `${SITE_URL}/r/somecode`
gets back a card whose `og:url` claims it's actually `${SITE_URL}/`. Mildly
confusing for analytics / preview canonicalization but not a defect.

**Fix:** Preserve the share-URL as the canonical identity even on the unknown
branch:

```ts
url: `${SITE_URL}/r/${code || encodeURIComponent(rawCode)}`,
```

(Or, simpler: `${SITE_URL}/r/${code || ''}` to keep it tied strictly to a
sanitized input. The trade-off is a slightly less-useful card for failed
codes vs. preserved share-URL identity.)

## Negative-Result Audit

Security-sensitive areas explicitly checked and cleared:

- **Path traversal in `/r/[code].astro`:** The `CODE_SHAPE = /^[a-z0-9]{8}$/`
  regex rejects any input containing `.`, `/`, or `\`, so `row.team` is the
  only DB-sourced value flowing into `resolve(...)`. `row.team` is
  COALESCE-protected and originates from the `VALID_TEAMS` server-side allow-
  list at signup time (`signup.ts:78`). The path is safe — but see CR-01:
  the path is *wrong*, just not traversable.

- **SQL injection in `lookupTeamByReferralCode`:** Parameterized prepared
  statement via `db.prepare<[string]>`. Safe.

- **Shell injection in `render-team-og-images.mjs`:** `tmpSvg` filename is
  `og-team-<slug>-<pid>.svg` where `slug` is `[a-z0-9_]` (constrained at the
  `references/teams.json` source) and `pid` is a number. The path is then
  JSON-quoted into the `grep` argv via `JSON.stringify`. Safe.

- **XSS in share-card pages (`pending.astro`, `confirmed.astro`,
  `manage.astro`):** All use `textContent` or DOM-property assignment
  (`urlInput.value = …`) — never `innerHTML`. The `teamLabel` is looked up
  from a server-side allow-list (`TEAMS` array) in `pending.astro:79` and
  from the typed `user.team` in `manage.astro:70`. Safe.

- **XSS in `/r/[code]` HTML output:** `bounceUrl` is `'/?ref=' + code` where
  `code` matches `[a-z0-9]{8}` or is `'/'` literal. Embedded in
  `meta http-equiv="refresh"` content and in a `define:vars` JSON-serialized
  script var — both safely encoded by Astro. Safe.

- **Open redirect via `bounceUrl`:** Always a same-origin relative path
  (`/` or `/?ref=<shape-gated-code>`). Safe.

- **SVG injection in OG render template:** Verified all 48 team labels in
  `references/teams.json` contain no XML-special characters (no `<`, `>`,
  `&`, `"`, `'`). Latent risk if a future team label adds `&` or `<` —
  worth a check in `references/teams.json` validator if one exists, or a
  README note alongside the script's existing label-cleanliness comment.

- **Smoke-test rate-limit accounting:** New SHARE-r-* cases use `SHARE_IP`
  correctly; the IP-slot math comment (`smoke-signup.mjs:632-640`) is still
  accurate after the Phase 15 additions.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
