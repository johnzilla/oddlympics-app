# Phase 9: `/manage` editor + unsubscribe - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed-in subscriber visits `/manage` and sees an editor for their team
(single slug from `references/teams.json`) and timezone (IANA, `Intl.supportedValuesOf('timeZone')`),
plus their personal matches list inline. Pre-milestone subscribers (rows with
`team IS NULL` from the Phase 5 backfill) see a one-time "Pick a team" banner.
The one-click unsubscribe email link works without re-authentication via a
1-year HMAC-signed token, and a previously-unsubscribed user can re-subscribe
through a fresh signup + magic-link confirm.

In scope:
- Consolidate at `/manage`: `/manage.astro` becomes a dual-mode page (editor when
  signed-in, magic-link request form when not). `/schedule.astro` becomes a
  thin 301 redirect to `/manage`, preserving the `?token=` query string for any
  in-flight magic-link emails.
- Replace the 48-team checkbox grid (currently at `src/pages/schedule.astro:134-150`)
  with a native `<select name="team">` dropdown matching the signup form on
  `src/pages/index.astro`.
- Pre-milestone banner: visible iff `user.team IS NULL`; implicit dismissal
  (no close button, no localStorage, no DB column); disappears automatically
  on next render after the team is set.
- Update endpoint (MANAGE-01): **reuse `/api/save-selection`**. Form on
  `/manage.astro` POSTs there; redirect target changes from `/schedule?status=`
  to `/manage?status=`. `/api/manage` stays the magic-link sender.
- Unsubscribe token TTL bump (MANAGE-02): introduce per-purpose TTL constants in
  `src/lib/token.ts` (`unsubscribe`=1y, `manage`=24h, `confirm`=24h, `session`=30d).
  `mintToken()` picks TTL from `purpose` unless `opts.ttlSeconds` overrides.
  `buildUnsubscribeHeaders()` inherits the 1-year TTL with no call-site change.
- Unsubscribe single-use semantics: formalize the existing DB-layer idempotent
  contract (`WHERE unsubscribed_at IS NULL`) — second click is a no-op,
  `status=already`. Token is a 1-year credential; the DB row is the single
  source of single-effect truth.
- Re-subscribe path (SC4): `markConfirmed` in `src/lib/db.ts` clears
  `unsubscribed_at` AND its `WHERE` clause is widened so a re-confirm after
  unsubscribe re-fires the update. New shape:
  `WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)`.

Out of scope:
- Layout.astro extraction across `/manage`, `/index` — deferred to v1.1 per
  CLAUDE.md and Phase 7 D-07. Continue the paste-style `<style is:global>`
  pattern.
- Footer harmonization beyond paste — Phase 7 explicitly deferred this to v1.1.
- Server-side banner-dismissal state — rejected; implicit dismissal via team-set.
- Token nonce server-side / `unsub_nonce` column — rejected; DB-layer
  idempotency is sufficient. No new column, no nonce rotation, no migration.
- `/api/manage` POST as an alias for `/api/save-selection` — rejected; one
  canonical update endpoint.
- Renaming `/api/manage` to `/api/manage-request` — rejected; the magic-link
  sender keeps its current path.
- Editing OG/Twitter meta tags — Phase 6 D-06/D-08 lock these; do not touch.
- `/schedule` keeping any editor UI — it becomes a thin 301 handler only.
- Adding `<select>` of any non-team field (sport, league) — single-team is the
  v2.0 model.

</domain>

<decisions>
## Implementation Decisions

### `/manage` editor location + URL shape

