# Phase 15: Personalized Open Graph - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 15-personalized-open-graph
**Areas discussed:** Route shape + redirect, Per-team image design, Build & storage strategy, Phase 14 link migration + meta text

---

## Route shape + redirect

### Q1: What does `/r/CODE` return when a real human (not a social crawler) opens it?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin meta + JS bounce | Minimal HTML shell: personalized `<head>` (og:image, og:title, twitter:*) + `<meta http-equiv="refresh">` + JS `location.replace('/?ref=CODE')`. Bot scrapes meta, human bounces to existing prerendered landing within ~0ms. Smallest surface area, reuses Phase 13/14 plumbing on `/`. | ✓ |
| Full landing chrome at /r/CODE | `/r/CODE` renders the entire landing page server-side with personalized meta. No bounce. Means duplicating index.astro's markup. Cleaner URL but heavier. | |
| 302 redirect with meta scraping | `/r/CODE` returns 302 to `/?ref=CODE`. Crawlers generally follow but the og:* they scrape is generic. Loses personalization — non-starter for SC3. | |

**User's choice:** Thin meta + JS bounce → D-01

### Q2: How should `/r/CODE` behave when CODE doesn't resolve (unknown/malformed/expired/typo)?

| Option | Description | Selected |
|--------|-------------|----------|
| Bounce to / with generic OG | Same thin shell, generic /og-image.png, no team in title, bounce to / (no ?ref=). Stale links never 404. Matches Phase 13 "signup never rejects". | ✓ |
| Bounce to /?ref=CODE anyway | Same shell, generic OG, but bounce keeps ?ref= so referred_by can still attribute. Phase 13 D-07 silently ignores unresolved refs. | |
| 404 | Return 404 on unknown code. Strict but breaks unfurls for any link that ever leaves circulation. | |

**User's choice:** Bounce to / with generic OG → D-02

### Q3: If a user unsubscribes after their referral link has been shared, what should `/r/CODE` do for that code?

| Option | Description | Selected |
|--------|-------------|----------|
| Still personalize | Resolve code → team → personalized OG. Phase 14 D-17 hides share UI in `/manage` unsub branch but doesn't invalidate previously shared links. | ✓ |
| Fall back to generic | Treat unsubscribed codes like unknown codes. Stricter but punishes the sharer retroactively. | |

**User's choice:** Still personalize → D-03

### Q4: How should the route file be organized in `src/pages/`?

| Option | Description | Selected |
|--------|-------------|----------|
| src/pages/r/[code].astro | Astro dynamic-route pattern with `prerender = false`. Reads Astro.params.code, resolves via lookupByReferralCode, renders thin shell. Idiomatic Astro. | ✓ |
| src/pages/r/[code]/index.astro | Same mechanics, nested one level deeper. No functional difference. | |
| API route returning HTML | `src/pages/api/r.ts` hand-builds HTML string. Diverges from .astro patterns. | |

**User's choice:** src/pages/r/[code].astro → D-04

---

## Per-team image design

### Q1: How are the 48 team OG images authored at the source level?

| Option | Description | Selected |
|--------|-------------|----------|
| One parameterized SVG template | `references/og-image-team.svg` with a `{{TEAM_LABEL}}` token. New script loops teams.json, substitutes, feeds resvg. 48 outputs from one source. | ✓ |
| Per-team SVG files | Author 48 individual `references/og-team/<slug>.svg` files. Maximum art freedom but 48 files to maintain. | |
| Programmatic SVG (JS-built string) | Build SVG as a template literal inside the render script. Cheapest but loses WYSIWYG debug loop. | |

**User's choice:** One parameterized SVG template → D-05

### Q2: What visually changes per team in the personalized OG image?

| Option | Description | Selected |
|--------|-------------|----------|
| Team name in the headline | Same chrome, single text swap. No color/glyph changes. Cheapest, trim-safe. | ✓ |
| Team name + accent color | Adds a primaryColor field to teams.json. ~1 hour of color picking. | |
| Team name + flag block | Per-team flag art. Most personal but requires drawing 48 flags or accepting emoji inconsistency. | |
| You decide | Let the planner pick during research. | |

**User's choice:** Team name in the headline → D-06

### Q3: Headline copy for the per-team OG image?

| Option | Description | Selected |
|--------|-------------|----------|
| Following USA. + Every match. + One ping. | "Following USA. / Every match in your zone. / One ping before kickoff." Three lines, editorial-minimalist. Line 3 in accent color. | ✓ |
| USA's matches. + In your zone. + One ping. | Possessive swap closer to today's generic copy. Reads awkwardly for long names. | |
| I'm following USA. + + Get yours. | First-person, matches Phase 14 share text voice. Slightly chattier than house style. | |

**User's choice:** Following USA. + Every match. + One ping. → D-07

### Q4: How should the headline render for long team names (e.g. "Bosnia and Herzegovina" = 22 chars)?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scale font size | Renderer computes `font-size = labelLen <= 12 ? 64 : labelLen <= 16 ? 52 : 44`. Same template, attribute swap. No per-team config. | ✓ |
| Wrap to two lines for long names | 4-line layout for long names. Breaks 3-line cadence. | |
| Short-label override field | Add optional `shortLabel` to teams.json for ~5 long-name teams. Cleanest visual but manual editorial. | |

**User's choice:** Auto-scale font size → D-08

---

## Build & storage strategy

