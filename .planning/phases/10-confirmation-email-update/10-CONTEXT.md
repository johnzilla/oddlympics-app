# Phase 10: Confirmation email update - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** `--auto` (every decision auto-selected to the recommended default)

<domain>
## Phase Boundary

Rewrite the confirmation email sent on signup (the `sendMagicLink()` body)
so it names the user's **team** (human-readable label from `references/teams.json`,
e.g. "England") and a **human-readable timezone label** (last `/`-segment of the
stored IANA tz with underscores → spaces and `" time"` appended, e.g. "Detroit time")
in a single value-prop line matching the SIGNUP-04 spec verbatim:
*"We'll email you 1 hour before every England match in Detroit time."*

Then verify deliverability on the production sender: the email renders cleanly
across Gmail, Proton, and Outlook (no broken layout, links resolve, unsubscribe
footer present, zero LAND-02 prohibited terms), and a Mail-Tester run against
the production sender scores **≥ 8/10**.

In scope:
- Edit `src/lib/email.ts:sendMagicLink()` — widen signature to accept `team` (slug) + `timezone` (IANA);
  derive `teamLabel` from `TEAMS` lookup + `tzLabel` from the landing-page split-and-suffix pattern;
  swap the email subject + body copy from teaser-era ("Confirm your spot — VIP", "early access")
  to consumer/v2.0 copy that includes the SIGNUP-04 value-prop line.
- Update the single caller `src/pages/api/signup.ts` to pass the new args
  (`rawTeam`, `tz`) — both already in scope after Phase 5 validation.
- Introduce a tiny pure helper for the tz label (testable, callable from script);
  planner decides whether it lives next to `VALID_TZ` in `src/lib/timezones.ts`
  or as a private function in `email.ts`.
- Keep `List-Unsubscribe` / `List-Unsubscribe-Post` headers via the existing
  `buildUnsubscribeHeaders()` helper (Phase 9 D-05 makes them 1-year TTL automatically).
- One-shot deliverability test against the **production sender** (post-deploy):
  send a real confirm to a mail-tester.com address, capture the score + sub-check
  breakdown in `10-SUMMARY.md`. Iterate (copy, headers, plain-text/HTML balance)
  until ≥ 8/10. Then send real confirmations to operator-controlled
  Gmail / Proton / Outlook inboxes; commit screenshots under
  `.planning/phases/10-confirmation-email-update/evidence/` and reference them.

Out of scope (other phases own, or explicitly deferred):
- `/confirmed` landing page copy — unchanged in Phase 10.
- `sendManageLink()` (the magic-link sign-in email) — unchanged in Phase 10; its
  copy is locked by Phase 9 D-01 (URL points at `/manage?token=`).
- The kickoff notification email (`scripts/send-kickoff-notifications.mjs:buildEmail()`)
  — owned by Phase 3 / NOTIFY-01; Phase 10 must NOT touch it.
- Custom Resend domain / DKIM / DMARC for `oddlympics.app` — locked to v1.1 by
  PROJECT.md Key Decisions; Phase 10 must hit ≥ 8/10 from the sandbox sender.
- New env vars or runtime config — none added.
- Phase 11 AC4 (end-to-end signup → Gmail/Proton/Outlook within 60s + unsubscribe
  loop) — Phase 10 delivers the asset; AC4 verifies the loop on prod.
- HTML email templating library (Mjml, react-email, etc.) — explicitly rejected
  (D-06); we stay on the inline-string pattern.
- Subject-line personalization (`"Confirm your England alerts"`) — rejected (D-08):
  template-y subject lines trigger Gmail spam heuristics.
- Per-team imagery (crest in the email) — out of scope; v2 territory.
- A2P 10DLC SMS / Telegram channel parity for confirmations — out of scope (different phase, channels deferred).

</domain>

<decisions>
## Implementation Decisions

### Read-point for team + tz at email-send time