- **D-01:** Consolidate at `/manage`. The single editor URL is `/manage`.
  - `GET /manage` (session valid) → editor: `<select>` team + tz row + inline matches list (when team is set)
  - `GET /manage` (no session, no URL token) → current magic-link request form (existing behavior at `src/pages/manage.astro`)
  - `GET /manage?token=...` (URL token, manage purpose) → editor + mint a 30-day session cookie (the existing `/schedule.astro` URL-token-first-arrival flow ports verbatim)
  - `GET /schedule` (and `/schedule?token=...`) → 301 redirect to `/manage` (preserve query string)
  - `src/lib/email.ts:68` `sendManageLink()` URL change: `${SITE_URL}/schedule?token=...` → `${SITE_URL}/manage?token=...`
  - `src/pages/schedule.astro` becomes a thin 301 handler — Astro server-rendered redirect, no UI. Planner chooses whether to delete the file outright (and add an Astro route alias / static-redirect rule) or keep a minimal redirect handler in place.

  Rationale: ROADMAP goal text pins the editor to `/manage`. Old magic-link emails point at `/schedule?token=...`; preserving the `?token=` through the 301 keeps them working until they expire (24h TTL on `manage`-purpose tokens means existing in-flight links die within a day of deploy regardless).

### Update endpoint (MANAGE-01)

- **D-02:** Reuse `/api/save-selection`.
  - Form on `/manage.astro` POSTs to `/api/save-selection` (existing path, no rename)
  - The handler's session-or-token dual-auth stays as-is (`src/pages/api/save-selection.ts:41-48`); `manage`-purpose token still arrives via the form's hidden `token` input
  - Redirect target in `redirectTo()` (`src/pages/api/save-selection.ts:23-29`) changes from `/schedule?...` to `/manage?...`
  - `/api/manage` stays the magic-link sender (no rename, no move)
  - `src/pages/manage.astro:35` form `action="/api/manage"` (magic-link request form) stays unchanged for the signed-out branch; the signed-in editor branch uses `action="/api/save-selection"`.
  
  Rationale: ROADMAP requires the plan to pin MANAGE-01's endpoint choice. Reuse minimizes API surface change, keeps the handler's existing security shape (Origin check is implicit because `/api/save-selection` already has session/token gate), and avoids a rename that would also need an `/api/manage-request` move.

### Picker UX + Banner UX

- **D-03 (picker):** Single-select native `<select name="team">` with 48 `<option>` elements (one per team, `value="{slug}"`, label text shows team name with TLA prefix to match the existing tile-grid look). Mirrors the team `<select>` already on `src/pages/index.astro` signup form.
  - Form posts `team=<slug>` directly, not `team_ids[]`
  - `src/pages/api/save-selection.ts` switches from `team_ids[]` (integer ID → slug lookup via `SELECT slug FROM teams WHERE id = ?`) to `team` (slug allow-list validation via `VALID_TEAMS` Set from `src/lib/teams.ts`)
  - Keep a `team_ids[]` fallback parse path for the transition window so in-flight `/schedule` form submissions during the deploy don't error; planner decides exact fallback shape
  - "Currently selected" indication: server pre-renders `<option ... selected>` for the slug that matches `user.team`

- **D-04 (banner):** Implicit dismissal.
  - Banner visible iff `user.team IS NULL`
  - No close button, no localStorage, no DB column
  - Setting a team via the save form makes `user.team` non-NULL; on next render the banner is gone
  - Copy: headline `Pick a team` (verbatim from roadmap); planner picks one short subhead line confirming the user is signed up and the team picker below is the action

### Unsubscribe token mechanics (MANAGE-02)

- **D-05 (TTL):** Per-purpose TTL constants in `src/lib/token.ts`. Replace the single `TTL_SECONDS = 60 * 60 * 24` constant with a `TTL_BY_PURPOSE` table:
  ```
  const TTL_BY_PURPOSE = {
    confirm:     60 * 60 * 24,         // 24h
    manage:      60 * 60 * 24,         // 24h
    unsubscribe: 60 * 60 * 24 * 365,   // 1 year — MANAGE-02
    session:     60 * 60 * 24 * 30,    // 30 days (mirrors src/lib/session.ts)
  };
  ```
  - `mintToken()` resolves TTL via `opts.ttlSeconds ?? TTL_BY_PURPOSE[opts.purpose ?? 'confirm']`
  - `buildUnsubscribeHeaders()` (`src/lib/email.ts:55-65`) inherits 1y automatically — no call-site change
  - Legacy purpose-less tokens (in-flight from before D-06 was added) continue to be treated as `confirm` per existing fallback in `verifyToken` (`src/lib/token.ts:70-71`); no Phase 9 change there