### Q1: Where do the 48 PNGs live, and when are they generated?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit to public/og/<slug>.png | Render once via `npm run og:render-teams`, commit 48 PNGs. Same Phase 8 pattern. ~4–7MB in git. Deploy unchanged. | ✓ |
| Gitignore + regenerate at build | `.gitignore` public/og/, render at `npm run build` in deploy.yml. Saves git bytes but CI must always succeed. | |
| Render server-side on first request | Cache to disk on first hit per team. Adds runtime resvg, cold-render latency. Overkill. | |

**User's choice:** Commit to public/og/<slug>.png → D-09

### Q2: When a per-team PNG doesn't exist on disk, where does the fallback to generic `/og-image.png` get decided?

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime existsSync check | `/r/CODE` frontmatter does `existsSync('public/og/<slug>.png')`. Missing → og:image = /og-image.png. Title/description still personalize. Ships with partial coverage. | ✓ |
| Build-time manifest | Renderer writes a manifest file listing rendered slugs. Route imports manifest. Same outcome, more moving parts. | |
| All-or-nothing | Don't ship the route until all 48 PNGs render. Strict but loses the "personalized title even when image is generic" middle ground SC4 calls out. | |

**User's choice:** Runtime existsSync check → D-10

### Q3: Render script: extend the existing one or write a new one?

| Option | Description | Selected |
|--------|-------------|----------|
| New scripts/render-team-og-images.mjs | Sits alongside `render-og-image.mjs`. Reuses Resvg config + per-PNG verification. New `npm run og:render-teams` script. Generic OG render untouched. | ✓ |
| Extend scripts/render-og-image.mjs | One script renders both. Less duplication but couples concerns and risks the stable generic artifact. | |

**User's choice:** New scripts/render-team-og-images.mjs → D-11

### Q4: How does Phase 15 verify the route + image pipeline works end-to-end?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend smoke-signup.mjs + render-time PASS counter | (a) Render script prints `N/48 PASS` and exits 1 on fail. (b) Smoke gets two new cases: GET /r/<known-code> + GET /r/notarealcode response-body greps. Same Phase 14 D-18 contract. | ✓ |
| Manual unfurl validation only | Operator pastes a production link into the Facebook OG debugger / Twitter validator. Validates real unfurl path but no regression net. | |
| Both | Smoke in CI + manual unfurl checklist in 15-VALIDATION.md. Belt-and-suspenders. | |

**User's choice:** Extend smoke-signup.mjs + render-time PASS counter → D-12

---

## Phase 14 link migration + meta text

### Q1: Does Phase 15 migrate Phase 14's share URLs to `/r/CODE`?

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate all four surfaces | Change shareUrl builders in pending.astro:77, confirmed.astro:90, manage.astro:70, email.ts:29 to `${PUBLIC_SITE_URL}/r/${code}`. Old links keep working via Phase 13. | ✓ |
| Add /r/CODE alongside, leave Phase 14 surfaces | Route exists but unused by project's own share flow. | |
| Migrate everything except the email | Some email clients warn on short-URL paths. Loses personalized unfurl on forwarded confirmation emails. | |

**User's choice:** Migrate all four surfaces → D-13

### Q2: og:title and og:description on `/r/CODE`?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the image headline | og:title = "Following USA · oddlympics"; og:description = "Every World Cup match in your time zone. One ping before kickoff." Consistent with image. | ✓ |
| Mirror Phase 14 share text | og:title = "I'm following USA — World Cup kickoff alerts". First-person voice. Slightly off-key vs. image. | |
| Image-only personalization | Meta stays generic; only image varies. Half-personalized unfurl. | |

**User's choice:** Mirror the image headline → D-14

### Q3: What does the body of `/r/CODE` render (briefly visible during bounce, plus no-JS users)?

| Option | Description | Selected |
|--------|-------------|----------|
| Layout chrome + redirect notice | `<Layout>` with single-line "Redirecting… if you're not redirected, tap here." Consistent chrome for no-JS users. | ✓ |
| Empty `<body>` | Truly minimal, no chrome flash. Hostile fallback. | |
| Standalone html (skip Layout.astro) | Hand-write entire HTML doc. Smallest payload but diverges from codebase pattern. | |

**User's choice:** Layout chrome + redirect notice → D-15

---

## Claude's Discretion

Areas where Phase 15 lets the planner / executor choose:
- Whether to fire a Plausible custom event on `/r/CODE` server-render.
- Exact placement / styling of the redirect notice in the body.
- Whether the slug → label lookup in the route calls `teamLabel` directly or via a thin `og.ts` helper.
- Plan/wave split (suggested 3-wave structure in CONTEXT.md D-area).
- Iteration order of `references/teams.json` in the render script (cosmetic).
- Choice of `fileURLToPath` vs. other path-resolution idiom for the existsSync check (planner picks the one consistent with `db.ts`'s SQLite-path approach).

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:
- Per-team accent color (post-launch polish if A/B testing warrants).
- Per-team flag block art (post-launch).
- 301 forward from `/?ref=CODE` to `/r/CODE` (canonicalization — only if old-link unfurl quality becomes a measured pain point).
- Plausible custom event on `/r/` (Discretion now, post-launch quick-add if not done).
- Short-label override field on `references/teams.json` (only if a future team renders awkwardly at the smallest font bucket).
- Refactor `render-og-image.mjs` to share helpers with the team-render script (only if a third image-render need appears).
- REF-F1 / REF-F2 (Future Requirements — unchanged from Phase 14 deferred list).

None new from discussion that don't fit existing roadmap / Future Requirements buckets.