- **D-01:** Caller passes both values into `sendMagicLink()`. Signature widens to:
  ```ts
  export async function sendMagicLink(
    email: string,
    token: string,
    team: string,         // snake_case slug from references/teams.json
    timezone: string,     // IANA, e.g. "America/New_York"
  ): Promise<void>
  ```
  - `/api/signup` (`src/pages/api/signup.ts:109`) already has `rawTeam` (validated
    against `VALID_TEAMS`) and `tz` (validated against `VALID_TZ` or
    backfilled to `FALLBACK_TZ`) in scope. Pass them through; no DB read.
  - Rationale: keeps `src/lib/email.ts` free of a `db` import, matches the existing
    "lib functions take primitives, never call DB" pattern. The Phase 5 validation
    chain in `/api/signup` is the only path that can call this — both args are
    guaranteed non-empty + known-good at the call site.

### Human-readable timezone label

- **D-02:** Mirror the landing page's `<span id="tz-label">` JS pattern verbatim
  (`src/pages/index.astro:198-211`):
  ```ts
  function tzLabel(tz: string): string {
    if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
    const last = tz.split('/').pop() ?? '';
    const human = last.replace(/_/g, ' ');
    return human ? `${human} time` : 'your local time';
  }
  ```
  - Examples: `America/Detroit` → "Detroit time"; `America/New_York` → "New York time";
    `Europe/London` → "London time"; `Asia/Ho_Chi_Minh` → "Ho Chi Minh time";
    `Etc/UTC` → "your local time"; `UTC` (no slash) → "your local time".
  - Rationale: copy-consistent with what the user just saw on the landing page (where
    they signed up). Deterministic across hosts (no Intl/ICU variance). The Phase 5
    fallback path (`FALLBACK_TZ = 'America/New_York'`) renders as "New York time"
    in the worst case — still personalized, never literally "UTC" or "Etc/UTC".
  - Implementation location: planner decides — either co-locate next to `VALID_TZ`
    in `src/lib/timezones.ts` (export `tzLabel`) or private in `src/lib/email.ts`.
    First is preferred (testable, single source).

### Team-name source

- **D-03:** Slug → label via the `TEAMS` constant from `src/lib/teams.ts`:
  ```ts
  function teamLabel(slug: string): string {
    return TEAMS.find((t) => t.slug === slug)?.label ?? slug;
  }
  ```
  - `TEAMS[*].label` is the canonical human-readable string from
    `references/teams.json` (e.g., `england` → "England", `united_states` → "United States",
    `bosnia` → "Bosnia and Herzegovina", `czech_republic` → "Czech Republic").
  - Diacritics preserved verbatim (FORM-02): `curacao` → "Curaçao" if shipped.
  - Fallback to the raw slug protects against a future row where `team` is a
    slug not in the in-memory set (e.g., team retired mid-tournament) — never
    a blank space in the email body.
  - Rationale: single source of truth — same labels the dropdown rendered. Avoids
    coupling email.ts to the `teams` SQLite table (which has its own `name` column
    from football-data.org that does not always match the consumer label).

### Email body copy

