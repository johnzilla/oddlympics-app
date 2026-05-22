# Phase 14: Share Experience - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the referral codes Phase 13 mints into actual referral traffic — surface
each signed-up user's personalized share link, in every natural place, with
copy that names their team and a UI that hits the native share sheet where
available and falls back to copy-link everywhere else.

In scope:
- A reusable share component (visible URL + Copy button + Web Share API on
  capable devices) embedded in `/pending`, `/confirmed`, and the signed-in
  branch of `/manage`.
- Transport of the user's `referral_code` to the two prerendered pages
  (`/pending`, `/confirmed`) via a new `&rc=CODE` query param appended by
  `/api/signup` and `/api/confirm` to their existing 303 redirects. Inline
  `<script is:inline>` reads `?rc=` and writes it into the share UI's URL —
  same pattern as the existing `?error=` / `?email=` / `?status=` tricks.
- A single `shareText(teamLabel, url)` template in `src/lib/copy.ts` consumed
  by all four surfaces (3 pages + email).
- A share line in the confirmation email — plain `<p>` immediately after the
  existing `Confirm email` button in the HTML, mirrored in the plaintext part.
- The email path: `sendMagicLink` accepts the user's `referral_code` and
  composes both the share URL and the share text from it.

Out of scope (locked / deferred):
- **No referral count / "you've referred N friends" display** — REF-F1
  (Future Requirements).
- **No leaderboard, rewards, milestone unlocks** — REF-F2 + REQUIREMENTS.md
  "Out of Scope".
- **No per-team OG image / `/r/CODE` server-rendered route** — that's
  **Phase 15** (OG-02, OG-03). For Phase 14, every shared link is the
  generic `/?ref=CODE` carry-through; OG image stays the existing
  `/og-image.png`.
- **No new auth surface** — `/pending` and `/confirmed` already learn the
  user via URL params; the new `?rc=` is a public short code (per
  PROJECT.md Key Decision), not session material.
- **No referral analytics dashboard** — REQUIREMENTS.md "Out of Scope". The
  `DEPLOY.md` Day-2 query from Phase 13's D-15 already counts referred
  signups.
- **No share UI in the unsubscribed branch of `/manage`** (manage.astro
  `valid && isUnsubscribed`). A user who actively unsubscribed should not
  be prompted to recruit.
- **No flag emoji in shared message** — `references/teams.json` has no
  `flag` field; not adding one in this phase.
- **No per-network intent buttons** (X / WhatsApp / Email mailto:) — the
  native share sheet covers those on mobile; visible URL + Copy covers
  desktop. No platform-specific buttons.

</domain>

<decisions>
## Implementation Decisions

### Referral-code transport to prerendered pages

- **D-01:** `/api/signup` appends `&rc=${row.referral_code}` to its existing
  `/pending?email=...` 303 redirect. The code is already available — the
  current `upsertVipSignup` returns the row via `RETURNING *` (db.ts:140-151),
  so the handler holds the canonical, COALESCE-protected code. No extra DB
  read.
- **D-02:** `/api/confirm` appends `&rc=${row.referral_code}` to its
  `/confirmed?status=ok` 303 (and the `status=already` 303 too — a re-clicker
  is still a signed-up user who deserves their share link). The `bad-token`
  and `unknown` statuses skip `rc` because there's nothing meaningful to
  share. Confirm currently has the email from the verified token; it must
  resolve email → code via `getByEmail` (already in `db.ts:168-170`) to set
  `rc`.
- **D-03:** Both prerendered pages get a defensive inline `<script is:inline>`
  block that reads `?rc=` and, if present, populates the share UI's URL.
  Wrapped in `try/catch` like the existing `?error=` / `?email=` blocks. If
  `?rc=` is absent (direct-URL visit, malformed redirect), the share UI
  hides itself rather than showing a broken/empty link — graceful no-op.
