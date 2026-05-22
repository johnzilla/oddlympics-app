# Phase 14: Share Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 14-share-experience
**Areas discussed:** Code → prerendered pages, Share button UX, Share copy (flag emoji, template scope, exact wording), Email share placement

---

## Area Selection

Presented 4 phase-specific gray areas. User selected **all 4** via multiSelect.

| Area | Selected |
|------|----------|
| Code → prerendered pages | ✓ |
| Share button UX | ✓ |
| Share copy | ✓ |
| Email share placement | ✓ |

---

## Code → prerendered pages

How `/pending` and `/confirmed` get the user's `referral_code`, since both are `prerender = true` and currently know only `?email=` / `?status=`.

| Option | Description | Selected |
|--------|-------------|----------|
| Append `?rc=CODE` in redirect | `/api/signup` and `/api/confirm` append `&rc=${code}` to their existing 303s. Inline script reads it and writes the share link. Pages stay prerendered + CDN-cacheable. | ✓ |
| Drop prerender, server-render both | Make `/pending` and `/confirmed` `prerender = false`, look up the user by `?email=` server-side. Loses CDN caching for two highest-funnel pages; adds DB-on-render. | |
| Tiny GET endpoint, fetched client-side | `/api/my-ref?email=...` returns the code; inline script fetches. Privacy footgun (unauthenticated email→code lookup); authenticated version round-trips the magic-link flow. | |

**User's choice:** Append `?rc=CODE` in redirect.
**Notes:** Matches the established URL-param + inline-script pattern Phase 13 just used for `?ref=`. `upsertVipSignup`'s `RETURNING *` (db.ts:140-151) already hands `/api/signup` the row so no extra read. `/api/confirm` resolves email → code via `getByEmail`.

---

## Share button UX

When `navigator.share` isn't available (most desktop browsers), what's the fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible URL + Copy button | Readonly `<input>` showing the link + `Copy` button. Click → native share on mobile / `clipboard.writeText` + "Copied!" pill on desktop. User can also manually select URL if clipboard fails. | ✓ |
| Single share button, copy on fallback | Just `<button>Share</button>`. Mobile → sheet. Desktop → silent copy + flash. Tighter, but user has to trust the button on desktop without seeing the URL. | |
| Copy button + tiny mailto fallback | Visible URL + Copy as primary, plus a small `mailto:` "Email it" link as third-tier fallback for clipboard-refused contexts. | |

**User's choice:** Visible URL + Copy button.
**Notes:** Same component everywhere (3 pages). Same feature-detection idiom as existing `Intl.supportedValuesOf` guards. Manual-select fallback covers private-mode Safari without needing a third UI surface.

---

## Share copy — flag emoji?

`references/teams.json` has no `flag` field today. Adding one is a one-time data load + a small maintenance surface.

| Option | Description | Selected |
|--------|-------------|----------|
| No flag | Text-only. Matches editorial-minimalist house style, dodges Windows flag rendering bugs, no schema/data change. Team name alone satisfies SC4. | ✓ |
| Add `flag` to teams.json | Closer to PROJECT.md's aspirational example. New field, 48 entries to maintain, regional-flag edge cases. | |

**User's choice:** No flag.
**Notes:** Editorial-minimalist consistent with the rest of the v2.0 surface (no emoji on the landing either, beyond the existing sport-acc accordions on `/manage`).

---

## Share copy — single template or per-surface variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Single template in `src/lib/copy.ts` | One `shareText(teamLabel, url)` helper, consumed by 3 pages + email. One string to tweak, guaranteed consistent. Matches how `NO_ACCOUNT_TITLE` etc. already live. | ✓ |
| Per-surface variants | Slightly different copy per page. More authentic-feeling per context; 3-4 strings to maintain. | |

**User's choice:** Single template in `src/lib/copy.ts`.

---

## Share copy — exact wording

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap variant | `I'm following USA — get your team's World Cup kickoff alerts.\noddlympics.app/?ref=k7m2qx9a` — verbatim from Phase 14 SC4 example. Em-dash, second-person CTA, URL on its own line. | ✓ |
| Single line, casual | `Following USA at the World Cup. Get your team's kickoff alerts: oddlympics.app/?ref=k7m2qx9a` — colon before URL, less formal. | |
| Two sentences, matter-of-fact | `I just signed up for World Cup kickoff alerts for USA. Get your team's alerts at oddlympics.app/?ref=...` — explicit signup mention as social proof. | |

**User's choice:** Roadmap variant.
**Notes:** Locks the SC4 example. Actual URL written is `https://oddlympics.app/?ref=...` (full scheme for SMS / X auto-linking); the schemeless `oddlympics.app/?ref=...` form is a display abbreviation only.

---

## Email share placement

Where in the confirmation email body (`sendMagicLink`) does the share line live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline paragraph after confirm button | Plain `<p>` immediately after the `Confirm email` button. Soft secondary nudge; doesn't compete with the primary confirm action. Mirror in plaintext. | ✓ |
| Second colored callout box | Match the existing `NO_ACCOUNT_TITLE` callout visual style with a parallel share-themed box. Highest visual weight; two boxes risks "busy" email. | |
| Footer-style one-liner | Small line near the unsubscribe disclaimer. Cleanest; lowest action rate. | |
| Replace bottom of existing callout | One dual-purpose callout (NO_ACCOUNT + share + two stacked CTAs). Tighter; conflates two distinct nudges. | |

**User's choice:** Inline paragraph after confirm button.
**Notes:** Preserves the existing `NO_ACCOUNT_TITLE` callout as the primary re-entry nudge. Share is secondary — a `<p>` placed at `email.ts:63-65` next to the confirm button, mirrored in the `text` array at `:29-45`.

---

## Claude's Discretion

Logged in CONTEXT.md `<decisions>` Claude's Discretion section:

- Component vs inline-duplicated share markup across the three pages.
- Exact `text + '\n' + url` vs `url + '\n' + text` composition for clipboard fallback.
- Whether to fire a Plausible `Share Click` custom event (recommended; not blocking).
- Plan/wave split (suggested: copy + email + API redirects in Wave 1; share UI on three pages in Wave 2; smoke extensions in Wave 3).
- Whether `/api/signup` also appends `&team=` to the `/pending` redirect so the inline script can personalize the share-card heading with the team name, or whether the heading stays generic.
- Heading micro-copy ("Share with a friend" vs alternatives).
- "Copied!" flash duration and any aria-live announcement details.

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- Per-team OG image + `/r/CODE` server-rendered route → **Phase 15** (OG-02, OG-03).
- "You've referred N friends" counter on `/manage` → **REF-F1** (Future Requirements).
- Referral leaderboard / rewards → **REF-F2** (Future Requirements).
- Per-network intent buttons (X / WhatsApp / Email) → revisit only if share rate is measurably low post-launch.
- `flag` field on `references/teams.json` → revisit if Phase 15's per-team OG image isn't enough visual punch.
- Plausible `Share Click` custom event → listed as Claude's Discretion; defer to post-launch if planner has no capacity.

None new from discussion that don't fit existing buckets — discussion stayed within phase scope.
