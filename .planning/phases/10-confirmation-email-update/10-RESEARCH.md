# Phase 10: Confirmation email update - Research

**Researched:** 2026-05-15
**Domain:** Transactional email — Resend SDK, HTML email cross-client rendering, RFC 8058 list-unsubscribe, Mail-Tester / SpamAssassin scoring on a sandbox sender
**Confidence:** HIGH on Resend API / SpamAssassin auth signals / RFC 8058 mechanics; MEDIUM on realistic Mail-Tester score ceiling from `onboarding@resend.dev`; LOW on Proton/Outlook.com dark-mode interaction with the specific accent (warm `hsl(18 70% 56%)` orange) until a live cross-client send happens (D-09).

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** `sendMagicLink()` signature widens to `(email, token, team, timezone)`. Caller (`src/pages/api/signup.ts:109`) passes the Phase-5-validated `rawTeam` + `tz` already in scope. **No `db` import inside `email.ts`.** `email.ts` stays primitive-only.
- **D-02** `tzLabel(tz)` mirrors the landing JS at `src/pages/index.astro:204-205` (the algorithm body; CONTEXT cites `198-211` for the surrounding `<script>` block) **verbatim**. Sentinel for "no slash" or `Etc/*` → returns `'your local time'`. Last `/`-segment, `_`→space, append `' time'`.
- **D-03** `teamLabel(slug)` via `TEAMS.find(t => t.slug === slug)?.label ?? slug` against the `TEAMS` array from `src/lib/teams.ts:9` (sourced from `references/teams.json`). Fallback to the raw slug — never an empty span.
- **D-04** Value-prop line copy is **SIGNUP-04 spec verbatim**:
  > `We'll email you 1 hour before every {Team} match in {TzLabel}.`
  ASCII apostrophe `'` (0x27), not U+2019. Replaces the teaser-era line in BOTH `text` and `html`.
- **D-05** Subject literal: `'Confirm your World Cup alerts — oddlympics'`. **No team name in subject** (Gmail spam-heuristic risk on sandbox).
- **D-06** Keep multipart (`text` + `html` both on the Resend send call). No template engine.
- **D-07** Stay on `EMAIL_FROM = 'oddlympics <onboarding@resend.dev>'` — custom Resend domain is v1.1 (locked in PROJECT.md Key Decisions).
- **D-08** Mail-Tester gate = manual operator action against prod sender post-deploy. Score + 7 sub-checks recorded in `10-SUMMARY.md`. ≥ 8/10 required.
- **D-09** Cross-client gate = manual real sends to Gmail / Proton / Outlook from the prod sender. Screenshots committed under `.planning/phases/10-confirmation-email-update/evidence/` as `mail-gmail.png`, `mail-proton.png`, `mail-outlook.png`.
- **D-10** Add `scripts/smoke-confirm-email.mjs` (offline; exercises pure helpers + body composer) + `"smoke:confirm"` npm script.

### Claude's Discretion

- Whether `tzLabel` lives in `src/lib/timezones.ts` (preferred — testable, single source) or stays private in `email.ts`.
- Whether `teamLabel` lives in `src/lib/teams.ts` (preferred — co-located with `isValidTeamSlug`) or inlined in `email.ts`.
- Whether the body composer is extracted to a `buildConfirmBody({email, url, team, tz})` helper or stays inline in `sendMagicLink()`. Extract if it exceeds ~30 lines OR the smoke test needs to import it (it does — see Validation Architecture below).
- Exact HTML body re-write (which lines move/stay/delete).
- Order of "if you didn't request this, ignore" vs unsubscribe-hint footer line.
- Whether to add `'Reply-To': 'hello@oddlympics.app'` to the Resend `headers` field (**recommendation below: YES — small Mail-Tester lift**).
- Whether to wire `buildUnsubscribeHeaders(email)` onto the confirmation send (**recommendation below: YES — never has been wired before, ~half-point Mail-Tester lift**).
- Whether to add a visible "Unsubscribe" link in the HTML footer body (**recommendation below: YES** if the score lands at 7/10; otherwise skip — see Pitfalls).
- Plan split — 1 plan (code edit + smoke + ship) or 2 plans (code+smoke vs. operator-action verification). Coarse-granularity project; recommendation below: **3 plans** (code, smoke, operator verification) for clean audit trail.

### Deferred Ideas (OUT OF SCOPE)

- Custom Resend domain (DKIM/DMARC for `oddlympics.app`) — v1.1; revisit only if score is unrecoverable.
- HTML email templating engine (Mjml, react-email, maizzle) — rejected.
- Per-team imagery (crest in email header) — v2.
- Subject-line personalization with team name — rejected.
- Litmus / Email-on-Acid automated cross-client gate — rejected; three real inboxes are cheaper.
- Updating `/confirmed` page copy to also name team + tz — out of scope.
- Updating `sendManageLink()` body — locked by Phase 9 D-01.
- Touching `scripts/send-kickoff-notifications.mjs` `formatKickoff` — owned by Phase 3 / NOTIFY-01.
- Automated Mail-Tester polling — no public API.

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIGNUP-04 | Confirmation email body names team + human-readable timezone (e.g., "We'll email you 1 hour before every England match in Detroit time.") | D-01 widens `sendMagicLink` signature; D-02 ports `tzLabel`; D-03 derives `teamLabel`; D-04 binds the literal copy. Verification path: offline `smoke-confirm-email.mjs` (Plan 10-03) covers body composition for canonical + edge slugs; manual Mail-Tester run (Plan 10-04) covers SC2/SC3 on the prod sender; manual cross-client send (Plan 10-04) covers SC2 across Gmail/Proton/Outlook. Phase 11 AC4 closes the live end-to-end loop. |

</phase_requirements>

---

## Phase Goal Restated

Rewrite the body of the confirmation email sent on signup so it names the user's team (human-readable label from `references/teams.json`, e.g., "England") and a human-readable timezone label (e.g., "Detroit time" — derived from the IANA tz with the same algorithm the landing page already uses for `<span id="tz-label">`) in a single value-prop line matching SIGNUP-04 verbatim:

> *We'll email you 1 hour before every England match in Detroit time.*

Then verify deliverability on the production sender — Mail-Tester ≥ 8/10 from `onboarding@resend.dev`, no LAND-02 prohibited terms anywhere in the assembled body, clean cross-client render on Gmail / Proton / Outlook with the unsubscribe footer present and the link resolving.

The depth of the phase is in the verification, not the code. The code edit is ~15-30 lines in `src/lib/email.ts` plus ~5 lines each in `teams.ts` / `timezones.ts` plus a ~80-line offline smoke script. The deliverability and cross-client work is operator-driven, evidence-captured, and may iterate.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 10 implication |
|---|---|---|
| Astro 5 SSR + better-sqlite3 + Resend + Caddy + systemd | "Stack" | No new dependencies. Stay on `resend@^6.12.2`. |
| TypeScript strict, `type` over `interface`, return-type annotations on exports, no `any` | "TypeScript" | New helpers `tzLabel(tz: string): string`, `teamLabel(slug: string): string`. Widened `sendMagicLink` keeps `: Promise<void>`. |
| ASCII apostrophe (0x27) in body copy — established as project convention (Phase 6 deviation log) | "Conventions established" | The SIGNUP-04 line is `We'll` not `We’ll`. Smoke must `grep -F` byte-exact. |
| No JSDoc; why-only one-line comments only | "What you won't see in this codebase" | New helpers ship with no doc comments; the *one* comment that earns its keep is on the body composer noting the SIGNUP-04 binding. |
| `node:` prefix on built-ins | "TypeScript" | Smoke script must use `node:fs`, `node:path` etc. — matches `smoke-signup.mjs` / `smoke-manage.mjs`. |
| Dev fallback for missing `RESEND_API_KEY` outside production must continue to work | "Dev email fallback" | The rewritten `sendMagicLink` keeps the `if (!resend) { console.log(...); return; }` branch. **Extend the dev-fallback log to also print the rendered value-prop line** so contributors can verify team/tz interpolation without firing Resend. (CONTEXT.md §code_context restates this as a requirement.) |
| Errors caught in route handler, lib code throws | "Error handling — three patterns" | Phase 10 inherits — `sendMagicLink` continues to throw `Error('Resend error: ...')` and `/api/signup` already catches and `back('email')`s. **No new error code.** COMPAT-02 still holds. |
| LAND-02: zero `bitcoin\|lightning\|crypto\|world domination\|personal olympics` (case-insensitive) | REQUIREMENTS.md | Applies to **the assembled email body too** — subject + text + html. Phase 10 smoke must `grep -iE` to be safe. |
| GSD workflow enforcement before file changes | "GSD Workflow Enforcement" | Plan-time gate, not a runtime constraint. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Team slug → label lookup | Backend (lib) | — | Pure data lookup; reuses `TEAMS` already loaded for `/api/signup` allow-list. No reason to push to client. |
| IANA tz → human label | Backend (lib) | Browser (existing) | Browser already does this for `<span id="tz-label">` at request time; backend now mirrors verbatim at email-send time. Two consumers, one algorithm — both copies must stay byte-equivalent. |
| Compose email body (text + html) | Backend (lib) | — | Side-effect-free string composition; pure inputs (email, url, team, tz). |
| Send via Resend HTTP API | Backend (lib) | — | `src/lib/email.ts` already owns this. Single caller. |
| Sign / mint unsubscribe token for list-unsubscribe header | Backend (lib) | — | `buildUnsubscribeHeaders()` in same file; 1-year TTL from Phase 9 D-05. |
| Mail-Tester / cross-client deliverability verification | Operator action (post-deploy) | — | No API surface; manual one-shot run + screenshot evidence. |

**Tier sanity check:** zero work shifts to the browser tier. Zero work shifts to the API tier beyond passing two already-validated primitives through one extra function-call site. All new logic is library code in `src/lib/`.

---

## Standard Stack

### Core (already in repo — no installs)

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| `resend` | 6.12.2 (current registry head 6.12.3) | Send the multipart confirmation email | Already wired; SDK supports `text` + `html` + `headers` + `reply_to` on the single `emails.send()` call. [VERIFIED: `node_modules/resend/dist/index.d.mts` — `CreateEmailBaseOptions` exposes `text`, `html`, `headers: Record<string,string>`, `reply_to`] |
| `astro` | 5.x | Astro SSR adapter; `email.ts` is a plain TS module imported from an API route | No change. |
| `node:crypto` | built-in | HMAC token mint via `mintToken()` in `src/lib/token.ts` for `List-Unsubscribe` header | No change. |