- **D-04:** The value-prop line uses the SIGNUP-04 spec example verbatim:
  > **We'll email you 1 hour before every {Team} match in {TzLabel}.**

  Rendered example: "We'll email you 1 hour before every England match in Detroit time."

  - Curly characters: ASCII apostrophe (0x27) per Phase 6 D-* precedent and the
    canonical sources convention. Use straight `'`, straight quotes.
  - The line replaces the teaser-era body line `"We'll email you when it's time.
    No spam, no marketing — just the launch ping."` in BOTH the plain-text
    `text` and the HTML `html` body strings.
  - Other body copy (CTA "Confirm email", paste-this-URL hint, "if you didn't
    request this, ignore" disclaimer) stays — minimal-blast-radius edit.

### Email subject line

- **D-05:** Replace `"Confirm your spot — oddlympics"` with
  **`"Confirm your World Cup alerts — oddlympics"`**.
  - Aligns with v2.0 consumer pivot (PROJECT.md). "Spot" / "VIP" / "early access"
    are teaser-era terms — confirming alerts is the consumer mental model.
  - Subject line does NOT include the team name (no `"Confirm your England alerts"`).
    Per-recipient subject personalization is a known Gmail-spam-heuristic trigger
    on transactional sends from sandbox senders; not worth the risk for ≥ 8/10
    Mail-Tester.

### Body format — keep multipart (plain-text + HTML)

- **D-06:** Keep both `text` and `html` bodies in the Resend send call. No
  template engine, no Mjml, no react-email. Edit the existing inline strings
  in place.
  - Mail-Tester penalizes single-part HTML messages ("missing plain-text alternative").
  - The existing HTML aesthetic (mono font, accent button at
    `background:hsl(18 70% 56%)`) already matches the v2.0 landing — keep it.
  - Sub-300-line `email.ts` is below the threshold where a template engine
    pays for itself.

### Sender domain — stay on sandbox

- **D-07:** Keep `EMAIL_FROM = 'oddlympics <onboarding@resend.dev>'` (the Resend
  sandbox sender). Phase 10 must hit ≥ 8/10 on Mail-Tester WITHOUT a custom
  domain.
  - Locked by PROJECT.md Key Decisions: "Custom Resend domain (DKIM/DMARC for
    oddlympics.app) — v1.1; ship with Resend's verified sandbox sender first."
  - The sandbox sender already has Resend's DKIM + SPF set on `resend.dev`; that's
    typically enough for ≥ 8 on Mail-Tester. If the live run scores 6-7, the
    fix is copy / HTML balance / headers — NOT migrating to a custom domain
    in this phase.

### Deliverability verification — Mail-Tester gate

- **D-08:** Operator-driven, prod-sender-only Mail-Tester run.
  Procedure:
  1. Deploy Phase 10 to `oddlympics.app`.
  2. Open https://www.mail-tester.com/ in a browser, copy the throwaway address.
  3. From a fresh browser profile, sign up on https://oddlympics.app with that
     address + a real team (e.g., England) + let the JS-captured timezone fire.
  4. Click "Then check your score" on Mail-Tester; capture score + breakdown.
  5. Paste score (e.g., "9.1/10") + the 7 sub-check items
     (auth, content, blacklists, etc.) verbatim into `10-SUMMARY.md`
     §Deliverability Evidence.
  6. If < 8: iterate the email body (copy density, anchor-tag-to-paste-URL ratio,
     hidden-text concerns, missing `Reply-To`, etc.); re-deploy; re-run.

  Rationale: there is no Mail-Tester API; this is one manual run per release.
  The score lives in the SUMMARY (audit trail) — Phase 11 AC4 verifies the
  full live loop end-to-end with the same email.

### Cross-client rendering — Gmail / Proton / Outlook

- **D-09:** Manual real-send + commit screenshots. Procedure:
  1. After D-08 passes, sign up three more times on prod from operator-controlled
     addresses: one `@gmail.com`, one `@proton.me` (or `@protonmail.com`), one
     `@outlook.com` (or `@hotmail.com`). Use a real team per send so the value-prop
     line renders for real.
  2. Open each delivered email in its native web client. Screenshot the rendered
     message body (subject + sender + body + footer; do NOT screenshot the
     mailbox list).
  3. Commit screenshots to
     `.planning/phases/10-confirmation-email-update/evidence/`
     as `mail-gmail.png`, `mail-proton.png`, `mail-outlook.png`.
  4. Reference all three in `10-SUMMARY.md` §Cross-Client Evidence with a
     pass/fail note per client (layout intact, link resolves, unsubscribe
     visible, prohibited terms absent).

  Rationale: solo dev + WC deadline — Litmus/Email-on-Acid subscriptions cost
  more than three throwaway inboxes do. The screenshots are the audit trail
  Phase 11 references for AC4.

### Tests / smoke verification

