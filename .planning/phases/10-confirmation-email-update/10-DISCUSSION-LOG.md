# Phase 10: Confirmation email update - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `10-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 10-confirmation-email-update
**Mode:** `--auto` (every option auto-selected to the recommended default; no `AskUserQuestion` calls)
**Areas discussed:** read-point for team+tz, tz-label format, team-name source, value-prop sentence, body format, subject line, sender domain, Mail-Tester gate, cross-client test, /confirmed scope

---

## Read-point for team + tz at email-send time

| Option | Description | Selected |
|--------|-------------|----------|
| A. Caller passes both values | `sendMagicLink(email, token, team, tz)`; `/api/signup` already has validated values in scope | ✓ |
| B. `sendMagicLink()` calls `getByEmail` | Lib reads the row itself | |
| C. New `sendConfirmEmail(email, token)` that does the DB read | New function, both old + new call paths | |

**Auto-selected:** A — preserves the "lib takes primitives, never calls DB" layering; no extra DB round-trip on the hot signup path; values are guaranteed validated by Phase 5's upstream chain in the same handler.

---

## Human-readable timezone label format

| Option | Description | Selected |
|--------|-------------|----------|
| A. Mirror landing's split-and-suffix JS | Last `/`-segment, `_` → ` `, `+ ' time'`; `Etc/*` → "your local time" | ✓ |
| B. `Intl.DateTimeFormat(..., {timeZoneName: 'long'})` | "Eastern Daylight Time" — DST + ICU dependent | |
| C. Static IANA → city map | Curated table per zone | |

**Auto-selected:** A — copy-consistent with what the user just saw on the landing page; deterministic across Node versions; no ICU drift. Renders e.g. "Detroit time" (matching the SIGNUP-04 example), "London time", "Ho Chi Minh time". `Etc/UTC` edge → "your local time".

---

## Team-name source (slug → label)

| Option | Description | Selected |
|--------|-------------|----------|
| A. `TEAMS` lookup from `src/lib/teams.ts` | `TEAMS.find(t => t.slug === slug)?.label` — same data the dropdown rendered | ✓ |
| B. `SELECT name FROM teams WHERE slug = ?` | DB read; football-data.org name | |
| C. Inline switch / map in `email.ts` | Duplicate the data | |

**Auto-selected:** A — single source of truth (`references/teams.json`); diacritics preserved (FORM-02 compliance); avoids coupling `email.ts` to the SQLite `teams` table whose `name` column may not match consumer labels for all 48.

---

## Value-prop sentence (the SIGNUP-04 line)

| Option | Description | Selected |
|--------|-------------|----------|
| A. SIGNUP-04 spec verbatim | "We'll email you 1 hour before every {Team} match in {TzLabel}." | ✓ |
| B. Variant ("Get one email per kickoff for {Team}, in {TzLabel}.") | Different cadence framing | |
| C. Rewrite whole body | Tone overhaul | |

**Auto-selected:** A — minimal blast radius; satisfies SC1 word-for-word; reuses the canonical copy spec already locked at requirements time.

---

## Body format — multipart vs simplification

| Option | Description | Selected |
|--------|-------------|----------|
| A. Keep both `text` + `html` (multipart-alternative) | Existing inline-string pattern, edit copy in place | ✓ |
| B. Plain-text only | Smaller payload, no styling | |
| C. HTML only | Drop the plain-text fallback | |
| D. Switch to template engine (Mjml, react-email) | Layout primitives | |

**Auto-selected:** A — Mail-Tester penalizes single-part HTML; existing aesthetic already matches v2.0 landing; no template-engine ROI at < 50 body lines.

---

## Email subject line

| Option | Description | Selected |
|--------|-------------|----------|
| A. "Confirm your World Cup alerts — oddlympics" | Consumer-flavored, no per-recipient personalization | ✓ |
| B. "Confirm your {Team} alerts — oddlympics" | Personalized | |
| C. Keep "Confirm your spot — oddlympics" | Teaser-era status quo | |

**Auto-selected:** A — aligns with v2.0 consumer pivot; per-recipient subjects from a sandbox sender are a known Gmail spam-heuristic trigger; status-quo "Confirm your spot" carries VIP/teaser baggage scrubbed elsewhere.

---

## Sender domain

| Option | Description | Selected |
|--------|-------------|----------|
| A. Stay on `onboarding@resend.dev` | Resend verified sandbox sender | ✓ |
| B. Set up DKIM/DMARC for `oddlympics.app` in this phase | Custom domain | |

**Auto-selected:** A — PROJECT.md Key Decisions locks custom-domain DKIM/DMARC to v1.1. Phase 10 must clear ≥ 8/10 from the sandbox; if a real score crisis materializes, it's escalated separately, not folded into Phase 10's scope.

---

## Mail-Tester verification gate (SC3)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Manual operator action vs prod sender; capture in 10-SUMMARY.md | One-shot per release | ✓ |
| B. Automated CI gate | (No Mail-Tester API exists) | |

**Auto-selected:** A — no API exists; manual one-shot is the only option. Score + sub-check breakdown lives in the SUMMARY as evidence Phase 11 references.

---

## Cross-client rendering test (SC2)

| Option | Description | Selected |
|--------|-------------|----------|
| A. Manual real sends to Gmail / Proton / Outlook + commit screenshots | Three throwaway inboxes; screenshots into `evidence/` | ✓ |
| B. Litmus / Email-on-Acid automated render | Paid SaaS | |
| C. Defer entirely to Phase 11 AC4 | No Phase 10 gate | |

**Auto-selected:** A — solo dev + WC deadline; screenshots double as AC4 evidence; Litmus subscription > three free inboxes.

---

## `/confirmed` page copy scope

| Option | Description | Selected |
|--------|-------------|----------|
| A. Phase 10 does NOT touch `/confirmed` page copy | Scope is email body only | ✓ |
| B. Mirror the new value-prop line on `/confirmed` too | Cross-surface consistency | |

**Auto-selected:** A — scope guardrail; SIGNUP-04 binds the email body only.

---

## Claude's Discretion (deferred to planner / executor)

- Location of `tzLabel()` helper (`src/lib/timezones.ts` preferred vs private in `email.ts`).
- Location of `teamLabel()` helper (`src/lib/teams.ts` preferred vs private in `email.ts`).
- Extracting a `buildConfirmBody({email, url, team, tz})` composer vs inline strings.
- Exact HTML body re-write line ordering (suggested shape in 10-CONTEXT.md §Specifics).
- Adding `Reply-To: hello@oddlympics.app` header on the Resend send call (recommended yes — small Mail-Tester lift).
- Adding a visible "Unsubscribe" link in the HTML footer body in addition to the `List-Unsubscribe` header (recommended yes — small lift).
- Plan split: 1 plan (code + smoke + ship) vs 2 plans (code+smoke / operator-action verification + screenshots).

## Deferred Ideas

- Custom Resend domain (DKIM/DMARC for `oddlympics.app`) — locked to v1.1.
- HTML email templating engine — revisit at ≥ 3 distinct emails sharing layout primitives.
- Per-team imagery (crest) in the email — v2 territory.
- Subject-line personalization — revisit only if open-rate metrics force it.
- Litmus / Email-on-Acid automated cross-client gate — out of scope at this stack size.
- Update `/confirmed` page to mirror new value-prop — separate phase if surfaced.
- Update `sendManageLink()` body to include team+tz — out of scope; Phase 9 locked.
- Refactor kickoff notification email to use the new helpers — opportunity, not gap.
- Automated Mail-Tester polling / regression watch — no API exists.