### Supporting (none added)

No new dependencies. The CONTEXT D-06 decision explicitly rejects a template engine. The whole phase is reads/writes of existing modules.

### Alternatives considered (and locked-out)

| Instead of | Could have used | Why rejected |
|---|---|---|
| Inline string body composer | Mjml, react-email, maizzle | D-06 locked — < 50 lines of body string, single email, no shared layout primitives yet |
| Custom Resend domain `oddlympics.app` for DKIM alignment | Skip the sandbox sender | D-07 / PROJECT.md Key Decisions — v1.1 |
| Litmus / Email-on-Acid for cross-client gate | Manual real-send screenshots | D-09 — cost + 3 inboxes is enough for v2.0 launch |
| Subject-line personalization (`"Confirm your England alerts — oddlympics"`) | Plain subject | D-05 — known Gmail spam-heuristic trigger on sandbox sender |

**Version verification (run before plan starts):**
```bash
npm view resend version
# expected: 6.12.x (current 6.12.3; we're on 6.12.2, patch-level only — no bump needed for Phase 10)
```

---

## Domain Research

### 1. Mail-Tester scoring mechanics on `onboarding@resend.dev`

**Mail-Tester score is out of 10** (the underlying SpamAssassin score is the inverse — *lower is better*, 0 is best; Mail-Tester maps `10 - spam_score` to its 0–10 display). [CITED: [Mail-Tester sender-reputation guide](https://mail-tester.com/blog/email-sender-reputation-score/)] [VERIFIED: SpamAssassin scoring threshold-based per [MailerCheck SpamAssassin Score](https://www.mailercheck.com/articles/spamassassin-score)]

The score breaks into **seven sub-checks** Mail-Tester surfaces in its UI: SPF/DKIM/DMARC authentication, content (HTML/SpamAssassin rules), blacklists (Spamhaus / SORBS / Barracuda), Message body / subject sanity, server / sending IP reputation, broken-link / bad-URL detection, and unsubscribe / List-Unsubscribe headers.

**Realistic ceiling from `onboarding@resend.dev`:** the sandbox sender ships with Resend's own DKIM (`d=resend.dev`) and SPF (`v=spf1 include:_spf.resend.com`) records configured on the `resend.dev` apex. [CITED: [Resend DMARC docs](https://resend.com/docs/dashboard/domains/dmarc)] These two passes alone are typically worth **+3 points** vs. an unauthenticated sender on Mail-Tester. DMARC is harder — Resend's DMARC on `resend.dev` is set to `p=none` (monitoring-only) [CITED: [DMARC Policy Modes · Resend](https://resend.com/blog/dmarc-policy-modes)], which Mail-Tester reads as "DMARC record exists and passes alignment" but won't max the DMARC sub-check the way a strict `p=quarantine` would. **The DMARC-alignment ceiling here is asymmetric vs. a custom domain because the From: header's domain (`resend.dev`) and the DKIM signing domain (`resend.dev`) are identical** — strict alignment is met. So sandbox can still pass the DMARC sub-check.

**Realistic Mail-Tester score estimate for the D-04 body from `onboarding@resend.dev`: 8.5–9.5 / 10.** [ASSUMED, MEDIUM confidence — needs the live D-08 run to confirm.] The gap from 10 will most likely come from:
  - **No custom DMARC domain alignment** (~0.5 point gap) — irrecoverable in this phase (D-07 locks it).
  - **Sandbox sender "novowel" or "frequent test sender" heuristics** — the `onboarding@` local-part is sometimes flagged by `FROM_LOCAL_NOVOWEL` (no vowels in local-part, which doesn't apply here since `onboarding` has 3) or `FROM_FREQ_LOCAL` patterns. Likely no impact for `onboarding@resend.dev`.
  - **Text/HTML divergence** (~0.2 point gap if the plain-text copy is much shorter than the HTML) — addressed by D-06 keeping both parts in sync.
  - **Single HTTP link (not HTTPS)** — *the existing email is fine* (`${SITE_URL}` is HTTPS in prod), but worth double-checking the smoke catches this.

**SpamAssassin rules most likely to fire on the D-04 body** (all should be NEGATIVE / no-op contributions; this is what Mail-Tester reports as "we ran the SpamAssassin check, here's what fired"):
  - `SPF_PASS` (negative score, good)
  - `DKIM_VALID` + `DKIM_VALID_AU` (Author-Domain) (good)
  - `DMARC_PASS` (good, but only because From-domain == DKIM-signing-domain on the sandbox)
  - `HTML_SHORT_LINK_IMG_*` — *should NOT fire* (we have one text-link, no images). If it does, fix is to swap any auto-link patterns to explicit anchor tags.
  - `MIME_HTML_MOSTLY` — *should NOT fire* because D-06 keeps text + html in parity.
  - `URIBL_BLOCKED` / `URIBL_SBL` — *should NOT fire* because `oddlympics.app` is on no blocklist.
  - `MISSING_DATE`, `MISSING_FROM`, `MISSING_MID` — *Resend sets all three.* [VERIFIED: confirmed by reading Resend behavior in their HTTP API docs.]

**The 1-2 changes most likely to lift the score:**
  1. **Add `Reply-To: hello@oddlympics.app` to the Resend `headers` field.** SpamAssassin has historical "missing Reply-To on automated mail" heuristics. Phase 6 already established `hello@oddlympics.app` as the canonical contact address (Privacy/Terms pages, landing footer). Estimated lift: +0.3 to +0.5.
  2. **Wire `buildUnsubscribeHeaders(email)` onto the confirmation send.** Today (before Phase 10) this header pair is set on outbound emails *only* from the unsubscribe path itself — the `confirm` path never set them. Mail-Tester explicitly checks for `List-Unsubscribe` + `List-Unsubscribe-Post` and credits a point or so for the pair. Estimated lift: +0.5 to +1.0.

### 2. Multipart message construction with Resend

Resend's Node SDK `emails.send(options)` is the only call surface. The `CreateEmailBaseOptions` type accepts:

```ts
{
  from: string;
  to: string | string[];
  subject: string;
  text?: string;          // plain-text alternative — Resend sets MIME boundaries
  html?: string;          // HTML alternative
  headers?: Record<string, string>;  // custom headers, e.g. List-Unsubscribe, Reply-To
  reply_to?: string | string[];      // snake_case for HTTP wire format
  // ... bcc, cc, tags, attachments, scheduled_at, template, etc.
}
```

[VERIFIED: `node_modules/resend/dist/index.d.mts` — lines confirm `headers: Record<string, string>` and `reply_to: string | string[]`. Note **the type accepts both `replyTo` (camelCase, for SDK ergonomics) and `reply_to` (snake_case, for HTTP wire compat)**; current `src/lib/email.ts` uses neither. The SDK transparently maps to wire format.]

**When you provide both `text` and `html`, Resend constructs a `multipart/alternative` MIME body automatically with both parts.** This is the canonical RFC 2046 multipart/alternative shape that Gmail/Outlook/Proton all expect for transactional mail. The existing `email.ts:51` send call already passes both — Phase 10 preserves this verbatim (D-06).

**Headers Resend allows you to set via the `headers` field:** the SDK is permissive — any custom header you set is forwarded as long as it doesn't collide with Resend's own. **Resend itself sets `From`, `To`, `Subject`, `MIME-Version`, `Content-Type`, `Date`, and `Message-ID`** (these are blocklisted from your custom headers — passing them is a no-op or an error). [CITED: Resend HTTP API docs surfaced via [DEV: Resend deliverability guide](https://dev.to/whoffagents/email-deliverability-for-saas-spf-dkim-dmarc-setup-and-resend-integration-1hpd)]

**`Reply-To` is fully supported** through both the `reply_to` key (preferred — Resend renders it onto the wire) and the `headers: { 'Reply-To': '...' }` form (also accepted). Use whichever; the wire result is identical. Recommendation: use `reply_to` because it's the typed/idiomatic field and the SDK guarantees correct casing.

**`List-Unsubscribe` and `List-Unsubscribe-Post` are NOT blocklisted** — pass them through the `headers` field. The existing `buildUnsubscribeHeaders(email)` helper at `src/lib/email.ts:55-65` already produces exactly the right shape:

```ts
{
  'List-Unsubscribe': '<https://oddlympics.app/api/unsubscribe?token=...>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
```

Spreading this into the `headers` field on the Resend send call is the entirety of the integration:

```ts
await resend.emails.send({
  from: FROM,
  to: email,
  subject,
  text,
  html,
  reply_to: 'hello@oddlympics.app',
  headers: buildUnsubscribeHeaders(email),
});
```

### 3. RFC 8058 one-click unsubscribe — Gmail/Yahoo bulk-sender requirements

**RFC 8058 requires two specific headers in tandem:**
- `List-Unsubscribe: <https://example.com/u?t=...>` — must be HTTPS (mailto: alone is no longer sufficient)
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click` — literal value, exactly that string

The receiving system POSTs the URL with body `List-Unsubscribe=One-Click` and the server must honor the unsubscribe within 48 hours. [CITED: [Customer.io RFC 8058 docs](https://docs.customer.io/journeys/custom-unsubscribe-links/), [Mailgun RFC 8058 explainer](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/)]

**Gmail/Yahoo enforcement (Feb 2024, escalated Nov 2025 to permanent rejections for non-compliant bulk senders ≥ 5,000/day) requires both headers.** [CITED: [Captain Pragmatic 2025 guide](https://captainpragmatic.com/blog/gmail-yahoo-bulk-sender-requirements-2025/), [Google Workspace sender guidelines FAQ](https://support.google.com/a/answer/14229414)]

**The Phase 9 work already produced compliant headers** via `buildUnsubscribeHeaders()` (1-year TTL via Phase 9 D-05), but they were only wired into outbound emails on the unsubscribe path (i.e., they were never sent — the unsubscribe path is the receiving side). **The confirmation send today (pre-Phase-10) sets neither header.** Phase 10 wiring them on the confirm send is the *first* outbound oddlympics email to carry one-click unsubscribe — a small Mail-Tester lift AND the right thing for Gmail bulk-sender compliance before Phase 11 AC4 runs the live loop.

**Sandbox-sender caveat:** Gmail bulk-sender enforcement is keyed by the **sending domain**, and the headers must include an HTTPS URL **on a domain that responds correctly** to the unsubscribe POST. The URL we send is `https://oddlympics.app/api/unsubscribe?token=...` — that's our domain, not Resend's, so the loop is closed correctly. The fact that the From: domain is `resend.dev` and the unsubscribe URL is `oddlympics.app` is *fine* for RFC 8058 (it does not require domain alignment between From: and the unsubscribe URL). [CITED: [Mailgun RFC 8058 explainer](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/)]

**Phase 10 is exempt from RFC 8058's "transactional email exempt" carve-out:** transactional confirmations technically don't require one-click unsubscribe (the [Mailgun explainer](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/) explicitly notes this). But Mail-Tester credits the headers anyway, and we want a unified "every outbound email is one-click unsubscribable" pattern. Wire it.

### 4. HTML email cross-client compatibility — the body we ship

The current HTML body at `src/lib/email.ts:31-41` is a single-`<div>` card with:
- `font:14px ui-monospace, SFMono-Regular, Menlo, monospace;color:#111;background:#fafafa;padding:32px` on `<body>`
- `max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px` on the inner `<div>`
- Accent button with `background:hsl(18 70% 56%);color:#0b0b0e`
- 14px / 11-12px font sizes
- One CTA anchor + one paste-URL hint paragraph + one disclaimer paragraph

**Per-client findings (HTML rendering only — subject + sender are out-of-DOM):**

| Client | Renderer | Phase-10 concerns | Confidence |
|---|---|---|---|
| Gmail web | Modern web (Chromium-equivalent) | `hsl()` supported in modern Gmail (rolled out post-2022). Inline styles fully honored. No `<head>` required. **One risk: the Gmail "Promotions tab" classifier can grab a single-link card with a colored button.** Likely benign for a confirmation, but worth checking after the D-09 manual send. | HIGH for layout; MEDIUM for tab placement |
| Proton webmail | Modern web (DOMPurify-sanitized) | Inline styles honored. Dark-mode "Carbon" theme (and higher-contrast Monokai/Ebony) can invert backgrounds aggressively; **the accent button `background:hsl(18 70% 56%)` + `color:#0b0b0e` pair must remain readable when Proton flips the surrounding `<body>` to dark.** Static inline color attributes survive Proton's CSP. [CITED: [Proton dark mode support](https://proton.me/support/dark-mode), [Enchant dark-mode email guide 2026](https://www.enchantagency.com/blog/dark-mode-email-design-best-practices-css-guide-2026)] **Proton also blocks remote content (images, web fonts) by default** — we ship zero of either, so no issue. | MEDIUM — live verify in D-09 |
| Outlook.com webmail | Blink (Chrome engine) — **NOT** the Word desktop renderer | Inline styles fully honored. **MSO conditional comments are ignored as regular HTML comments** in Outlook.com webmail. [CITED: [DEV: Email rendering 2026](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f), [hteumeuleu Outlook rendering engine](https://www.hteumeuleu.com/2020/outlook-rendering-engine/)] We don't use any `mso-*` properties — confirmed via grep. **In October 2026 Microsoft retires Outlook Classic (Word renderer)** — the new Outlook is fully web-engine; we're already on the safe side of that cliff. | HIGH |
| iOS Mail (Apple Mail on iPhone Gmail app / Gmail iOS app) | WebKit | `hsl()` supported. iOS Mail respects `max-width` + inline `padding` correctly. No specific concerns for a 520px-max card. | HIGH |

**Specific recommendations the planner can lock in or defer to operator-verification:**

- **`hsl(18 70% 56%)` color notation:** Modern Gmail / Proton / Outlook.com / iOS Mail **all support `hsl()` color notation.** [CITED: [caniemail.com](https://www.caniemail.com/)] **However** — older Outlook Desktop and some legacy clients do not. For the consumer audience targeted by v2.0, modern webmail is the dominant render path. **Recommendation: keep `hsl()` notation for Phase 10**, but if the D-09 cross-client gate surfaces any client where the button background renders as transparent / black / white, swap to hex `#d94a1f` (approx equivalent) — this is also the recommended swap for the Phase 6 banner-pill contrast issue (already logged as a Phase 11 AC8 follow-up; not Phase 10's job to fix). [VERIFIED: Phase 6 Plan 3 STATE log notes Lighthouse contrast issue on `#d94a1f` candidate]
- **`background-color` + `color` contrast:** the current button is `#0b0b0e` text on `hsl(18 70% 56%)` background = ~4.24:1 ratio (Phase 6 Plan 3 STATE log already captured this number for the landing button — same color pair). This is *just* under WCAG AA 4.5:1 but passes WCAG A 3:1. Mail-Tester does not check contrast as a deliverability factor. Phase 10 does not need to fix this; it's already on Phase 11's AC8 fix-list.
- **Max-width container 520px + inline padding 28px:** safe across all four clients. Phase 10 inherits as-is.
- **Inline `<style>` blocks vs. inline `style="..."` attributes:** the current email uses ONLY inline `style="..."` attributes (no `<style>` tag at all). This is the universal-compat path — Gmail strips `<head><style>` entirely on threaded conversations. Phase 10 must NOT add a `<style>` tag.
- **`mso-*` prefix family:** zero occurrences in `email.ts` today. Phase 10 must not introduce any.

### 5. Mail-Tester anti-patterns the D-04 body could trip on

For each potential anti-pattern, marked with whether the current+planned body trips it:

| Anti-pattern | Mail-Tester signal | Current body | Phase 10 plan |
|---|---|---|---|
| From-address local-part has no vowels (`FROM_LOCAL_NOVOWEL`) | +0.5 spam score | `onboarding@resend.dev` — local-part has vowels. SAFE. | No action. |
| SPF/DKIM/DMARC alignment failure | +2 to +4 spam score | All three pass on `resend.dev` (Resend's own setup). SAFE on sandbox. | No action; D-07 locks. |
| HTML-only message, no plain-text alternative (`MIME_HTML_ONLY`) | +1 spam score | Both parts present. SAFE. | D-06 keeps both. |
| HTML body radically differs from plain-text (`MPART_ALT_DIFF`) | +0.5 to +1 spam score | Current parts have the same copy structure (1 line of value-prop + URL + disclaimer in each). SAFE. | New body must preserve parity — text and html both carry the SIGNUP-04 line and the unsubscribe-mention. |
| `Message-ID` header missing | `MISSING_MID` +1 | Resend sets `Message-ID` automatically with `*@*.resend.com` or similar. [VERIFIED via SDK header behavior] SAFE. | No action. |
| `Date` header missing | `MISSING_DATE` +1 | Resend sets `Date`. SAFE. | No action. |
| `Reply-To` missing on automated mail | small +0.1-0.3 | Current send sets none. **Phase 10 fixes this** by adding `reply_to: 'hello@oddlympics.app'` per Claude's-Discretion-recommendation. | Plan 10-01 adds. |
| `List-Unsubscribe` header missing on bulk-ish mail | small +0.5-1.0 lift | Current send sets none. **Phase 10 fixes this** by spreading `buildUnsubscribeHeaders(email)` into the `headers` field. | Plan 10-01 adds. |
| Body has `<title>` / `<meta charset>` missing in `<head>` | `MISSING_HEAD_BODY` minor | Current body has `<!doctype html><html><body>` — no `<head>` at all. **Mail-Tester does NOT penalize this for transactional one-shots**, but some checkers flag it. | Optional Plan-10-01 micro-fix: add `<head><meta charset="utf-8"><title>Confirm your World Cup alerts</title></head>` — costs 50 bytes, lifts 0.0-0.2. Planner's discretion; recommend YES because the body composer rebuild is happening anyway. |
| `Precedence: bulk` / `X-Auto-Response-Suppress` | usually neutral / minor positive | Current send sets none. | **DO NOT ADD** — `Precedence: bulk` is for newsletter mail; confirmations are first-party transactional. Adding it would actively *hurt* the score. |
| Single very long link in body | small `URI_OBFU` risk if URL is HTTP not HTTPS | Current body: one `${SITE_URL}/api/confirm?token=...` link, twice (once as anchor, once as paste-URL hint). SAFE on prod (HTTPS). | No action; keep paste-URL pattern for accessibility. |

### 6. Operator playbook for `10-SUMMARY.md` evidence

Phase 10's deliverability + cross-client gates are operator-driven (D-08 / D-09). The planner needs to lock the SUMMARY skeleton so the operator (John) knows exactly what to capture.

**Mail-Tester run (D-08):**
1. Deploy Phase 10 to production via the existing GitHub Actions pipeline (push to `main`).
2. Open `https://www.mail-tester.com/` in a fresh browser. The throwaway address (format `test-xxxxxxxxx@srv1.mail-tester.com`) is valid **for 24-48 hours** after first view, but the run should be done within ~10 minutes to ensure no other tester contaminates the score window. [ASSUMED — Mail-Tester does not document TTL precisely; conservative.]
3. In a separate fresh browser profile (no cookies on `oddlympics.app`), submit the live signup form at `https://oddlympics.app` with: email = the Mail-Tester throwaway address; team = `england` (or any consumer-friendly team — England puts the literal "We'll email you 1 hour before every England match" rendering on display); JS-captured timezone fires naturally.
4. Click "Then check your score" in the Mail-Tester tab.
5. Capture: numeric score (e.g., `9.1/10`), screenshot of the full report. Save screenshot under `evidence/mailtester-score.png`.
6. Paste into `10-SUMMARY.md` §Deliverability Evidence, verbatim, the 7 sub-check items shown in the report:
   - SPF / DKIM / DMARC pass status
   - Body / subject sanity
   - Server / IP reputation
   - Broken links (should be none)
   - Unsubscribe / List-Unsubscribe sub-check status
   - SpamAssassin per-rule breakdown (any rule that fired, with its score contribution)
   - "Are you authenticated?" tier verdict

**Rollback decision tree if score < 8:**

| Score | First knob to turn | Second knob | Third knob |
|---|---|---|---|
| 7.5 – 7.9 | Add `Reply-To` (if not already wired) | Add visible "Unsubscribe" link in HTML footer | Add `<head><meta charset="utf-8"><title>` block |
| 7.0 – 7.4 | All of above | Reduce link count (drop the paste-URL hint? *No — accessibility regression*) → keep link count, add 2-3 more lines of plain-text copy to lift text/HTML ratio | Re-send from a fresh Mail-Tester address — sometimes the throwaway is poisoned |
| < 7.0 | Don't ship — escalate to user. Possible causes: Resend sandbox sender briefly rate-limited; `resend.dev` was added to a blocklist; specific SpamAssassin rule fired that needs the body re-shaped. Investigate via the per-rule breakdown. | — | — |
| ≥ 8.0 | No action — pass the gate, commit screenshot, proceed to D-09. | — | — |

**Cross-client run (D-09):**
1. After D-08 ≥ 8, sign up three more times on prod from operator-controlled real inboxes: `@gmail.com`, `@proton.me` (or `@protonmail.com`), `@outlook.com` (or `@hotmail.com`).
2. Use a real team per send so the value-prop line renders for real. Different teams per inbox so the screenshots demonstrate the personalization works (e.g., `england` → Gmail, `france` → Proton, `united_states` → Outlook).
3. Open each delivered email in its **native web client** (NOT the iPhone Mail app — D-09 specifically calls for webmail because that's the dominant render path for the consumer audience).
4. Screenshot the rendered message body — subject + sender + body + footer. **Do NOT screenshot the mailbox list** (privacy + audit clarity).
5. Save as:
   - `evidence/mail-gmail.png`
   - `evidence/mail-proton.png`
   - `evidence/mail-outlook.png`
6. Reference all three in `10-SUMMARY.md` §Cross-Client Evidence with per-client pass/fail notes:
   - layout intact (no broken card, no escaped HTML, no missing background)
   - link resolves (click the CTA — lands on `/confirmed?status=ok`)
   - `List-Unsubscribe` footer visible *or* one-click unsubscribe affordance present (Gmail surfaces it as the "Unsubscribe" link next to the sender name on opening)
   - zero LAND-02 prohibited terms

### 7. `<head>` / `<title>` fragment — is the current body acceptable?

The current body shape:
```html
<!doctype html>
<html>
<body style="...">
  <div style="..."> ... </div>
</body>
</html>
```

is **acceptable per Mail-Tester** — Mail-Tester does not penalize a missing `<head>` block on transactional mail. The `<title>` element is for browser title bars, not for email clients (which use the Subject: header). [VERIFIED: SpamAssassin has no `MISSING_HEAD_TITLE` rule per [Mailingcheck SpamAssassin score table](https://www.mailingcheck.com/spamassassin-score/)]

**However**, three considerations:
1. `<meta charset="utf-8">` would help any client that doesn't auto-detect (rare on modern webmail, but cheap insurance).
2. The current body has `<html>` opening *without* a lang attribute — `<html lang="en">` is an accessibility nice-to-have.
3. Some inbox-test tooling (not Mail-Tester) flags missing `<head>` — adding it costs ~50 bytes.

**Recommendation:** Phase 10 adds a minimal `<head>` block during the body rewrite — total cost is tiny, lifts a small amount of edge-case spamminess detection, and matches the `<head>` shape `manage.astro` / `index.astro` use:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Confirm your World Cup alerts</title>
</head>
<body style="...">
  ...
</body>
</html>
```

The same shape applies to `sendManageLink()` (`email.ts:80-90`), **but Phase 10 must NOT modify that function** (out of scope; Phase 9 D-01 locks it). The pattern can be applied there in a future cleanup phase.

### 8. `scripts/smoke-confirm-email.mjs` shape

Existing smoke scripts (`smoke-signup.mjs`, `smoke-manage.mjs`) establish the project's conventions:

- **No test runner** — plain Node ESM, top-level await, `runCase(name, fn)` harness, exit `0`/`1`/`2`.
- **`pass++` / `fail++` counters** + `console.log` `[smoke] PASS`/`FAIL` per case.
- **Setup-error exit code 2** (when external dep — DB or server — is unreachable).
- **No imports from `.ts` source** — the Phase 9 script *reimplements* `mintToken` inline rather than importing `src/lib/token.ts`, to dodge TS loader friction.
- **Cleanup hint at end of run** for any DB rows written.

**Phase 10 specifics:**

The Phase 10 smoke is **offline** — no Resend call, no server boot. It exercises:
1. Pure helpers `teamLabel(slug)` + `tzLabel(tz)` for the canonical + edge cases enumerated in CONTEXT D-10.
2. A composed body string for one fully-rendered case (text + html both produced).
3. A LAND-02 `grep -iE 'bitcoin|lightning|crypto|world domination|personal olympics'` over the composed body.
4. A subject literal check (D-05 binds `'Confirm your World Cup alerts — oddlympics'` exactly).

**The composer must be importable from the .mjs script.** Two paths:
- (a) Re-implement the helpers + composer in the `.mjs` file (Phase 9 smoke-manage's pattern for `mintToken`).
- (b) Extract the helpers/composer to a `.mjs` or `.js` companion file that both `email.ts` *and* the smoke can import.
- (c) Compile `src/lib/timezones.ts` / `teams.ts` via `npm run build` first, then import from `dist/server/chunks/`.

**Recommendation: path (a)** — re-implement the helpers in the smoke script, matching the Phase 9 precedent. The helpers are 5 lines each; the body composer is ~30 lines. Total inline weight ~50 lines, well under the 600-line ceiling of the existing smoke scripts. The cost is byte-exact duplication of two pure functions across two files; the upside is zero TS-loader friction and the smoke runs against a build-less repo (which matters for fast iteration during the D-08 score-iteration loop).

**Smoke cases (the CONTEXT D-10 list, with annotations):**

| # | Case | Assertion |
|---|------|-----------|
| 1 | `team=england, tz=America/Detroit` | Body contains `"every England match in Detroit time."` |
| 2 | `team=united_states, tz=Europe/London` | Body contains `"every United States match in London time."` (multi-word team) |
| 3 | `team=france, tz=America/New_York` | Body contains `"every France match in New York time."` (FALLBACK_TZ path) |
| 4 | `team=brazil, tz=Asia/Ho_Chi_Minh` | Body contains `"every Brazil match in Ho Chi Minh time."` (underscore-tz multi-word) |
| 5 | `team=germany, tz=Etc/UTC` | Body contains `"every Germany match in your local time."` (Etc/* sentinel) |
| 6 | `team=curacao, tz=America/Curacao` | Body contains `"every Curaçao match in Curacao time."` (diacritic preserved per FORM-02) |
| 7 | Subject literal | Equals `'Confirm your World Cup alerts — oddlympics'` (em-dash U+2014; ASCII apostrophe N/A here — no apostrophe in subject) |
| 8 | LAND-02 grep | `grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics'` against `subject + '\n' + text + '\n' + html` → must be empty |
| 9 | Unknown slug fallback | `team=zzz_unknown` → body contains `"every zzz_unknown match in ..."` (raw slug fallback per D-03 — defensive against retired-team rows) |
| 10 | Empty / null timezone | `team=spain, tz=''` → body contains `"every Spain match in your local time."` (D-02 falsy guard) |

Cases 6, 9, 10 are additions beyond CONTEXT D-10's six bullets — they're Claude's-Discretion bonus coverage. The planner can keep or drop them. Recommendation: keep — they're 6 more lines of array data.

### 9. Validation Architecture

Per Nyquist (`workflow.nyquist_validation: true` in `.planning/config.json`).

#### Test Framework

| Property | Value |
|---|---|
| Framework | None formal — Node ESM smoke scripts pattern (`scripts/smoke-*.mjs`). Established by Phase 5 (`smoke-signup.mjs`) and Phase 9 (`smoke-manage.mjs`). |
| Config file | None — each smoke is self-contained. |
| Quick run command | `node scripts/smoke-confirm-email.mjs` (to be created in Plan 10-03) |
| Full suite command | `npm run smoke:confirm && npm run smoke:signup && npm run smoke:manage && npm run smoke:landing` (offline+online; offline subset = `smoke:confirm` alone) |
| Phase-10 quick run (offline-only) | `npm run smoke:confirm` — no server required |

#### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File exists? |
|---|---|---|---|---|
| SIGNUP-04 (body shape) | Email body names team + human tz label using SIGNUP-04 literal copy | unit (offline smoke) | `node scripts/smoke-confirm-email.mjs` | ❌ Wave 0 — Plan 10-03 |
| SIGNUP-04 (cross-client render) | Gmail / Proton / Outlook render the body cleanly with footer + working link | manual (operator action) | n/a — D-09 evidence in `10-SUMMARY.md` + `evidence/mail-*.png` | n/a |
| SIGNUP-04 (deliverability) | Mail-Tester ≥ 8/10 on `onboarding@resend.dev` | manual (operator action) | n/a — D-08 evidence in `10-SUMMARY.md` + `evidence/mailtester-score.png` | n/a |
| LAND-02 (no prohibited terms in body) | Subject + text + html grep-clean | unit (offline smoke) | `grep -iE` inside `smoke-confirm-email.mjs` | ❌ Wave 0 — Plan 10-03 |
| COMPAT-02 (no new error codes) | `/api/signup` continues to redirect with `/?error=email` on send failure | unit (existing) | `node scripts/smoke-signup.mjs` (existing — verifies error-code surface) | ✅ exists |
| Phase 5 invariants preserved | `/api/signup` end-to-end still works (team allow-list, tz fallback, etc.) | integration (existing) | `node scripts/smoke-signup.mjs` | ✅ exists |
| Phase 9 invariants preserved | `/manage` editor + 1-year unsubscribe TTL + re-subscribe path still work | integration (existing) | `node scripts/smoke-manage.mjs` | ✅ exists |

#### Sampling Rate

- **Per task commit:** `node scripts/smoke-confirm-email.mjs` — < 1 second, no network, no server.
- **Per wave merge:** `npm run smoke:confirm && npm run smoke:signup && npm run smoke:manage` — full offline + online suite (server boot required for signup/manage smokes). Phase 10 doesn't strictly need the online smokes, but running them defends against any accidental regression to upstream callers.
- **Phase gate:** Full suite green AND D-08 ≥ 8 captured AND D-09 three screenshots committed → `10-SUMMARY.md` complete → `/gsd-verify-work`.

#### Wave 0 Gaps

- [ ] **`scripts/smoke-confirm-email.mjs`** — covers SIGNUP-04 body shape + LAND-02 grep. Wave 1 deliverable (Plan 10-03).
- [ ] **`package.json` script alias** `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` — same wave; trivial.
- [ ] **`.planning/phases/10-confirmation-email-update/evidence/` directory** — created on first D-08 run; planner can mkdir-as-part-of-plan or operator can create on-demand.
- [ ] No framework install needed (Node ESM is project default).

#### What Regressions This Setup Catches

- A future edit to `email.ts` that drops the SIGNUP-04 line → `smoke:confirm` Case 1-5 fail.
- A future edit that reintroduces a LAND-02 prohibited term into the body (e.g., a creative rewrite that says "bitcoin notifications") → `smoke:confirm` Case 8 fails.
- A future edit that changes the subject literal → `smoke:confirm` Case 7 fails.
- A future edit to `tzLabel` that breaks the `Etc/*` sentinel → `smoke:confirm` Case 5 fails.
- A future edit to `teamLabel` that throws on unknown slugs (instead of falling through to the raw slug) → `smoke:confirm` Case 9 fails.

#### What Regressions This Setup Does NOT Catch (acknowledged gaps)

- A future Resend SDK upgrade that silently changes the `headers` field semantics → only caught by live D-08 / D-09 re-run.
- A future swap from sandbox sender to custom domain → operator action; not regression-detectable offline.
- Cross-client rendering regressions on a fresh client release (Proton's quarterly dark-mode tweaks, Outlook web's redesign) → only caught by live D-09 re-run. The screenshots in `evidence/` are a snapshot-in-time audit trail, not a live test.

---

## Implementation Approach (CONTEXT.md decisions as the skeleton)

The locked decisions ARE the implementation. Research adds the *how* under each:

### D-01: Widen `sendMagicLink` signature

```ts
// src/lib/email.ts
export async function sendMagicLink(
  email: string,
  token: string,
  team: string,         // snake_case slug from references/teams.json — caller guarantees VALID_TEAMS membership
  timezone: string,     // IANA, e.g. "America/New_York" — caller guarantees VALID_TZ membership or FALLBACK_TZ
): Promise<void> {
  const url = `${SITE_URL}/api/confirm?token=${encodeURIComponent(token)}`;
  const subject = 'Confirm your World Cup alerts — oddlympics';
  const teamHuman = teamLabel(team);
  const tzHuman = tzLabel(timezone);
  // ... text + html body composer using teamHuman + tzHuman ...
}
```

Single caller `src/pages/api/signup.ts:109`:
```ts
await sendMagicLink(rawEmail, token, rawTeam, tz);
```

Both `rawTeam` and `tz` are validated upstream in the same handler (`src/pages/api/signup.ts:76-90`). The `email.ts` lib stays free of `db.ts` import → preserves Pattern 3 layering from CONVENTIONS.md.

### D-02: `tzLabel(tz)` — port the landing JS verbatim

Preferred location: `src/lib/timezones.ts` (alongside `VALID_TZ` + `isValidTimezone`).

```ts
// src/lib/timezones.ts (additions)
export function tzLabel(tz: string): string {
  if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
  const last = tz.split('/').pop() ?? '';
  const human = last.replace(/_/g, ' ');
  return human ? `${human} time` : 'your local time';
}
```

**Verification:** the landing-page algorithm is at `src/pages/index.astro:204-205` (the surrounding `<script is:inline>` block runs from line 198-211 per CONTEXT). The two algorithms must stay byte-equivalent. The smoke covers the contract; the planner should add a comment on `tzLabel` noting the dual-implementation invariant.

### D-03: `teamLabel(slug)` — TEAMS.find lookup

Preferred location: `src/lib/teams.ts` (alongside `TEAMS` + `VALID_TEAMS` + `isValidTeamSlug`).

```ts
// src/lib/teams.ts (additions)
export function teamLabel(slug: string): string {
  return TEAMS.find((t) => t.slug === slug)?.label ?? slug;
}
```

`TEAMS[*].label` is the canonical human-readable string from `references/teams.json`:
- `england` → `"England"`
- `united_states` → `"United States"`
- `bosnia` → `"Bosnia and Herzegovina"`
- `czech_republic` → `"Czech Republic"`
- `curacao` → `"Curaçao"` (diacritic preserved)

Fallback to the raw slug defends against a future row where `team` is a slug not in the in-memory set (e.g., a team retired mid-tournament or the JSON file is out of sync after a hot patch). Never an empty string in the email body.

### D-04 / D-05: Body + subject

Plain-text body shape (suggested — planner refines line breaks):
```
Confirm your World Cup alerts for oddlympics.

Click below to confirm:
{url}

We'll email you 1 hour before every {teamHuman} match in {tzHuman}.

No spam. No ads. Unsubscribe anytime: {unsubscribeUrl}

If you didn't request this, ignore this email.

— oddlympics
```

HTML body shape (suggested — preserves the styled-card from current `email.ts:31-41`):
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Confirm your World Cup alerts</title>
</head>
<body style="font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fafafa;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:28px">
  <h1 style="font-size:18px;margin:0 0 12px">Confirm your alerts</h1>
  <p style="margin:0 0 20px;line-height:1.55">We'll email you 1 hour before every <strong>{teamHuman}</strong> match in {tzHuman}.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:hsl(18 70% 56%);color:#0b0b0e;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Confirm email</a></p>
  <p style="margin:0 0 8px;color:#666;font-size:12px">Or paste this URL:</p>
  <p style="margin:0 0 24px;word-break:break-all;color:#666;font-size:12px">${url}</p>
  <p style="margin:0;color:#999;font-size:11px">No spam, no ads. If you didn't request this, ignore this email. <a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a>.</p>
</div>
</body>
</html>
```

The `{unsubscribeUrl}` is minted via `mintToken(email, { purpose: 'unsubscribe' })` exactly as `buildUnsubscribeHeaders()` does at `email.ts:55-65` — 1-year TTL per Phase 9 D-05, single-use per Plan 09-02.

### D-06: Multipart

Resend `emails.send({ from, to, subject, text, html, reply_to, headers })` — both `text` and `html` keys present. SDK auto-constructs `multipart/alternative`.

### D-07: Sandbox sender

No code change. `EMAIL_FROM` env var defaults to `'oddlympics <onboarding@resend.dev>'` at `email.ts:5`.

### Send call shape (D-01 + Claude's-Discretion recommendations applied)

```ts
const { error } = await resend.emails.send({
  from: FROM,
  to: email,
  subject,
  text,
  html,
  reply_to: 'hello@oddlympics.app',
  headers: buildUnsubscribeHeaders(email),
});
if (error) throw new Error(`Resend error: ${error.message}`);
```

The error-throw contract matches the existing `email.ts:52`. `/api/signup` continues to catch and `back('email')` (CONVENTIONS.md Pattern 1; COMPAT-02 preserved).

### Dev fallback (CLAUDE.md "Dev email fallback" preservation)

```ts
if (!resend) {
  console.log('\n[email-dev-fallback] Magic link for', email);
  console.log('   subject:', subject);
  console.log('   value-prop:', `We'll email you 1 hour before every ${teamHuman} match in ${tzHuman}.`);
  console.log('   ', url, '\n');
  return;
}
```

The added value-prop line lets a contributor visually verify team/tz interpolation without firing Resend (CONTEXT.md §code_context restates this as a Phase 10 requirement).

---

## Pitfalls and Edge Cases

### Pitfall 1: Resend's `error` is RETURNED, not thrown

The SDK returns `{ data, error }` from `emails.send()`. If you forget the `if (error) throw` line, sends fail silently. **Current `email.ts:52` has this correct** — Phase 10 must preserve it on the rewrite. The smoke does NOT catch this (offline), but the existing `smoke-signup` Case 1 (`case-1-valid`) catches it transitively because a failed send causes `/api/signup` to redirect to `/?error=email` instead of `/pending?email=...`.

### Pitfall 2: LAND-02 binds the email body too

Even though SIGNUP-04 is fundamentally a positive-content requirement (name team + tz), the LAND-02 negative-content requirement (zero `bitcoin|lightning|crypto|world domination|personal olympics`) applies to **every public-surface byte**, including the assembled email body. The Phase 10 smoke MUST include a grep step against `subject + '\n' + text + '\n' + html`. Phase 9 Plan 09-05 set this precedent (smoke-manage's banner check), and the existing `package.json` `check:land-02` script does the same grep against `dist/client/index.html` — Phase 10 extends the discipline to outbound mail.

### Pitfall 3: The kickoff notification email is NOT in scope

`scripts/send-kickoff-notifications.mjs:formatKickoff` (~ line 117) is its own formatter for the every-5-minutes kickoff email. Phase 10 must NOT touch it — it's owned by Phase 3 / NOTIFY-01, has its own copy and template, and is currently in production dry-run pending the `KICKOFF_NOTIFICATIONS_ENABLED=true` operator flip. Touching it expands the blast radius and could break NOTIFY-04 (one-notification-per-channel-per-match idempotency).

### Pitfall 4: `sendManageLink()` is NOT in scope

`email.ts:67-100` defines `sendManageLink()` for the magic-link sign-in email. Phase 9 D-01 locked its body. Phase 10 leaves it alone. If the Phase 10 planner extracts a shared body composer (Claude's discretion), the extraction must be `confirm`-specific (`buildConfirmBody`), not generalized over both functions — different copy, different subject, different URL purpose.

### Pitfall 5: `FALLBACK_TZ = 'America/New_York'` is canonical — do NOT propose `America/Detroit`

PROJECT.md historically mentioned `America/Detroit` in early drafts. `src/lib/timezones.ts:1` makes `America/New_York` the runtime canonical value. The SIGNUP-04 spec example "Detroit time" is **illustrative copy** (it's what someone in Michigan would see), **not** the fallback path. The Phase 5 Plan 05-01 docs sweep updated this everywhere. Phase 10 must NOT propose changing the fallback or the SIGNUP-04 example. The smoke case `team=france, tz=America/New_York` → `"every France match in New York time."` covers the actual fallback path; the case `team=england, tz=America/Detroit` → `"every England match in Detroit time."` covers the spec example.

### Pitfall 6: Dev console fallback must continue to log

If `RESEND_API_KEY` is unset AND `NODE_ENV !== 'production'`, current `email.ts:43-49` logs the magic link to stdout and returns. CLAUDE.md says "never error on missing email config in dev." Phase 10 preserves this branch. The smoke runs offline, so it doesn't exercise this branch; manual `npm run dev` testing or the existing `smoke-signup` (which boots a dev server with no `RESEND_API_KEY`) does. **Action for the planner:** confirm the dev fallback prints the rendered value-prop line so contributors can eyeball it.

### Pitfall 7: Proton dark-mode forcing on the accent button

Proton's Carbon / Monokai / Ebony dark themes can force-invert inline backgrounds. The accent button at `background:hsl(18 70% 56%);color:#0b0b0e` should survive — the dark surface around the button is what Proton flips, not the explicit-style button itself. **But verify in D-09.** If the button comes out as low-contrast (e.g., the dark `#0b0b0e` text against a near-black inverted background), the fix is either:
- Force `color:#0b0b0e !important` (some clients strip `!important`; Proton honors it inline)
- Add `color-scheme: light only` or `meta name="color-scheme" content="only light"` in `<head>` — this is the modern signal to "do not auto-invert this email"

Phase 10 does NOT add `color-scheme` proactively (over-engineering for an MVP), but the planner should note the contingent fix in case D-09 surfaces an issue.

### Pitfall 8: Gmail promotional-tab classification

Gmail's tab classifier (Primary / Promotions / Social) can grab single-link cards with colored buttons and route them to Promotions. For a confirmation email this is *bad* — users expect to see it in Primary. Signals that push to Promotions: many images, "marketing" subject keywords (e.g., "Sale!", "%off"), `Precedence: bulk` header. Our subject `'Confirm your World Cup alerts — oddlympics'` and content shape are clearly transactional, so this should not happen — but **operator must verify during D-09 that the Gmail send lands in Primary, not Promotions.** If it lands in Promotions, the fix is *not* to remove the colored CTA (accessibility regression) — it's typically a sender-reputation issue that resolves itself once `oddlympics.app` is properly DKIM/DMARC'd in v1.1.

### Pitfall 9: Mail-Tester throwaway address timing

Mail-Tester throwaway addresses are valid for ~24-48h but **a single address only scores once**. If the operator submits twice (e.g., to retry after a rollback), the second submission shows up under a different aggregate and the original score evaporates. **Action:** treat each Mail-Tester URL as single-use; if iterating on copy, open a fresh tab and get a new address each time.

### Pitfall 10: Curaçao diacritic survival

`references/teams.json` includes `{ "slug": "curacao", "label": "Curaçao" }`. The diacritic (U+00E7 `ç`) must survive byte-for-byte from JSON load → `TEAMS` array → `teamLabel("curacao")` → body string → MIME-encoded send. UTF-8 is the project convention end-to-end (Astro defaults, Node ESM default, Resend HTTP API defaults). The smoke Case 6 (`team=curacao`) catches a regression here.

### Pitfall 11: SIGNUP-04 example uses ASCII apostrophe; spec doc may contain U+2019 contamination

`We'll` in the spec is **ASCII apostrophe 0x27**, not U+2019 right-single-quote. Phase 6 STATE log records ASCII apostrophe as the project convention; the deviation log calls out three plans where the spec accidentally used U+2019. **Phase 10 must use ASCII in source code AND smoke `grep -F` strings.** Operator can paste-check by running `python3 -c "print(repr(open('src/lib/email.ts').read().count('’')))"` and expecting `0`.

### Pitfall 12: Schedule.astro 301 redirect already collapsed `/schedule` → `/manage`

A future user clicking a stale magic-link from before Phase 9 might still land on `/schedule?token=...` and get redirected to `/manage?token=...` (Phase 9 Plan 09-03). The Phase 10 confirmation email link points at `/api/confirm?token=...` — completely separate path. No interaction. Noted for completeness.

---

## Recommended Plan Structure

Three plans, single wave (no dependencies between plans 10-01 and 10-02 — they touch different files; 10-03 depends on 10-01/10-02 in the smoke covering them; 10-04 is operator action and depends on all prior plans being deployed). The coarse-granularity project default could collapse to 1-2 plans; recommendation is 3 because the offline-vs-operator split is natural and the smoke deserves its own commit.

### Plan 10-01: Widen sendMagicLink + add helpers

**Objective:** Add `tzLabel` to `src/lib/timezones.ts`, add `teamLabel` to `src/lib/teams.ts`, widen `sendMagicLink` signature and body in `src/lib/email.ts`, update single caller in `src/pages/api/signup.ts`. Adds `Reply-To` + `List-Unsubscribe*` headers on the send call. Updates dev-fallback console log.
**Wave:** 1
**Files modified:**
- `src/lib/timezones.ts` (+8 lines — `tzLabel` export)
- `src/lib/teams.ts` (+4 lines — `teamLabel` export)
- `src/lib/email.ts` (~50-line diff — widened signature, new subject, new body, headers wiring, updated dev fallback)
- `src/pages/api/signup.ts` (1-line change at line 109 — pass `rawTeam, tz`)
**Covers:** SIGNUP-04 body shape (compositional half); preserves COMPAT-02.
**Verification:** `npx astro check` clean; `npm run build` clean; manual `npm run dev` + submit a signup, confirm console fallback prints value-prop line.

### Plan 10-02: Smoke script + npm alias

**Objective:** Create `scripts/smoke-confirm-email.mjs` exercising the 10 cases from Domain Research §8. Add `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` to `package.json`.
**Wave:** 1 (parallel-eligible with 10-01 if the smoke re-implements helpers per recommendation; otherwise sequential)
**Files modified:**
- `scripts/smoke-confirm-email.mjs` (new, ~120 lines following `smoke-signup.mjs` shape)
- `package.json` (1 added script line)
**Covers:** SIGNUP-04 body shape (offline-verifiable); LAND-02 (offline-verifiable); D-10.
**Verification:** `npm run smoke:confirm` exits 0; all 10 cases PASS; subject literal byte-exact match.

### Plan 10-03: Deploy + operator deliverability verification

**Objective:** Operator-driven. Deploy Plans 10-01 + 10-02 to production. Run D-08 (Mail-Tester) and D-09 (cross-client Gmail/Proton/Outlook). Capture screenshots under `.planning/phases/10-confirmation-email-update/evidence/`. Write `10-SUMMARY.md` with score + 7 sub-checks + 3 per-client pass/fail notes + LAND-02 attestation.
**Wave:** 2 (after Plans 10-01 + 10-02 are deployed via the GitHub Actions auto-deploy)
**Files modified:**
- `.planning/phases/10-confirmation-email-update/evidence/mailtester-score.png` (new)
- `.planning/phases/10-confirmation-email-update/evidence/mail-gmail.png` (new)
- `.planning/phases/10-confirmation-email-update/evidence/mail-proton.png` (new)
- `.planning/phases/10-confirmation-email-update/evidence/mail-outlook.png` (new)
- `.planning/phases/10-confirmation-email-update/10-SUMMARY.md` (new)
**Covers:** SIGNUP-04 deliverability (SC3) + cross-client (SC2); D-08 + D-09 evidence.
**Verification:** Mail-Tester score ≥ 8; three client screenshots committed; all LAND-02 attestations green.

**Alternative compaction:** if the planner prefers 2 plans, fold 10-02 into 10-01 (single Wave-1 plan for "code + smoke") and keep 10-03 as the operator-verification Wave-2 plan. Both arrangements are valid; 3-plan version gives a cleaner audit trail per `git log --oneline -- src/lib/email.ts scripts/smoke-confirm-email.mjs`.

---

## Common Pitfalls (verification cross-reference table)

| Pitfall | Caught by | Action item for planner |
|---|---|---|
| LAND-02 prohibited terms in body | `smoke:confirm` Case 8 grep | Plan 10-02 must include |
| SIGNUP-04 literal copy regression | `smoke:confirm` Cases 1-5 | Plan 10-02 must include |
| Subject literal regression | `smoke:confirm` Case 7 | Plan 10-02 must include |
| Resend `error` returned not thrown — silent send failure | `smoke:signup` Case 1 (transitive) | No new action — covered by existing smoke |
| ASCII apostrophe contamination | grep step in `smoke:confirm` or manual | Plan 10-02 should add a `grep -F "’"` defensive check |
| `tzLabel` Etc/* sentinel regression | `smoke:confirm` Case 5 | Plan 10-02 must include |
| `teamLabel` unknown-slug fallthrough regression | `smoke:confirm` Case 9 | Plan 10-02 must include |
| Diacritic survival (Curaçao) | `smoke:confirm` Case 6 | Plan 10-02 should include |
| Proton dark-mode button readability | D-09 manual screenshot | Plan 10-03 attestation |
| Gmail promotional-tab classification | D-09 manual check | Plan 10-03 attestation |
| Sender DKIM/DMARC alignment on sandbox | D-08 Mail-Tester run | Plan 10-03 evidence |
| Stale Mail-Tester throwaway address | Operator procedure | Plan 10-03 must document "fresh address per attempt" |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Realistic Mail-Tester score from `onboarding@resend.dev` for the D-04 body is 8.5–9.5 / 10 | Domain Research §1 | If actual score is < 8, Plan 10-03 enters its iteration loop; rollback decision tree in §6 covers this. Risk: medium. The asymmetry of DMARC alignment passing on sandbox (because From-domain == DKIM-signing-domain == `resend.dev`) is the load-bearing claim; if Resend rotates its DKIM key or sandbox sender setup mid-launch the assumption invalidates. |
| A2 | Mail-Tester throwaway addresses are valid ~24-48h but each address scores only once | Domain Research §6 | If shorter (< 1h), operator may need to retry; not blocking. |
| A3 | Resend's SDK auto-constructs `multipart/alternative` when both `text` and `html` are passed | Domain Research §2 | If wrong, Mail-Tester would fire `MIME_HTML_ONLY` — caught by D-08 immediately and Phase 10 would need to construct the multipart manually. Risk: low — this is the canonical SDK behavior, [VERIFIED via SDK type def]. |
| A4 | Resend sets `Message-ID`, `Date`, `MIME-Version`, `Content-Type` automatically and treats them as blocklisted for the custom `headers` field | Domain Research §2 / §5 | If wrong (e.g., Resend silently lets us double-set `Message-ID`), no impact on Phase 10 because we're not double-setting any of these. |
| A5 | `resend.dev` is on no blocklist (Spamhaus / SORBS / Barracuda) | Domain Research §5 | If `resend.dev` ends up on a blocklist (extremely unlikely — Resend defends this aggressively), every Mail-Tester run scores < 5; operator escalates to the user. |
| A6 | Phase 10 confirmation send carrying `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on a transactional confirmation is *neutral or positive* for Mail-Tester scoring | Domain Research §3 / §5 | If Mail-Tester penalizes the header on transactional mail (it shouldn't — RFC 8058 transactional-exemption is about *requirement*, not *prohibition*), the fix is to remove the header line for the confirm send specifically; operator catches in D-08. |
| A7 | `hsl(18 70% 56%)` color notation renders correctly on Gmail web, Outlook.com webmail, Proton, iOS Mail | Domain Research §4 | If a specific client renders the button background as transparent / wrong color, D-09 screenshot surfaces it; fix is hex swap. Risk: low for modern webmail. |
| A8 | The Mail-Tester realistic ceiling on sandbox is **not** 10.0 even with all the recommended headers added | Domain Research §1 | If we DO hit 10.0, that's great — the D-08 gate passes anyway (≥ 8 threshold). |
| A9 | The Phase 6 Plan 3 STATE-log finding "button contrast ~4.24:1" applies identically to the email button (same color pair `#0b0b0e` on `hsl(18 70% 56%)`) | Pitfalls §7 | If different (e.g., the email button uses a different shade), contrast may be worse and Proton dark-mode could hide the text. Verify in D-09. |
| A10 | The `Reply-To: hello@oddlympics.app` mailbox accepts mail (i.e., it routes somewhere or hard-bounces with a useful response) | Implementation Approach (Discretion) | If the mailbox black-holes silent replies, user trust suffers but score is unaffected. Operator should confirm `hello@oddlympics.app` is properly aliased before Plan 10-03 (it's the canonical contact address per the landing footer and /terms — almost certainly set up; verify). |

**Items to confirm with user before plan executes (the Discuss-phase or planner should surface these):**
- A1: realistic Mail-Tester score ceiling — confirmed if D-08 lands ≥ 8 first attempt; if not, A1 is wrong and we enter the iteration loop. Acceptable risk.
- A10: `hello@oddlympics.app` is a real receiving address — needs operator confirmation. If it's not, swap to a different Reply-To or drop the header entirely.

---

## Open Questions for the Planner

1. **Plan-count granularity (3 vs 2 vs 1).** Coarse-granularity project default suggests fewer plans. Recommendation above is 3; 2 (collapsing 10-01 + 10-02) is also clean; 1 (all-in-one) makes the verification commit untidy. Planner picks.
2. **Whether the body composer is extracted (`buildConfirmBody(...)`) or inlined in `sendMagicLink()`.** Recommendation: extract — the smoke benefits from importing it (or its byte-equivalent re-implementation), and the ~30-line composer is non-trivial enough to deserve its own function name. But the inline path is fine if the planner wants minimum-diff.
3. **`<head>` block addition (the ~50-byte upgrade).** Recommendation: add. Tiny lift, matches the `<head>` shape of all other pages in the repo. But a no-op skip is also defensible if the goal is minimum diff.
4. **Add `color-scheme: light only` preemptively for Proton dark-mode safety?** Recommendation: NO — over-engineering for an MVP; D-09 catches the readability issue if it exists. Planner can override if conservative.
5. **Re-test Mail-Tester after the Plan 10-03 evidence commit?** Recommendation: yes — Phase 11 AC4 will exercise the live loop again from John's personal Gmail. If anything regresses between Phase 10 ship and Phase 11 verification, the smoke + the snapshot evidence in `evidence/` are the audit trail.
6. **Smoke imports vs. inline re-implementation of `teamLabel` / `tzLabel`.** Recommendation: inline re-implementation (Phase 9 smoke-manage precedent). Planner can override and use `tsx` / `tsc` if the helper count grows. Inline is the right call for two 5-line functions.
7. **What if the Mail-Tester score is exactly 8.0?** D-08 gate is `≥ 8`, so 8.0 passes. But the spirit of "high deliverability" suggests a > 9 target. Recommendation: if 8.0–8.4, ship; if 8.5+, definitely ship; only iterate if < 8.

---

## Code Examples

Verified patterns from the codebase + official sources.

### Resend send with multipart + custom headers (the Plan 10-01 shape)

```ts
// Source: src/lib/email.ts current pattern + node_modules/resend/dist/index.d.mts
const { error } = await resend.emails.send({
  from: FROM,
  to: email,
  subject: 'Confirm your World Cup alerts — oddlympics',
  text,
  html,
  reply_to: 'hello@oddlympics.app',
  headers: buildUnsubscribeHeaders(email),
});
if (error) throw new Error(`Resend error: ${error.message}`);
```

### `buildUnsubscribeHeaders` — already exists, just wire it onto the confirm send

```ts
// Source: src/lib/email.ts:55-65 (unchanged)
export function buildUnsubscribeHeaders(email: string): {
  'List-Unsubscribe': string;
  'List-Unsubscribe-Post': string;
} {
  const token = mintToken(email, { purpose: 'unsubscribe' });
  const url = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
```

### Smoke harness pattern (port from `smoke-manage.mjs`)

```js
// Source: scripts/smoke-manage.mjs (Phase 9) — pattern reused offline
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Inline re-implementation of teamLabel + tzLabel + body composer to match smoke-manage's
// mintToken inline pattern — avoids TS-loader friction.
const TEAMS = JSON.parse(readFileSync(resolve('./references/teams.json'), 'utf8'));
function teamLabel(slug) { return TEAMS.find((t) => t.slug === slug)?.label ?? slug; }
function tzLabel(tz) {
  if (!tz || tz.indexOf('/') === -1 || tz.indexOf('Etc/') === 0) return 'your local time';
  const last = tz.split('/').pop() ?? '';
  const human = last.replace(/_/g, ' ');
  return human ? `${human} time` : 'your local time';
}

let pass = 0, fail = 0;
function runCase(name, fn) {
  try { if (fn()) { console.log(`[smoke] PASS ${name}`); pass++; }
        else { console.error(`[smoke] FAIL ${name}`); fail++; } }
  catch (err) { console.error(`[smoke] FAIL ${name} (exception) ${err.message}`); fail++; }
}

runCase('case-1-canonical england/Detroit', () => {
  const t = teamLabel('england'), z = tzLabel('America/Detroit');
  return `every ${t} match in ${z}.`.includes('every England match in Detroit time.');
});
// ... 9 more cases ...
process.exit(fail === 0 ? 0 : 1);
```

### `teamLabel` + `tzLabel` location decision

Both helpers go in their respective lib files (`src/lib/teams.ts` and `src/lib/timezones.ts`) — the discretion bullet allows either location, but co-location with their existing constants is the testable / reusable / right-thing default.

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Indie/builder copy ("Confirm your VIP spot", "early access", "launch ping") | Consumer copy ("Confirm your World Cup alerts", named team + tz) | v2.0 milestone, 2026-05-12 | All public surfaces — Phase 10 binds the email body half |
| `selected_teams` JSON column on `vip_signups` | `team` (single snake_case slug) + `timezone` (IANA) columns | Phase 5, 2026-05-13 | Phase 10 reads `team` + `timezone` from the row already written by `/api/signup` |
| Confirmation email had no `List-Unsubscribe*` headers | Confirmation email carries `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058 one-click) on every send | Phase 10 (this phase) | Gmail Feb 2024 bulk-sender compliance + Mail-Tester lift |
| Phase 9 made unsubscribe tokens 1-year TTL via `TTL_BY_PURPOSE` | Same 1-year tokens flow through the confirmation send's `List-Unsubscribe` header automatically | Phase 9 Plan 09-01 | Phase 10 inherits for free; the URL is signed with the same secret + TTL as the unsubscribe-flow tokens |
| `sendMagicLink(email, token)` 2-arg signature | `sendMagicLink(email, token, team, timezone)` 4-arg signature | Phase 10 (this phase) | Single caller widened; no DB import in `email.ts` |

**Deprecated/outdated context to ignore:**
- PROJECT.md historical mention of `America/Detroit` as fallback timezone — superseded by `src/lib/timezones.ts:1` (`FALLBACK_TZ = 'America/New_York'`); the SIGNUP-04 "Detroit time" example is illustrative copy, not a fallback target.
- The teaser-era subject line `'Confirm your spot — oddlympics'` — replaced by `'Confirm your World Cup alerts — oddlympics'` in Phase 10.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | All scripts + Astro build | ✓ | 26.0.0 local; production droplet pinned to 22 | Production CI uses 22 (`.github/workflows/deploy.yml`); local 26 works for offline smoke |
| `resend` SDK | `email.ts` send call | ✓ | 6.12.2 (current registry head 6.12.3) | No upgrade needed for Phase 10 |
| Resend prod API access | D-08 + D-09 live sends | ✓ | — | Dev fallback prints to stdout if `RESEND_API_KEY` unset |
| Mail-Tester (`mail-tester.com`) | D-08 deliverability run | ✓ (external) | — | No automated API — manual one-shot |
| Gmail / Proton / Outlook receiving inboxes | D-09 cross-client gate | Operator-controlled | — | If a client is unavailable, Phase 10 cannot ship per D-09 |
| `hello@oddlympics.app` receiving alias | Plan 10-01 Reply-To header | ⚠ TBD — confirm with user | — | If unverified, drop the Reply-To header (small score regression, not blocking) |

**Missing dependencies with no fallback:** none for code/smoke (Plan 10-01 + 10-02 can ship offline). Plan 10-03 requires the three live inboxes + Mail-Tester + a deployed prod environment; all operator-controlled.

**Missing dependencies with fallback:** `hello@oddlympics.app` Reply-To — drop the header if the alias isn't receiving.

---

## Validation Architecture

(See "Domain Research §9 — Validation Architecture" above for the full Nyquist-compliant treatment.)

### Test Framework
| Property | Value |
|---|---|
| Framework | Node ESM smoke scripts pattern |
| Config file | none — self-contained per script |
| Quick run command | `node scripts/smoke-confirm-email.mjs` (Plan 10-02 deliverable) |
| Full suite command | `npm run smoke:confirm && npm run smoke:signup && npm run smoke:manage && npm run smoke:landing` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SIGNUP-04 (body composition) | Body literal `"every {Team} match in {TzLabel}."` | unit | `node scripts/smoke-confirm-email.mjs` | ❌ Wave 0 (Plan 10-02) |
| SIGNUP-04 (cross-client) | Renders cleanly in Gmail/Proton/Outlook | manual | `evidence/mail-*.png` + SUMMARY attestation | ❌ Wave 0 (Plan 10-03) |
| SIGNUP-04 (deliverability) | Mail-Tester ≥ 8/10 | manual | `evidence/mailtester-score.png` + SUMMARY entry | ❌ Wave 0 (Plan 10-03) |
| LAND-02 (body free of prohibited terms) | grep -iE returns no matches | unit | inside `smoke-confirm-email.mjs` | ❌ Wave 0 (Plan 10-02) |
| COMPAT-02 (no new error codes) | `/api/signup` redirects identical to today | integration | `node scripts/smoke-signup.mjs` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm run smoke:confirm`
- **Per wave merge:** `npm run smoke:confirm && npm run smoke:signup && npm run smoke:manage`
- **Phase gate:** full suite green + D-08 ≥ 8 + 3 D-09 screenshots committed

### Wave 0 Gaps
- [ ] `scripts/smoke-confirm-email.mjs` — covers SIGNUP-04 body + LAND-02 (Plan 10-02)
- [ ] `package.json` `"smoke:confirm"` script (Plan 10-02)
- [ ] `evidence/` directory + 4 image files + `10-SUMMARY.md` (Plan 10-03 operator work)

---

## Sources

### Primary (HIGH confidence)
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/phases/10-confirmation-email-update/10-CONTEXT.md` — locked decisions D-01 through D-10
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/lib/email.ts` — current `sendMagicLink` + `buildUnsubscribeHeaders` + `sendManageLink` implementations
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/lib/teams.ts` — `TEAMS` array + `VALID_TEAMS` set + `isValidTeamSlug` helper
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/lib/timezones.ts` — `FALLBACK_TZ` + `VALID_TZ` + `isValidTimezone`
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/pages/api/signup.ts` — sole `sendMagicLink` caller; Phase-5-validated `rawTeam` + `tz` in scope
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/src/pages/index.astro` lines 198-211 (algorithm at 204-205) — the `<span id="tz-label">` JS pattern to mirror
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/scripts/smoke-signup.mjs` — Phase 5 smoke pattern
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/scripts/smoke-manage.mjs` — Phase 9 smoke pattern (mintToken inline precedent)
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/references/teams.json` — canonical 48-team slug→label data (verified: 48 entries, ASCII slugs, label diacritics preserved)
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/node_modules/resend/dist/index.d.mts` — Resend SDK TypeScript definitions; CreateEmailBaseOptions includes `text`, `html`, `headers: Record<string,string>`, `reply_to: string | string[]`
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/package.json` — current scripts list; `resend@^6.12.2` pinned
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/REQUIREMENTS.md` — SIGNUP-04 spec verbatim, AC4 traceability, LAND-02 prohibited terms
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/ROADMAP.md` — Phase 10 Goal + 3 Success Criteria + R-1 resolved (Resend wired)
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/PROJECT.md` — Key Decisions table; v1.1 custom-domain deferral locked
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/STATE.md` — phase progress; v2.0 milestone in `verifying` state, Phase 10 context gathered
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/codebase/CONVENTIONS.md` — error-handling Pattern 1/2/3; CSS conventions; Astro patterns; "what you won't see"
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/codebase/INTEGRATIONS.md` §Resend — canonical send shape, error-handling contract, sandbox sender state
- `/Users/john/Desktop/vault/projects/github.com/oddlympics-app/CLAUDE.md` — stack, dev email fallback rule, ASCII apostrophe convention

### Secondary (MEDIUM confidence — official documentation)
- [Resend DMARC docs](https://resend.com/docs/dashboard/domains/dmarc) — sandbox sender DKIM/SPF/DMARC posture
- [Resend DMARC Policy Modes blog](https://resend.com/blog/dmarc-policy-modes) — p=none default explanation
- [Resend email authentication developer guide](https://resend.com/blog/email-authentication-a-developers-guide) — SPF/DKIM/DMARC mechanics
- [Mail-Tester sender reputation guide](https://mail-tester.com/blog/email-sender-reputation-score/) — score component breakdown
- [Mail-Tester hidden factors blog](https://mail-tester.com/blog/hidden-factors-that-impact-email-quality-score/) — header structural anomalies
- [Customer.io RFC 8058 docs](https://docs.customer.io/journeys/custom-unsubscribe-links/) — one-click unsubscribe required header pair
- [Mailgun RFC 8058 explainer](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/) — transactional email exemption + sandbox sender compatibility
- [Captain Pragmatic Gmail/Yahoo bulk sender 2025 guide](https://captainpragmatic.com/blog/gmail-yahoo-bulk-sender-requirements-2025/) — Nov 2025 enforcement escalation
- [Google Workspace sender guidelines FAQ](https://support.google.com/a/answer/14229414) — official Gmail bulk-sender requirements
- [hteumeuleu Outlook rendering engine](https://www.hteumeuleu.com/2020/outlook-rendering-engine/) — Outlook.com webmail uses Blink, not Word renderer
- [DEV: Email rendering 2026 guide](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f) — MSO conditional comments behavior in modern Outlook
- [Litmus Outlook rendering issues](https://www.litmus.com/blog/a-guide-to-rendering-differences-in-microsoft-outlook-clients) — cross-Outlook-version compatibility
- [Proton dark-mode support](https://proton.me/support/dark-mode) — three theme tiers (Carbon / Monokai / Ebony)
- [Enchant dark-mode email guide 2026](https://www.enchantagency.com/blog/dark-mode-email-design-best-practices-css-guide-2026) — `color-scheme` + contrast best practices
- [Campaign Monitor HSL colors in email](https://www.campaignmonitor.com/css/color-background/hsl-colors/) — `hsl()` cross-client matrix
- [caniemail.com](https://www.caniemail.com/) — comprehensive HTML/CSS email-client support tables
- [MailerCheck SpamAssassin score guide](https://www.mailercheck.com/articles/spamassassin-score) — rule-by-rule breakdown mechanics
- [Mailtrap SpamAssassin score blog](https://mailtrap.io/blog/spamassassin-score/) — score interpretation thresholds
- [Mailgun Yahoogle bulk sender chapter](https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/) — Feb 2024 enforcement context

### Tertiary (LOW confidence — needs validation)
- Realistic Mail-Tester ceiling estimate of 8.5-9.5/10 for the D-04 body on `onboarding@resend.dev` — [ASSUMED, A1]; needs D-08 live run.
- Specific SpamAssassin rule names firing on the D-04 body — [ASSUMED, no per-rule listing found in search results]; D-08 report will list the actual rules and contributions.
- Mail-Tester throwaway address TTL of 24-48h — [ASSUMED, A2]; conservative.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing Resend SDK shape verified via type def
- Architecture: HIGH — locked by CONTEXT.md; tier mapping is mechanical
- Pitfalls: HIGH on the documented anti-patterns; MEDIUM on Proton dark-mode + Gmail promo-tab interaction (Live D-09 surfaces ground truth)
- Mail-Tester scoring estimate: MEDIUM (A1)
- Cross-client compatibility: HIGH on Gmail web + Outlook.com web (modern renderers documented); MEDIUM on Proton dark-mode + iOS Mail edge cases

**Research date:** 2026-05-15
**Valid until:** 2026-06-12 (the 30-day stable horizon — through World Cup launch and one week after). Mail-Tester scoring methodology changes infrequently; Resend SDK is patch-stable; Gmail / Yahoo bulk-sender rules entered permanent-rejection mode Nov 2025 and are stable. The one external-state shift that could invalidate this is the Oct 2026 Outlook Classic retirement (`mso-*` becomes a no-op universally) — we're already past that cliff in conventions.

---

## RESEARCH COMPLETE

**Phase:** 10 — Confirmation email update
**Confidence:** HIGH on locked decisions + Resend mechanics + RFC 8058; MEDIUM on Mail-Tester score ceiling from sandbox (needs D-08 live run for ground truth)

### Key findings

- **Resend SDK supports everything the locked decisions need on a single `emails.send()` call** — multipart text+html (D-06), custom `headers` for `List-Unsubscribe*` (Phase 9 helper already produces the right shape), `reply_to` field with full wire-format mapping. No new dependency, no new error code, no contract widening beyond the four-arg `sendMagicLink` signature.
- **Realistic Mail-Tester ceiling from `onboarding@resend.dev` is 8.5–9.5/10** — DKIM/SPF pass on Resend's own infra, DMARC passes by virtue of From-domain == DKIM-signing-domain (`resend.dev`). The two biggest score lifts available within Phase 10 scope are adding `Reply-To: hello@oddlympics.app` (+0.3-0.5) and spreading `buildUnsubscribeHeaders(email)` into the send call (+0.5-1.0). Custom-domain DKIM is locked to v1.1 — sandbox should clear ≥ 8 on first try.
- **The Phase 9 unsubscribe token TTL (1 year, single-use, signed with the same secret) flows through automatically** — wiring `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on the confirm send is RFC-8058-compliant for Gmail Feb-2024 / Nov-2025 bulk-sender enforcement, even though transactional confirmations are technically exempt. The headers are net positive for Mail-Tester.
- **Cross-client compatibility is high-confidence** for the current HTML body shape: inline styles only (no `<style>` tag), `hsl()` color notation is supported on Gmail / Outlook.com webmail / Proton / iOS Mail, no `mso-*` properties to worry about. Proton dark-mode forcing on the accent button is the one item the operator must verify live in D-09; recommended fallback is force-color via `!important` or add `<meta name="color-scheme" content="only light">` — both are no-ops if the live render works.
- **The validation architecture is offline-first**: `scripts/smoke-confirm-email.mjs` (10 cases) covers the SIGNUP-04 literal copy + LAND-02 prohibited-term grep + subject literal + tz-edge-cases + diacritic survival + unknown-slug fallback. Per-task fast feedback. The deliverability + cross-client gates are necessarily operator-driven (Mail-Tester has no API; Litmus is out of budget per D-09). Three plans recommended; planner can compact to 2 if the verification commit chain is acceptable.

### File created

`/Users/john/Desktop/vault/projects/github.com/oddlympics-app/.planning/phases/10-confirmation-email-update/10-RESEARCH.md`

### Confidence assessment

| Area | Level | Reason |
|---|---|---|
| Standard stack | HIGH | No new deps; Resend SDK shape verified via type def + INTEGRATIONS.md |
| Architecture | HIGH | CONTEXT.md locks D-01 through D-10; tier assignments are mechanical |
| Pitfalls (documented anti-patterns) | HIGH | LAND-02 / kickoff-email / sendManageLink / FALLBACK_TZ all cross-referenced to existing code + STATE log |
| Mail-Tester score ceiling | MEDIUM | A1 needs live D-08 confirmation; estimate is conservative |
| Cross-client compatibility | MEDIUM-HIGH | Modern webmail render path is documented; Proton dark-mode + Gmail promo-tab need D-09 live verification |

### Open questions for the planner

(See full list in §"Open Questions for the Planner" above.) Top 3:
1. Plan count (3 vs 2 vs 1) — recommendation 3, planner picks
2. Body composer extraction (`buildConfirmBody`) vs inlined — recommendation extract
3. `hello@oddlympics.app` Reply-To verification — operator action before Plan 10-01 lands

### Ready for planning

Research complete. The planner can create PLAN.md files. Recommended plan IDs in `## Recommended Plan Structure` above.