- **D-06 (single-use):** DB-layer idempotency is the contract.
  - The unsubscribe token is a credential good for 1 year; the database row is the single source of single-effect truth
  - First click → `markUnsubscribed` UPDATE fires (matches `WHERE unsubscribed_at IS NULL`), `unsubscribed_at` set, redirect `?status=ok`
  - Re-clicks before re-subscribe → no-op (UPDATE matches 0 rows), redirect `?status=already`
  - No nonce column, no token store, no rotation

- **D-07 (re-subscribe SC4):** `markConfirmed` in `src/lib/db.ts:95-100` clears `unsubscribed_at` AND its `WHERE` clause is widened so re-confirm after unsubscribe re-fires the update.
  - New shape:
    ```
    UPDATE vip_signups
    SET confirmed_at = strftime('%s','now'),
        unsubscribed_at = NULL
    WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
    RETURNING *
    ```
  - Flow: previously-unsubscribed user signs up again via `/` → `upsertVipSignup` updates row (does NOT touch `unsubscribed_at`; left alone here) → `/api/signup` mints new confirm-purpose token → user clicks magic link → `/api/confirm` → `markConfirmed` fires (matches because `unsubscribed_at IS NOT NULL`) → sets `confirmed_at` to current time, clears `unsubscribed_at` to NULL → user is now fully active again
  - The double-opt-in gate (magic-link confirm) is preserved — a typo in someone else's email field can't silently re-subscribe them; they still have to click the confirm link
  - Old unsub email links the user clicks later: token sig valid for 1y, but `markUnsubscribed` UPDATE matches 0 rows because `unsubscribed_at IS NULL` again → `?status=ok` and the row gets re-marked unsubscribed. Acceptable — user opted back in via signup but is choosing to opt out again. Same shape as a brand-new subscriber unsubscribing.

### Claude's Discretion