- **D-10:** Add a small `scripts/smoke-confirm-email.mjs` that runs the
  pure helpers (`teamLabel`, `tzLabel`, body-string composition) over a
  table-driven set of cases:
  - Canonical pair: `team=england, tz=America/Detroit` → body contains
    `"every England match in Detroit time."`
  - Multi-word team: `team=united_states, tz=Europe/London` → `"every United States match in London time."`
  - Fallback tz row: `team=france, tz=America/New_York` → `"every France match in New York time."` (FALLBACK_TZ path)
  - Underscore tz: `team=brazil, tz=Asia/Ho_Chi_Minh` → `"every Brazil match in Ho Chi Minh time."`
  - `Etc/UTC` edge: `team=germany, tz=Etc/UTC` → `"every Germany match in your local time."`
  - Subject line literal: equals `"Confirm your World Cup alerts — oddlympics"`
  - LAND-02 grep on the assembled body: no `bitcoin|lightning|crypto|world domination|personal olympics`.

  The script runs offline (no Resend call) — imports the helpers + the body
  composer, exits non-zero on any case mismatch.
  Add `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` to `package.json`
  to match the existing `smoke:signup` / `smoke:manage` naming.

### Claude's Discretion

The planner and executor decide:
- Whether `tzLabel` lives next to `VALID_TZ` in `src/lib/timezones.ts` (preferred)
  or stays private in `src/lib/email.ts`. Either is fine; prefer the lib file
  for testability + reuse.
- Whether `teamLabel` is added to `src/lib/teams.ts` as an exported helper
  (slot next to `isValidTeamSlug`) or inlined in `email.ts`. Lib file preferred
  for the same reason.
- Whether the body composer (the function that produces the `text` + `html`
  strings) is extracted to a private `buildConfirmBody({email, url, team, tz})`
  helper in `email.ts` or stays inline inside `sendMagicLink()`. Extract if it
  exceeds ~30 lines or if the smoke test needs to import it.
- The exact HTML body re-write: which lines move/stay/delete to land the
  SIGNUP-04 value-prop line. Suggested shape in §Specific Ideas; planner refines.
- Order of "if you didn't request this, ignore" vs unsubscribe-hint lines.
- Whether to add a `Reply-To: hello@oddlympics.app` header on the Resend
  `emails.send` call — almost certainly yes (small Mail-Tester lift; matches
  `/terms` contact convention).
- Whether to add a visible "Unsubscribe" link in the HTML footer body (in
  addition to the existing `List-Unsubscribe` header) — yes if it lifts the
  Mail-Tester score; URL is `${SITE_URL}/api/unsubscribe?token=${mintToken(email, { purpose: 'unsubscribe' })}`
  (1-year TTL per Phase 9 D-05). If included, planner picks placement (small
  grey footer line, matches `/manage` aesthetic).
- Plan split — 1 plan (code edit + smoke + ship) or 2 plans (code + smoke
  vs. operator-action verification + screenshots). Operator-action and copy
  edits naturally split; planner picks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 source-of-truth requirement
- `.planning/REQUIREMENTS.md` §"`/api/signup` payload" → **SIGNUP-04**: confirmation
  email body names team + human-readable timezone, with the literal example
  "We'll email you 1 hour before every England match in Detroit time."
- `.planning/ROADMAP.md` §"Phase 10: Confirmation email update" — goal + 3
  Success Criteria (named team+tz, cross-client render, Mail-Tester ≥ 8) +
  R-1 resolved (Resend already wired).
- `.planning/REQUIREMENTS.md` §"Acceptance criteria" → **AC4** (verified in
  Phase 11): real signup from Gmail/Proton/Outlook receives a confirmation
  within 60 s naming team + tz; unsubscribe link works.
- `.planning/REQUIREMENTS.md` §"Landing page" → **LAND-02** binds the email
  body too: zero occurrences of `bitcoin|lightning|crypto|world domination|personal olympics`.

