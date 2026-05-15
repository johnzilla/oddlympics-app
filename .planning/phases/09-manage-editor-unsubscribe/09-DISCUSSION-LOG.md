# Phase 9: `/manage` editor + unsubscribe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `09-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 09-manage-editor-unsubscribe
**Areas discussed:** `/manage` editor location, Update endpoint (MANAGE-01), Banner + picker UX, Unsubscribe token mechanics (MANAGE-02)

---

## `/manage` editor location

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate at `/manage` | `/manage` shows editor when signed-in, magic-link gate when not. `/schedule` → 301 → `/manage`. One canonical URL. | ✓ |
| Split: `/manage` editor, `/schedule` view-only | `/manage` = team+tz editor; `/schedule` = read-only matches view. Cleaner separation, two URLs and a UI relocation. | |
| Keep `/schedule` as the editor, `/manage` stays the gate | Minimal change. Conflicts with ROADMAP goal text ("on /manage"). Would require a roadmap text amendment. | |

**User's choice:** Consolidate at `/manage`.
**Notes:** Implicit consequences captured in D-01: `/schedule.astro` → thin 301 handler preserving `?token=` query; `sendManageLink()` URL change `/schedule?token=` → `/manage?token=`; matches list stays inline on `/manage` (per option preview).

---

## Update endpoint (MANAGE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `/api/save-selection` | Form at `/manage` POSTs to `/api/save-selection` (current path). Redirect targets change `/schedule?status=` → `/manage?status=`. Magic-link sender stays at `/api/manage`. Minimal API surface change. | ✓ |
| Rename `/api/manage` POST = update, magic-link sender moves | Rename current `/api/manage` → `/api/manage-request`. New `/api/manage` POST takes over as update endpoint. Cleaner naming, but two file renames + a form-action change. | |
| Both: keep `/api/save-selection` AND add `/api/manage` POST as a thin alias | Add `/api/manage` POST that delegates to `/api/save-selection`. Doubles the surface to maintain. | |

**User's choice:** Reuse `/api/save-selection`.
**Notes:** Minimal API surface change consistent with Area 1's consolidation. The `/api/manage` magic-link sender keeps its current path. Token-purpose check (`verifyToken(formToken, 'manage')`) unchanged — manage-purpose token now arrives at `/manage` instead of `/schedule`, but the token itself is unchanged.

---

## Banner + picker UX — Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Native `<select>` dropdown | Single `<select name="team">` with 48 `<option>`s. Tightest UX, smallest form size, free mobile native picker. Mirrors the team `<select>` pattern in `index.astro` signup form. | ✓ |
| Radio group | `<input type="radio" name="team">` per team. 48 radios visible (or scrollable). More browsable but eats vertical space. | |
| Tile grid (single-select) | Reuse 4-col tile grid CSS from `/schedule`, switch checkbox → radio. Most visually polished, slowest to scan for a specific team. | |

**User's choice:** Native `<select>` dropdown.
**Notes:** Form posts `team=<slug>` directly (not `team_ids[]`). `/api/save-selection` switches from integer-ID lookup to slug allow-list validation via `VALID_TEAMS` Set from `src/lib/teams.ts`, with `team_ids[]` fallback for the transition window during deploy.

---

## Banner + picker UX — Banner dismissal

| Option | Description | Selected |
|--------|-------------|----------|
| Implicit | Banner shows iff `user.team IS NULL`. No close button. Saving a team makes it disappear naturally because `user.team` is no longer NULL on next render. Zero new state, zero new DB column. | ✓ |
| Explicit close + client cookie | Banner has `[x]`. Closing sets a `localStorage` flag so it doesn't return on next visit. Survives within-device only. | |
| Explicit close + server DB column | Banner has `[x]`. Closing POSTs to a new endpoint flipping `vip_signups.banner_dismissed_at`. Survives across devices. Adds a migration + new endpoint + column. | |

**User's choice:** Implicit dismissal.
**Notes:** Banner state model is `visible ≡ user.team IS NULL`. No new column, no new endpoint, no client storage. Setting the team makes it disappear on the next render.

---

## Unsubscribe token mechanics (MANAGE-02) — TTL