- **D-04:** No localStorage interaction for the user's *own* code.
  `localStorage.oddlympics_ref` (from Phase 13 D-11) stores the *incoming*
  referrer's code only — different scope, do not conflate. A user who
  reloads `/pending` without `?rc=` does not see the share UI; this is
  acceptable because the natural entry path always carries `?rc=`.

### Share UI behavior

- **D-05:** Single reusable surface for share, repeated across `/pending`,
  `/confirmed`, and `/manage` (signed-in, not-unsubscribed branch):
  a visible `<input readonly>` with the full `https://oddlympics.app/?ref=CODE`
  URL, an adjacent `<button>Copy</button>`, and a short label/heading above
  (e.g. "Share with a friend"). Implemented as a small reusable Astro
  component or as inline markup duplicated three times — planner's call
  (see Discretion).
- **D-06:** Button click handler is feature-detected:
  - `navigator.share` exists → call
    `navigator.share({ text: shareText, url: shareUrl })`; on user-cancel
    (`AbortError`), do nothing.
  - Otherwise → `navigator.clipboard.writeText(shareUrl + '\n' + shareText)`
    (or whatever single-string composition planner picks — see Discretion),
    then swap button label to "Copied!" for ~1.5s.
  - Inline `<script is:inline>`, wrapped in `try/catch` like every other
    script in the codebase. Clipboard API throws in some sandboxed contexts;
    on any failure, the readonly `<input>` is still selectable by hand, so
    the user is never blocked.
- **D-07:** The full URL is `https://oddlympics.app/?ref=${code}` — written
  with the explicit scheme so it auto-links when pasted into SMS, X,
  iMessage, etc. (Schemeless display in copy text is a separate aesthetic
  choice; the actual shared link must include `https://`.) Use
  `PUBLIC_SITE_URL` as the base (same env var `email.ts:9` already uses),
  not a hardcoded literal — preserves local-dev behavior where the base is
  `http://localhost:4321`.

### Share copy

- **D-08:** A single `shareText(teamLabel: string, url: string): string`
  helper in `src/lib/copy.ts`, consumed by all four surfaces (3 pages + the
  email). Lives next to `NO_ACCOUNT_TITLE` / `REENTRY_CTA`. Wording:
  ```
  I'm following ${teamLabel} — get your team's World Cup kickoff alerts.
  ${url}
  ```
  Newline between message and URL so it line-breaks gracefully in SMS,
  WhatsApp previews, and tweet composers.
- **D-09:** Team label is sourced via `teamLabel(slug)` from `src/lib/teams.ts`
  — the same function already used by `sendMagicLink` (`email.ts:26`) and
  the consumer landing. Single source of truth: `references/teams.json`.
- **D-10:** No flag emoji. Skipped despite PROJECT.md's aspirational
  example, because (a) `references/teams.json` has no `flag` field today,
  (b) text-only matches the editorial-minimalist house style, (c) Windows
  flag glyphs render inconsistently. The team name alone satisfies SC4.
- **D-11:** Single template across all surfaces — no per-page variants.
  One string in `copy.ts`, one place to tweak.

### Email integration

- **D-12:** Share line lives as a plain `<p>` placed immediately after the
  existing `Confirm email` button in `sendMagicLink`'s HTML
  (`email.ts:63-65`). Mirror copy in the plaintext `text` part
  (`email.ts:29-45`). Not a colored callout box — the existing
  `NO_ACCOUNT_TITLE` callout is the primary re-entry nudge; share is a
  soft secondary nudge that should not visually compete.
- **D-13:** `sendMagicLink` gains a 5th parameter: the user's
  `referral_code` string. `/api/signup` passes
  `row.referral_code` (guaranteed non-null post-Phase-13 backfill +
  per-insert generation). The compose step builds
  `${PUBLIC_SITE_URL}/?ref=${code}` and feeds both into `shareText`. No
  new env var; no template change beyond the inserted paragraph.