### Prior phase decisions (LOCKED — do not relitigate)
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` §Decisions — **D-01**
  (`vip_signups.team` = single snake_case slug; `vip_signups.timezone` = IANA).
  Phase 10 reads both from the row already written by the time the confirmation
  fires; no further migration.
- `.planning/phases/05-schema-signup-payload/05-CONTEXT.md` §Code Context —
  `FALLBACK_TZ = 'America/New_York'` is canonical; PROJECT.md's "America/Detroit"
  mention is stale (an early-draft artifact); SIGNUP-04's "Detroit time" example
  is illustrative copy, not the fallback.
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Decisions —
  **D-06 / D-08** (hardcoded URLs, meta tags locked). Phase 10 must NOT change
  the meta tags or the `https://oddlympics.app/*` hardcoded prefix; it only edits
  email body text.
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` §Specifics —
  `<span id="tz-label">` JS pattern at `src/pages/index.astro:198-211`. Phase 10
  D-02 lifts this exact pattern into a server-side `tzLabel(tz)` helper.
- `.planning/phases/07-legal-pages/07-CONTEXT.md` §"Deferred ideas" — confirmation
  email body update noted as Phase 10 territory (now D-04 here).
- `.planning/phases/09-manage-editor-unsubscribe/09-CONTEXT.md` §Decisions — **D-05**
  (`TTL_BY_PURPOSE.unsubscribe = 1 year`); `buildUnsubscribeHeaders()` already
  inherits the 1y TTL with no call-site change. Phase 10 inherits this for free.

### Project context
- `.planning/PROJECT.md` §"Key Decisions" → "Custom Resend domain (DKIM/DMARC for
  oddlympics.app)" deferred to v1.1. Phase 10 must NOT introduce a domain change.
- `.planning/PROJECT.md` §"What This Is" — v2.0 consumer pivot binds all
  outbound copy.
- `CLAUDE.md` §"Stack" — Resend `^6.12.2`, Node 22, ESM throughout, why-only
  comments. Phase 10 stays in pattern.
- `CLAUDE.md` §"Dev email fallback" — `sendMagicLink()` falls through to
  `console.log` when `RESEND_API_KEY` is unset and `NODE_ENV !== 'production'`.
  Preserve this in the rewrite — the dev fallback log line should ALSO print
  the rendered body (or at least the value-prop line) so a contributor can
  visually confirm team + tz interpolation without running Resend.

### Existing code (READ before editing)
- `src/lib/email.ts:15-53` — `sendMagicLink()`; D-01 widens signature, D-04/D-05
  rewrite subject + body, D-06 keeps multipart.
- `src/lib/email.ts:5` — `EMAIL_FROM` default `'oddlympics <onboarding@resend.dev>'`
  is the prod sender Phase 10 verifies against (D-07).
- `src/lib/email.ts:55-65` — `buildUnsubscribeHeaders()`; unchanged in Phase 10.
- `src/pages/api/signup.ts:109` — the ONLY caller; D-01 widens the call to pass
  `rawTeam, tz`. Both values are validated upstream in the same function
  (`src/pages/api/signup.ts:75-90`).
- `src/lib/teams.ts:9-10` — `TEAMS` + `VALID_TEAMS`. D-03 adds an exported
  `teamLabel(slug)` helper (planner's discretion on location).
- `src/lib/timezones.ts:1-15` — `FALLBACK_TZ`, `VALID_TZ`, `isValidTimezone`.
  D-02 adds an exported `tzLabel(tz)` helper (planner's discretion on location).
- `src/pages/index.astro:198-211` — the JS pattern D-02 mirrors. Read this
  before writing the server-side helper to verify byte-for-byte.
- `references/teams.json` — 48-team list; `.label` is the human-readable string.
- `scripts/smoke-signup.mjs` — naming + invocation pattern D-10's
  `scripts/smoke-confirm-email.mjs` mirrors.
- `package.json` scripts — existing kebab-or-colon naming (`smoke:signup`,
  `smoke:manage`, `og:render`). D-10 adds `smoke:confirm`.

### Codebase patterns (downstream MUST match these)
- `.planning/codebase/CONVENTIONS.md` §TypeScript — strict mode, `node:` prefix
  on built-ins, return-type annotations on exports, why-only comments.
- `.planning/codebase/CONVENTIONS.md` §"Error handling" — caller-throws-lib
  errors; the signup handler catches `sendMagicLink` exceptions and
  303-redirects to `/?error=email` (`src/pages/api/signup.ts:110-113`). Phase 10
  inherits this contract; no new error codes.
- `.planning/codebase/INTEGRATIONS.md` §"Resend" — `from`, `to`, `subject`,
  `text`, `html` is the canonical send shape; `error` is returned, never
  thrown; lib code throws on `error` and the caller catches. Phase 10
  inherits.
- `CLAUDE.md` §"Conventions established" — ASCII apostrophe (0x27) in all
  body copy (matches Phase 6 deviation log).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`TEAMS` + `VALID_TEAMS`** (`src/lib/teams.ts:9-10`) — already imported by
  `/api/signup` for the allow-list check. Phase 10 reuses the same `TEAMS`
  array for the slug → label lookup. No new data file.
- **`FALLBACK_TZ` constant** (`src/lib/timezones.ts:1`) — guarantees `user.timezone`
  is never literally empty/null on a confirmable row, so the `tzLabel()` helper
  always returns a personalized label ("New York time" worst case for fallback
  rows).
- **`buildUnsubscribeHeaders()`** (`src/lib/email.ts:55-65`) — already returns
  `List-Unsubscribe` / `List-Unsubscribe-Post` with the 1y-TTL token (Phase 9 D-05).
  Phase 10 adds these headers to the `sendMagicLink()` Resend send call (they
  were never wired into confirmation emails — only the unsubscribe path uses them
  today via the `/api/unsubscribe` route). Wiring them adds a small Mail-Tester lift.
- **Existing HTML pattern** (`src/lib/email.ts:31-41`) — mono-font card with
  accent-orange CTA button; aesthetic matches v2.0 landing. Keep the structure;
  only edit the inner copy strings.
- **`<span id="tz-label">` JS pattern** (`src/pages/index.astro:198-211`) — exact
  algorithm D-02 ports to a server-side helper.

### Established Patterns
- **`process.env.RESEND_API_KEY ?? ''` + dev console fallback** — preserved
  verbatim. The fallback print loop should ALSO render the new value-prop line
  so dev-mode contributors can verify team + tz interpolation without firing
  Resend.
- **Lib modules are pure / sync-first** — `email.ts` doesn't import `db.ts`;
  D-01 (caller passes values) preserves this layering.
- **One named export per concern** — `sendMagicLink`, `sendManageLink`,
  `buildUnsubscribeHeaders`. Phase 10 widens `sendMagicLink`'s signature, does
  not add a second function.
- **ASCII apostrophe in body copy** — Phase 6 deviation log establishes this
  as the project convention. New SIGNUP-04 line uses `'` (0x27) not `'` (U+2019).
- **No JSDoc, why-only one-line comments** — Phase 10 stays in pattern.

### Integration Points
- **`/api/signup` → `sendMagicLink()`** — only caller; D-01 widens the
  call-site to pass `rawTeam, tz`. Both already validated in the same handler.
- **`sendMagicLink()` → Resend** — same shape; subject + body strings change;
  `headers` field gains `List-Unsubscribe*` (planner decides) + `Reply-To`
  (planner decides — Claude's Discretion bullet).
- **Mail-Tester / cross-client inboxes** — external dependencies; verified
  manually post-deploy per D-08 / D-09. No code dependency.
- **Phase 11 AC4** — Phase 10 produces the asset Phase 11 verifies live.
  No cross-phase code dependency; the SUMMARY screenshots are the handoff.

</code_context>

<specifics>
## Specific Ideas

- New `sendMagicLink()` signature:
  ```ts
  export async function sendMagicLink(
    email: string,
    token: string,
    team: string,
    timezone: string,
  ): Promise<void>
  ```
- New `tzLabel()` helper (preferred location: `src/lib/timezones.ts`):
  ```ts
  export function tzLabel(tz: string): string {
    if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
    const last = tz.split('/').pop() ?? '';
    const human = last.replace(/_/g, ' ');
    return human ? `${human} time` : 'your local time';
  }
  ```
- New `teamLabel()` helper (preferred location: `src/lib/teams.ts`):
  ```ts
  export function teamLabel(slug: string): string {
    return TEAMS.find((t) => t.slug === slug)?.label ?? slug;
  }
  ```
- New subject literal: `'Confirm your World Cup alerts — oddlympics'`
- New plain-text body (planner refines exact line breaks):
  ```
  Confirm your World Cup alerts for oddlympics.

  Click below to confirm:
  {url}

  We'll email you 1 hour before every {teamLabel(team)} match in {tzLabel(timezone)}.

  No spam. No ads. Unsubscribe anytime.

  If you didn't request this, ignore this email.

  — oddlympics
  ```
- New HTML body — keep the styled card from `src/lib/email.ts:31-41`, swap:
  - `<h1>Confirm your spot</h1>` → `<h1>Confirm your alerts</h1>`
  - The first `<p>` becomes the SIGNUP-04 value-prop line (with `<strong>` on
    the team label) — `<p>We'll email you 1 hour before every <strong>{Team}</strong> match in {TzLabel}.</p>`
  - Keep the accent button + paste-URL hint + final disclaimer (the latter
    can absorb a small unsubscribe-mention line per Claude's Discretion bullet).
- `scripts/smoke-confirm-email.mjs` cases (D-10): the six entries enumerated
  in the D-10 block above; planner can add edge cases (empty team slug,
  diacritic team like Curaçao if shipped).
- `package.json` script add: `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"`.
- Suggested Resend `headers` field on the send call:
  ```ts
  headers: {
    ...buildUnsubscribeHeaders(email),
    'Reply-To': 'hello@oddlympics.app',
  }
  ```
- Suggested commit shape: `feat(10-01): widen sendMagicLink with team+tz copy`,
  `chore(10-02): wire List-Unsubscribe + Reply-To headers`,
  `test(10-03): scripts/smoke-confirm-email.mjs`,
  `docs(10-04): mail-tester score + cross-client screenshots`.
- Evidence dir: `.planning/phases/10-confirmation-email-update/evidence/`
  with `mailtester-score.png`, `mail-gmail.png`, `mail-proton.png`,
  `mail-outlook.png`.

</specifics>

<deferred>
## Deferred Ideas

- **Custom Resend domain (DKIM + DMARC for `oddlympics.app`)** — locked to v1.1
  in PROJECT.md Key Decisions. Phase 10 must clear the ≥ 8/10 bar from the
  sandbox sender. Revisit only if the live score is unrecoverable from
  copy/header tweaks (very unlikely on Resend's verified sandbox).
- **HTML email templating engine (Mjml, react-email, maizzle)** — considered for
  D-06; rejected. The body is < 50 lines and only mutates copy strings;
  template-engine overhead does not pay for itself in this milestone. Revisit
  when ≥ 3 distinct emails (confirm + manage + kickoff + future) start sharing
  layout primitives.
- **Per-team imagery (crest in the email header)** — out of scope. Would require
  `references/crests/*.png` shipped at Resend-friendly sizes; v2 territory.
- **Subject-line personalization with team name** — rejected (D-05). Subject
  personalization is a known Gmail-spam-heuristic trigger on sandbox senders;
  revisit only if a real recipient-engagement metric (open-rate from Plausible
  + Resend) shows the plain subject is hurting confirmation rate.
- **Litmus / Email-on-Acid automated cross-client gate** — rejected (D-09).
  Three operator-controlled real inboxes + screenshots are cheaper, sufficient
  for v2.0 launch, and reusable for Phase 11 AC4.
- **Update `/confirmed` landing page copy to also name team + tz** — out of
  scope; SIGNUP-04 binds the email body only. Revisit if a post-launch UX
  pass shows users hit `/confirmed` from a different device and need the
  same value-prop reminder there.
- **Update `sendManageLink()` body to include team + tz too** — out of scope;
  Phase 9 locked its copy. Revisit only if cross-channel copy consistency
  becomes a UX concern.
- **Update kickoff notification email to use the new helpers** —
  `scripts/send-kickoff-notifications.mjs:buildEmail` already has its own
  formatter (`formatKickoff` at `scripts/send-kickoff-notifications.mjs:117`).
  Phase 10 must NOT touch it; refactor opportunity, not a feature gap.
- **Automated Mail-Tester polling / regression watch** — no Mail-Tester API
  exists; manual one-shot is the only option. Revisit if a different
  deliverability service (postmark-score, glock-apps) ships an API and the
  budget allows.

</deferred>

---

*Phase: 10-confirmation-email-update*
*Context gathered: 2026-05-15*