| Option | Description | Selected |
|--------|-------------|----------|
| Per-purpose constants in `token.ts` | Add `TTL_BY_PURPOSE` table keyed by purpose. `unsubscribe=1y`, `manage=24h`, `confirm=24h`, `session=30d`. `mintToken()` picks TTL from purpose unless `opts.ttlSeconds` overrides. | ✓ |
| Per-call override at the call site | Leave `token.ts` default at 24h. Change `buildUnsubscribeHeaders()` to pass `ttlSeconds: 60*60*24*365` explicitly. Minimal `token.ts` diff but TTL knowledge scattered. | |

**User's choice:** Per-purpose constants in `token.ts`.
**Notes:** Cleanest, makes every token type self-documenting. `buildUnsubscribeHeaders()` in `src/lib/email.ts:55-65` inherits the 1y TTL automatically with no call-site change. Legacy purpose-less tokens (pre-D-06) continue to be treated as `confirm` per `verifyToken`'s existing fallback.

---

## Unsubscribe token mechanics (MANAGE-02) — Single-use semantics

| Option | Description | Selected |
|--------|-------------|----------|
| DB-layer idempotent (formalize as contract) | Token is reusable as a credential; the DB action is single-effect via `WHERE unsubscribed_at IS NULL`. Re-clicks return `status=already`. No new state. | ✓ |
| Token nonce server-side | Add `unsub_nonce` column. Each token mint stores a nonce in the row; verify checks match. After first use, nonce rotates → old tokens dead. Strong, but `+1 migration, +1 endpoint`, and any new email send rotates nonces (breaks in-flight unsub links). | |

**User's choice:** DB-layer idempotent (formalize the existing behavior as the contract).
**Notes:** The user's preview explicitly flagged the re-subscribe leak that follows from this choice (markConfirmed doesn't clear `unsubscribed_at` today). Addressed in the next question.

---

## Unsubscribe token mechanics (MANAGE-02) — Re-subscribe path (SC4)

| Option | Description | Selected |
|--------|-------------|----------|
| Clear on re-confirm | `markConfirmed` widens its `WHERE` to `email = ? AND (confirmed_at IS NULL OR unsubscribed_at IS NOT NULL)` and adds `SET unsubscribed_at = NULL`. Re-signup → magic-link click → row is fully active. Preserves the double-opt-in gate. | ✓ |
| Clear on re-signup (immediate) | `upsertVipSignup` ON CONFLICT branch clears `unsubscribed_at`. Faster, but bypasses the magic-link gate — a typo in someone else's email field could re-subscribe them silently. | |

**User's choice:** Clear on re-confirm.
**Notes:** Preserves the double-opt-in pattern that exists for a reason. Old unsub email links (post re-subscribe) remain valid for 1y as credentials; clicking one re-unsubscribes the row — semantically correct (the user chose to opt out again from a still-valid signed link).

---

## Claude's Discretion

- 301 vs 302 for the `/schedule` → `/manage` redirect — planner picks (default 301)
- Whether `src/pages/schedule.astro` is deleted or kept as a thin redirect handler — depends on what Astro routing supports cleanly
- Exact banner placement on `/manage` (within `.hero-content`, etc.) — planner refines
- Banner subhead copy beyond `Pick a team` headline — short single line
- Form layout details on the signed-in `/manage` editor — match `src/pages/index.astro` aesthetic
- How to render `<option>` text inside the team `<select>` (TLA prefix vs name vs both) — planner picks
- Whether to keep the inline matches list's server-emits-ISO + client-renders-local-time pattern from `/schedule.astro:257-268` — port verbatim
- Exact `team_ids[]` fallback parse shape during transition window — planner refines
- npm script name for any new smoke verification — kebab-or-colon style (e.g., `smoke:manage`)

## Deferred Ideas

- Layout.astro extraction — Phase 7 deferred this to v1.1; Phase 9 perpetuates the paste-style pattern.
- Footer harmonization across `/manage`, `/index`, legal pages — Phase 7 deferred to v1.1.
- Server-side banner-dismissal state — rejected here; revisit only if user-research shows confusion.
- Token nonce server-side — rejected here; DB-layer idempotency is sufficient for "single-use per unsubscribe action".
- Cross-device banner dismissal — out of scope.
- `/api/manage` → `/api/manage-request` rename — unnecessary churn.
- `<datalist>` search-as-you-type team picker — out of scope; `<select>` is fast at 48 options.
- Sub-page `/manage/matches` for the matches view — out of scope; keep inline.
- Email-confirm flow change to issue a fresh unsubscribe token in the email body — out of scope; List-Unsubscribe headers are canonical.
- Telemetry on banner impressions/dismissals — out of scope; Plausible already captures pageview on `/manage`.