- **D-14:** The email share link goes to **`/?ref=CODE`** — same generic
  landing carry-through every other surface uses. Phase 15's per-team
  `/r/CODE` route does not exist yet; this phase intentionally does not
  block on it (per the milestone's "Phase 15 long pole / first trim
  candidate" framing in ROADMAP.md). If Phase 15 ships, it intercepts the
  `/r/CODE` route — Phase 14 links can be migrated later or left as
  `/?ref=` (both work; `/?ref=` keeps working forever as the unfurl
  fallback).

### Surfacing rules per page

- **D-15:** **`/pending`** — show share UI when `?rc=` is present. Copy
  framing: optimistic ("Know someone else following USA? Share your link
  while you wait for the email.") — uses the user's just-picked team name
  via the team label already passed via Plausible event metadata (or, more
  simply, also append `&team=` to the 303 if needed; see Discretion). If
  team isn't available, fall back to generic "Share with a friend".
- **D-16:** **`/confirmed`** — show share UI under the `status=ok` and
  `status=already` COPY entries (`confirmed.astro:22-46`), guarded on
  `?rc=` being present. Skip on `bad-token` / `unknown`. Heading: same
  "Share with a friend" — match `/pending` for consistency.
- **D-17:** **`/manage`** — show share UI inside the `valid &&
  !isUnsubscribed` branch (`manage.astro:218-330`), below the "Save
  selection" button but above the schedule list — that's where a returning
  user pauses after editing. Server-rendered, so `user.referral_code` and
  `user.team` are directly available; no URL-param dance. Skip in the
  unsubscribed branch (D-locked above).

### Verification

- **D-18:** Extend `scripts/smoke-signup.mjs` with a referral-link
  visibility check: after each successful signup case (any of the 8 + the
  Phase 13 referral cases), GET `/pending?email=...&rc=...` (the URL the
  303 produces) and grep the response body for the URL `/?ref=...` and for
  the team name. Asserts the wiring end-to-end without needing a headless
  browser.
- **D-19:** A second smoke section for confirmation: mint a confirm token,
  GET `/api/confirm?token=...`, follow the 303, grep `/confirmed`'s body
  for the referral URL. Confirms D-02's email→code lookup.
- **D-20:** No new Playwright/Puppeteer dependency. The `navigator.share`
  / `navigator.clipboard` behavior is browser-specific and is verified
  manually in a checklist on `/pending` (the operator will exercise it
  during Phase 4 launch-week observation or pre-launch walk-through). Web
  Share API is feature-detection-gated, so the code path is provably safe
  to ship without an automated browser test.

### Claude's Discretion

- Whether the share UI is a real Astro component (e.g.
  `src/components/ShareCard.astro`) imported by the three pages, or
  inline-duplicated markup. The codebase has very few components
  (`Layout.astro` is the only major one); inline-duplicated is consistent
  with the existing "three pages doesn't justify the abstraction" stance
  in `.planning/codebase/CONVENTIONS.md:80-83`. Component preferred if any
  CSS or behavior is non-trivial.
- Exact composition of the single-string clipboard fallback ordering
  (`url + '\n' + text` vs `text + '\n' + url`). Native share API receives
  `text` and `url` as separate fields so they may compose differently per
  platform.
- Whether to fire a Plausible `Share Click` custom event mirroring the
  existing `Signup Submit` pattern (`index.astro:217-225`). Cheap to add;
  measures share-button engagement (denominator) which complements the
  `referred_by` column's measure of conversions (numerator). Recommended
  but not blocking — the loop is already measurable via
  `referred_by` alone.
- Plan/wave split — suggested: copy helper + email update (Wave 1) →
  `/api/signup` + `/api/confirm` `&rc=` redirect changes (Wave 1) → share
  UI on the three pages reading `?rc=` (Wave 2) → smoke extensions
  (Wave 3).
- Whether `/api/signup` also appends `&team=` to the `/pending` redirect to
  let the inline script personalize the share-card heading with the team
  name (D-15), or whether `/pending` settles for generic "Share with a
  friend" heading + per-template team name only inside the
  Web-Share/clipboard payload.
- Heading micro-copy: "Share with a friend" vs "Help a friend not miss
  kickoff" vs "Got a friend on your team?" — house-style choice.
- Exact "Copied!" flash duration and any aria-live announcement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope (read first)
- `.planning/ROADMAP.md` §"Phase 14: Share Experience" — goal, depends-on
  (Phase 13), the 4 success criteria (SC1–SC4 are authoritative).
- `.planning/REQUIREMENTS.md` §"Share Experience" — SHARE-01, SHARE-02,
  SHARE-03, SHARE-04; §"Out of Scope" (no rewards/dashboard/fraud system)
  + §"Future Requirements" (REF-F1/REF-F2 deferred).
- `.planning/PROJECT.md` §"Current Milestone: v2.1 Referral & Social
  Sharing" / §"Key Decisions" — "attribution stays lightweight — a code +
  ref param, no rewards/leaderboard"; "long pole: per-team OG images …
  first thing to trim … this is Phase 15 work".

### Prior-phase decisions (read before planning)
- `.planning/phases/13-referral-code-attribution/13-CONTEXT.md` — the
  referral-code shape, generation, `COALESCE`-protected stability,
  `lookupByReferralCode` prepared statement, the `?ref=` + localStorage
  carry-through pattern on `index.astro` (Phase 14's `?rc=` reader on
  `/pending` + `/confirmed` is the same defensive-inline-script idiom,
  applied to the post-signup pages). **Phase 14 does NOT touch
  `oddlympics_ref` localStorage** — that's the incoming-referrer scope,
  not the user's own outgoing code.
- `.planning/phases/12-restore-multi-team-selection/12-CONTEXT.md` — most
  recent server-rendered `/manage` work; `valid && !isUnsubscribed`
  branching idiom (`manage.astro:218`), the `flash` class for status
  banners.
- `.planning/phases/10-confirmation-email-update/10-CONTEXT.md` — most
  recent `sendMagicLink` change; the `teamLabel` + `tzLabel` pattern; the
  HTML callout-box convention.

### Existing code to edit (READ before editing)
- `src/lib/copy.ts` — add `shareText(teamLabel, url)` here next to the
  existing `NO_ACCOUNT_TITLE` / `NO_ACCOUNT_BODY` / `REENTRY_CTA`
  constants. **Source of truth for the wording locked in D-08.**
- `src/lib/email.ts` — `sendMagicLink` `:18-89`; add 5th parameter for
  `referral_code`, build share URL via `${SITE_URL}/?ref=${code}`, insert
  the share `<p>` after the confirm button at `:63-65`, mirror in
  plaintext at `:29-45`. `buildUnsubscribeHeaders` `:91-101` unchanged.
- `src/pages/api/signup.ts` — `:165` 303 redirect; change to
  `Location: /pending?email=...&rc=${row.referral_code}`. The `row` is
  already in scope from `upsertVipSignup`'s `RETURNING *` result.
- `src/pages/api/confirm.ts` — read the file before editing; the 303s to
  `/confirmed?status=ok` and `status=already` both need `&rc=...`
  appended. Requires resolving email → code via `getByEmail`
  (already exported from `db.ts`).
- `src/pages/pending.astro` — currently the simplest prerendered page
  (`:14-40` inline script). Add a share-card markup block + a new
  defensive `<script is:inline>` that reads `?rc=` and `?team=` (if
  Discretion D-15 picks the team-aware variant), wires the share button,
  and feature-detects `navigator.share`.
- `src/pages/confirmed.astro` — `:20-58` inline script. Add same
  share-card block + a `?rc=` reader. Guard visibility on `status=ok` or
  `status=already`.
- `src/pages/manage.astro` — `:218-330` signed-in branch. Add the
  share-card markup directly (server-rendered: `user.referral_code` and
  `user.team` are in scope). Skip in `isUnsubscribed` branch (D-17).
- `src/lib/db.ts` — `upsertVipSignup` `:137-151` (returns `referral_code`
  via `RETURNING *`); `getByEmail` `:168-170` (used by `/api/confirm` to
  resolve email → code per D-02); `VipSignup.referral_code` type
  `:125`. **No schema changes** in this phase.
- `src/lib/teams.ts` — `teamLabel(slug)` `:16-18` — reuse for D-08/D-09.
- `scripts/smoke-signup.mjs` — extend per D-18/D-19 (response-body greps
  for the referral URL and team name on `/pending` and `/confirmed`).

### Codebase conventions (downstream MUST match)
- `.planning/codebase/CONVENTIONS.md` — strict TS, `node:` prefix,
  prepared statements, `type` over `interface`, no framework JS,
  defensive `try/catch`-wrapped inline scripts, why-only comments,
  `?error=` redirect pattern.
- `.planning/codebase/ARCHITECTURE.md` — hybrid static+server Astro; the
  prerendered-page-reads-URL-params abstraction (governs D-03/D-15/D-16).

No external ADRs/specs — requirements are fully captured in ROADMAP.md
SC1–SC4 + REQUIREMENTS.md SHARE-01..04 + the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`shareText` helper home — `src/lib/copy.ts`** (`:1-4`): three existing
  string constants. Adding a function alongside is idiomatic (no new
  module needed). All four surfaces already import from `copy.ts`.
- **`teamLabel(slug)` — `src/lib/teams.ts:16-18`**: returns the human
  label for a slug (e.g. `"usa"` → `"USA"`); already used by
  `sendMagicLink` (`email.ts:26`) and by the consumer landing. Single
  source of truth via `references/teams.json`.
- **`upsertVipSignup`'s `RETURNING *` — `db.ts:140-151`**: the inserted
  row (including the COALESCE-protected `referral_code`) is in scope in
  `/api/signup` after the upsert — no extra read needed for D-01.
- **`getByEmail` — `db.ts:168-170`**: lookups an email's full row;
  `/api/confirm` calls this to resolve `email → referral_code` for D-02.
- **`PUBLIC_SITE_URL` — `email.ts:9`**: env var with sensible
  `http://localhost:4321` dev fallback. Use the same constant when
  building share URLs to preserve local-dev behavior.
- **Defensive inline `<script is:inline>` pattern** — `index.astro:230-259`
  (Phase 13 `?ref=` reader), `pending.astro:14-40`, `confirmed.astro:20-58`,
  `manage.astro:174-191`: every script is `try/catch`-wrapped, reads
  `searchParams`, falls through silently on failure. D-03 / D-06 follow
  this verbatim.
- **`Layout.astro` — `src/components/Layout.astro`**: the only major
  shared component. CSS variables (`--accent`, `--accent-soft`,
  `--accent-ink`, `--fg`, `--fg-dim`, `--surface`, `--line`, `--mono`,
  `--pad`) are defined here and are the styling primitives the share-card
  block should use.
- **`flash` class — `manage.astro:443-445`**: existing status-pill style
  for `ok` and `err` kinds. The "Copied!" affirmation can borrow the same
  visual language.

### Established Patterns
- **303 redirects with query params + inline script reader** —
  `/api/signup` 303s to `/pending?email=...`; the script reads
  `?email=` and inlines it. D-01/D-02 extend with `&rc=`; D-03 extends
  the readers with `?rc=`.
- **Single-character feature detection then graceful fallback** —
  `Intl.supportedValuesOf` guarded in `manage.astro:352-354`,
  `try { detected = Intl.DateTimeFormat()... } catch {}` in many places.
  D-06's `navigator.share` / `navigator.clipboard` detection follows the
  same idiom.
- **No framework JS, no fetch in the browser** — all interactivity is
  plain inline `<script>` reading params + the form `POST`s. The share
  button is a pure client-side affair (no server round-trip) — fits.
- **Email HTML is hand-rolled inline `<table>` for client compatibility**
  — `email.ts:47-68`. D-12 inserts a `<p>` after the confirm-button
  paragraph; no new structural elements needed.

### Integration Points
- `vip_signups.referral_code` (Phase 13) ← read by `/api/signup` (already)
  and now by `/api/confirm` (D-02) and by `/manage` server frontmatter
  (D-17) and by `sendMagicLink` (D-13).
- `/api/signup` 303 → `/pending` carries `&rc=...` (D-01) → inline script
  on `/pending` reads and populates share card (D-03).
- `/api/confirm` 303 → `/confirmed` carries `&rc=...` (D-02) → inline
  script on `/confirmed` reads and populates share card (D-03).
- `sendMagicLink(email, token, team, tz, code)` ← `/api/signup` after
  upsert (D-13) → composes share URL + share text via `shareText` (D-08).
- `shareText(teamLabel, url)` ← imported by `pending.astro` (inline
  script string), `confirmed.astro` (inline script string),
  `manage.astro` (server frontmatter for the Web Share API payload), and
  `email.ts` (HTML + plaintext bodies).

</code_context>

<specifics>
## Specific Ideas

- Share URL canonical form: `https://oddlympics.app/?ref=k7m2qx9a`
  (full scheme; required for SMS / X / iMessage auto-linking). Built from
  `${PUBLIC_SITE_URL}/?ref=${code}`; do not hardcode the host.
- Share text (single template, D-08):
  ```
  I'm following USA — get your team's World Cup kickoff alerts.
  https://oddlympics.app/?ref=k7m2qx9a
  ```
- Web Share API payload: `{ text: "I'm following USA — get your team's
  World Cup kickoff alerts.", url: "https://oddlympics.app/?ref=k7m2qx9a" }`.
  Letting the OS compose `text` + `url` separately produces better
  results in SMS / Mail than a single concatenated string.
- Clipboard fallback payload: the single concatenated string (text +
  newline + url) — one paste into anywhere.
- "Copied!" flash: swap button label for ~1.5s, then restore. No toast,
  no aria-live shouting. Matches the project's minimal-affordance house
  style.
- Heading copy: "Share with a friend" — neutral, doesn't oversell, works
  on all three pages.
- Email copy under the confirm button:
  *"Know someone else following USA? Share your link:
  https://oddlympics.app/?ref=k7m2qx9a"* — one short paragraph, URL
  visible (because in email there is no clickable share button — the URL
  IS the share affordance).

</specifics>

<deferred>
## Deferred Ideas

- **Per-team OG image + server-rendered `/r/CODE` route** — **Phase 15**
  (OG-02, OG-03). Until Phase 15 ships, every Phase 14 share link
  unfurls with the existing generic `/og-image.png`. Phase 14's links
  intentionally use `/?ref=CODE`, not `/r/CODE`, so they remain valid
  unfurl-wise even if Phase 15 trims.
- **"You've referred N friends" counter on `/manage`** — REF-F1 (Future
  Requirements). Cheap to add post-launch from `vip_signups` aggregated
  on `referred_by`.
- **Referral leaderboard, rewards, milestone unlocks** — REF-F2 (Future
  Requirements). Out of scope for v2.1.
- **Per-network intent buttons** (X / WhatsApp / Email mailto:) — covered
  by the native share sheet on mobile; explicit buttons add UI weight for
  marginal lift on a 20-day runway. Revisit only if share rate is
  measurably low post-launch.
- **Flag field on `references/teams.json`** — would let the shared
  message be `"I'm following 🇺🇸 USA — ..."`. Cheap one-time data load;
  revisit if testing shows the unfurl needs more visual punch and Phase
  15's per-team OG image isn't enough.
- **Plausible `Share Click` custom event** — listed under Claude's
  Discretion (D-area). Implement if planner has the capacity; otherwise
  deferred to a post-launch quick-add.

None new from discussion that don't fit existing-roadmap or
Future-Requirements buckets — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-share-experience*
*Context gathered: 2026-05-22*