The planner and executor decide:
- 301 vs 302 for the `/schedule` → `/manage` redirect (301 default; 302 acceptable if reasoning given)
- Whether `src/pages/schedule.astro` is deleted or kept as a thin redirect handler — depends on what Astro routing supports cleanly with `output: 'server'`
- Exact banner placement on `/manage` (top of `.hero-content`, above `.headline`, etc.) — match the established `.banner` pill class style at `src/pages/manage.astro:101` for visual consistency
- Banner subhead copy beyond the "Pick a team" headline — one short line
- Form layout details on the signed-in `/manage` editor — match the `src/pages/index.astro` signup form aesthetic, single-column, mono font, accent button
- How to render the `<option>` text inside the team `<select>` (TLA prefix, just name, both) — match `src/pages/index.astro` if a precedent exists there; otherwise planner picks
- Whether the inline matches list keeps the exact server-emits-ISO + client-renders-local-time pattern from `src/pages/schedule.astro:257-268` (yes — port it verbatim)
- The exact `team_ids[]` fallback shape in `/api/save-selection` during transition (parse-first-integer + resolve-to-slug as today, then drop after deploy stabilizes) — planner refines
- npm script names for any new smoke verification — kebab-or-colon style (e.g., `smoke:manage`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` §"Manage / unsubscribe" → **MANAGE-01** (update endpoint pinned in this phase), **MANAGE-02** (1-year HMAC token, single-use per unsubscribe action)
- `.planning/REQUIREMENTS.md` §"Backward compatibility" → **COMPAT-01** (pre-milestone subscribers don't break `/manage`; banner prompts them; backfill rules already shipped in Phase 5)
- `.planning/ROADMAP.md` §"Phase 9: `/manage` editor + unsubscribe" — Goal, 4 Success Criteria, plan-time MANAGE-01 endpoint decision (now D-02), depends on Phase 5

### Prior phase decisions (LOCKED — do not relitigate)
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` §Decisions → Phase 5 **D-01** (`vip_signups.team` is a single snake_case slug, not an array; `/schedule` keeps multi-pick UI in Phase 5; Phase 9 is the v2.0 single-team editor); §Integration Points (`/manage tz update reuses or duplicates per Phase 9 decision` → Phase 9 reuses `VALID_TZ` from `src/lib/timezones.ts` per D-03 here)
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions → **D-06** (meta tags hardcoded — do not touch in Phase 9), **D-08** (hardcoded `https://oddlympics.app/*` URLs throughout — no `Astro.site` derivation)
- `.planning/phases/07-legal-pages/07-CONTEXT.md` §"Deferred ideas" → Layout.astro extraction deferred to v1.1; footer harmonization beyond paste deferred to v1.1; **Token semantics for unsubscribe** noted as Phase 9 territory (MANAGE-02 — now D-05/D-06/D-07 here)

### Project context
- `.planning/PROJECT.md` §"Current Milestone" — v2.0 consumer pivot, launch deadline 2026-06-11
- `CLAUDE.md` §"Stack" — Astro 5 server, Node 22, `better-sqlite3`, Resend, Caddy + systemd
- `CLAUDE.md` §"Conventions established" — single mono font, `--accent: hsl(18 70% 56%)`, paste-style `<style is:global>` per page, no framework JS, URL-param error/status messaging with 303 redirects

### Existing code (READ before editing)
- `src/pages/manage.astro` — current magic-link request page (also the signed-out branch of Phase 9's consolidated `/manage`)
- `src/pages/schedule.astro` — current editor (becomes thin 301 handler; the editor UI ports to `/manage`'s signed-in branch); includes the TZ auto-detect-with-override pattern (`src/pages/schedule.astro:207-269`) that ports verbatim to `/manage`
- `src/pages/index.astro` — has the team `<select>` pattern to mirror at `/manage` (form-action, allow-list, validation)
- `src/pages/api/save-selection.ts` — update endpoint that reuses (D-02); switches input from `team_ids[]` to `team` (slug)
- `src/pages/api/manage.ts` — magic-link sender (unchanged in Phase 9; serves the signed-out branch's form action)
- `src/pages/api/unsubscribe.ts` — unsubscribe handler (no code change in Phase 9; the DB-layer idempotency contract is formalized)
- `src/lib/token.ts` — `TTL_BY_PURPOSE` table added per D-05; `mintToken()` lookup logic added
- `src/lib/email.ts:55-65` — `buildUnsubscribeHeaders()` inherits 1y automatically (no call-site change)
- `src/lib/email.ts:67-90` — `sendManageLink()` URL change `/schedule?token=` → `/manage?token=` per D-01
- `src/lib/db.ts:95-100` — `markConfirmed` WHERE-clause widening + `SET unsubscribed_at = NULL` addition per D-07
- `src/lib/db.ts:106-110` — `markUnsubscribed` already idempotent via `WHERE unsubscribed_at IS NULL`; no code change, D-06 formalizes it as the contract
- `src/lib/db.ts:230-235` — `setSelection` (Phase 5) accepts `team` slug + tz + email; D-03 wires the new form to this verbatim
- `src/lib/teams.ts` — `VALID_TEAMS` Set; D-03 wires `/api/save-selection` to it for slug allow-list
- `src/lib/timezones.ts` — `VALID_TZ` Set + `FALLBACK_TZ`; reused for `/manage` tz update
- `src/lib/session.ts` — `readSessionFromCookie`, `buildSessionCookie`; 30-day sliding-window cookie helper, used verbatim by `/manage` signed-in branch

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript — `node:` prefixes on built-ins, ESM throughout, why-only comments, prepared-statement generics for new SQL helpers
- `.planning/codebase/STRUCTURE.md` — kebab-case files, established directory shape
- `.planning/codebase/INTEGRATIONS.md` — Resend email send shape, systemd timer pattern (irrelevant for Phase 9 but documents the dry-run gating idiom)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`readSessionFromCookie()`** (`src/lib/session.ts`) — already gates `/schedule` (lines 18-22). Ports verbatim to `/manage`'s signed-in branch.
- **`buildSessionCookie(email)`** (`src/lib/session.ts`) — mints 30-day sliding-window cookie. Already used by `/schedule.astro:16` on URL-token-first-arrival; ports verbatim.
- **`VALID_TZ` + `FALLBACK_TZ`** (`src/lib/timezones.ts`) — built once from `Intl.supportedValuesOf('timeZone')` at module load. Used by `/api/signup` for tz validation. Phase 9 reuses for the `/manage` tz update path; do NOT duplicate the validation regex.
- **`VALID_TEAMS` Set** (`src/lib/teams.ts`) — slug allow-list from `references/teams.json`. Used by `/api/signup` today; Phase 9 wires `/api/save-selection` to it for D-03's slug allow-list validation.
- **`setSelection` prepared statement** (`src/lib/db.ts:230-235`) — takes `(team, tz, email)`; already used by `/api/save-selection`. D-03 wires the new dropdown to this unchanged.
- **TZ auto-detect-with-override JS** (`src/pages/schedule.astro:207-269`) — small inline `<script is:inline>` that resolves `Intl.DateTimeFormat().resolvedOptions().timeZone`, populates the `<select>`, lets saved TZ take precedence over detected. Ports verbatim to `/manage`.
- **Banner `.banner` pill class** (`src/pages/manage.astro:101`, `src/pages/schedule.astro:292`) — already-shipped accent-bordered uppercase pill; D-04 banner reuses the same class to match the established aesthetic.
- **`<select>` team picker pattern** — `src/pages/index.astro` signup form has the precedent; D-03 mirrors it.

### Established Patterns
- **Server-rendered pages with `export const prerender = false;`** — `/manage`, `/schedule`, `/api/*` all follow this. Phase 9's consolidated `/manage` continues this pattern.
- **303 redirects with `?status=<code>` query params** — error/status messaging via URL params, inline `<script is:inline>` reading `location.search` and toggling a hidden `<p>`. `STATUS_COPY` table at `src/pages/schedule.astro:60-67` is the canonical map; D-01's `/manage?status=` redirects extend it.
- **Session-or-token dual auth** — `src/pages/schedule.astro:14-20` and `src/pages/api/save-selection.ts:41-48` both prefer URL `token` (manage purpose) and fall back to session cookie. `/manage` editor uses the same pattern (the magic-link-clicked user gets a session minted on arrival; subsequent visits skip the email step).
- **DB-layer idempotency via partial WHERE clauses** — `markUnsubscribed`, `markConfirmed`, `setSelection` all use `WHERE ... IS NULL` (or its inverse) to make multi-clicks safe. D-06 formalizes this as the unsubscribe contract; D-07 extends the pattern to `markConfirmed` to support re-subscribe.
- **Paste-style `<style is:global>` per page** — no shared Layout.astro until v1.1; D-01's new `/manage` editor branch pastes the same accent/mono/spacing tokens from `/index.astro`.
- **Honeypot field `name="website"` with `.hp` class** — visually hidden anti-bot input. `/manage.astro:44-51` already has it; D-01's signed-out branch keeps it as-is.

### Integration Points
- **`/manage` signed-out → `/api/manage`** (magic-link form) — POSTs email, Origin-checked, rate-limited, sends magic link via `sendManageLink()`. Unchanged in Phase 9.
- **`/manage` signed-in → `/api/save-selection`** (editor save form) — D-02 wires the dropdown form action here; redirect target moves from `/schedule?status=` to `/manage?status=`.
- **`/schedule` (and `/schedule?token=...`) → 301 → `/manage`** (and `/manage?token=...`) — D-01's URL consolidation.
- **`sendManageLink()` → `/manage?token=...`** — D-01's email URL change; the existing magic-link flow continues, just with the new URL.
- **`buildUnsubscribeHeaders()` → 1y-TTL `/api/unsubscribe?token=...`** — D-05's per-purpose TTL change makes existing call-site automatically use the 1y TTL; no change to email send pipeline.
- **`markConfirmed` (after re-signup → magic link → /api/confirm)** — D-07's WHERE-clause widening + `unsubscribed_at = NULL` clear restores the row to fully active on re-confirm.

</code_context>

<specifics>
## Specific Ideas

- `/manage` signed-in branch wireframe (planner refines):
  ```
  [banner: pre-milestone subscribers only]
  Headline: Manage your schedule.
  Notifications in: [America/Los_Angeles ▾] change
  Your team:        [▾ USA                  ]
  [Save selection]

  Your matches (N)   ← inline, only when team is set
  - 2026-06-11  Group A  USA vs ENG
  - 2026-06-15  Group A  USA vs IRN
  ...
  ```
- Banner copy: headline `Pick a team`, subhead ~10-12 words confirming "you're signed up, just choose a team below to start getting kickoff alerts" — planner refines exact wording
- New form action on `/manage.astro` signed-in branch: `<form method="post" action="/api/save-selection">` with hidden `<input type="hidden" name="token" value={urlToken} />` when URL-token-first-arrival applies (mirrors `src/pages/schedule.astro:115`)
- `STATUS_COPY` map for `/manage?status=` should mirror the `src/pages/schedule.astro:60-67` table verbatim (`saved`, `bad-token`, `bad-tz`, `too-many` becomes `bad-team`, `unknown`, `server`) — note: `too-many` is dead code with single-team semantics; replace with `bad-team` for "slug not in allow-list"
- `TTL_BY_PURPOSE` table additions:
  ```
  confirm:     60 * 60 * 24,         // 24h
  manage:      60 * 60 * 24,         // 24h
  unsubscribe: 60 * 60 * 24 * 365,   // 1y, MANAGE-02
  session:     60 * 60 * 24 * 30,    // 30d, mirrors src/lib/session.ts
  ```
- `markConfirmed` new shape:
  ```sql
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now'),
      unsubscribed_at = NULL
  WHERE email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)
  RETURNING *
  ```
- Verification (planner picks exact shape): a `scripts/smoke-manage.mjs` covering — (1) signed-out `/manage` shows magic-link form; (2) signed-in `/manage` (cookie or URL token) shows editor with current team/tz pre-filled; (3) save with valid slug + tz roundtrips and shows `?status=saved`; (4) save with bad slug returns `?status=bad-team`; (5) save with bad tz returns `?status=bad-tz`; (6) banner present iff `user.team IS NULL`; (7) `/schedule` → 301 → `/manage` (with and without `?token=`); (8) 1-year unsubscribe token verifies after ~370-day fake-clock skew; (9) re-subscribe path (mark unsubscribed → re-signup → re-confirm → row is fully active, `unsubscribed_at = NULL`)

</specifics>

<deferred>
## Deferred Ideas

- **Layout.astro extraction** — Phase 7 already deferred this to v1.1; Phase 9 perpetuates the paste-style pattern.
- **Footer harmonization across `/manage`, `/index`, `/privacy`, `/terms`** — Phase 7 deferred to v1.1.
- **Server-side banner-dismissal state (`banner_dismissed_at` column)** — rejected here; implicit dismissal via team-set is sufficient. Revisit only if user-research shows confusion (e.g., users want to dismiss the banner without picking a team yet).
- **Token nonce server-side (`unsub_nonce` column)** — rejected here; DB-layer idempotency is sufficient for MANAGE-02's "single-use per unsubscribe action" reading. Revisit if a real token-replay incident occurs (e.g., archived emails being scraped and replayed by ad networks).
- **Cross-device banner dismissal** — out of scope (server-side dismissal rejected; localStorage is per-device only).
- **`/api/manage` → `/api/manage-request` rename** — rejected as unnecessary churn given D-02.
- **Native browser `<datalist>` for team picker (search-as-you-type over 48 teams)** — out of scope; `<select>` is fast enough at 48 options.
- **Per-team OG image variants on share** — out of scope; v2 territory.
- **Sub-page `/manage/matches` for the inline matches view** — out of scope; keep matches inline on `/manage` to match the current `/schedule` shape and minimize navigation surface.
- **Email-confirm flow change to also issue a fresh unsubscribe token in the email body (vs only in headers)** — out of scope; the List-Unsubscribe headers are the canonical surface and Phase 9 inherits them.
- **Telemetry/analytics on banner impressions or dismissals** — out of scope; Plausible already captures `pageview` on `/manage`.

</deferred>

---

*Phase: 09-manage-editor-unsubscribe*
*Context gathered: 2026-05-14*
