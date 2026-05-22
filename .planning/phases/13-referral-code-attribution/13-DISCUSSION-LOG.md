# Phase 13: Referral Code & Attribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 13-referral-code-attribution
**Areas discussed:** Code format, Attribution model, Ref persistence, Verify & measure

---

## Code format

### Code style

| Option | Description | Selected |
|--------|-------------|----------|
| Random short code | Opaque random code; no PII, nothing to keep in sync; Phase 15 OG route resolves code→team from DB anyway | ✓ |
| Team-flavored code | e.g. `usa-k7m2` with team baked in; feels personal but goes stale on multi-team / team change | |

### Character set

| Option | Description | Selected |
|--------|-------------|----------|
| Lowercase, ambiguity-free | `a–z` + `2–9` excluding `0/o/1/l/i`; robust if read aloud | |
| Full lowercase alphanumeric | `a–z` + `0–9`; simplest, slightly denser; fine for a clicked link | ✓ |

### Length

| Option | Description | Selected |
|--------|-------------|----------|
| 8 characters | ~2.8e12 keyspace, still a tidy link; UNIQUE + regenerate-on-collision | ✓ |
| 6 characters | Shortest clean link (~1e9 / ~2e9 space) | |
| 7 characters | Middle ground | |

**User's choice:** Random opaque code, 8 chars, `a–z0–9`.
**Notes:** Code carries no team/email data — Phase 15's OG route does a DB lookup, so the code needn't encode anything.

---

## Attribution model

### Re-signup attribution

| Option | Description | Selected |
|--------|-------------|----------|
| First-touch (lock once set) | `referred_by` COALESCE-protected like `team`; never overwritten; a NULL can still be filled later | ✓ |
| Last-touch (most recent wins) | Each re-signup with a valid ref overwrites; simpler upsert but later link can rewrite credit | |

### Referrer eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| Attribute to any existing code | One SELECT, no status join; analytics filters by referrer status later | ✓ |
| Only confirmed referrers | Cleaner raw data, but adds a status check to the signup hot path | |

**User's choice:** First-touch; attribute to any existing code.
**Notes:** Self-referral handling stays locked by SC4 — silently ignored, detected by comparing the ref code's owner email to the submitter's lowercased email. Not separately questioned; the detection rule is determined by SC3/SC4.

---

## Ref persistence

### Carry-through robustness

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage fallback | Stash first `?ref=` in localStorage; later `/` loads fall back to it; survives reload/return; no server change | ✓ |
| Same-pageload only | Hidden field from current URL only; matches SC2's literal wording; attribution lost on reload/return | |

### Expiry

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day TTL | Store ref + timestamp; ignore past 30 days; covers click→signup gaps and the World Cup runway | ✓ |
| No expiry | Bare ref string until browser clears localStorage; simplest | |

**User's choice:** localStorage fallback with a 30-day TTL.
**Notes:** URL `?ref=` stays authoritative when present; localStorage is the no-param fallback. First-seen ref wins in storage (consistent with first-touch attribution).

---

## Verify & measure

### Smoke approach

| Option | Description | Selected |
|--------|-------------|----------|
| Extend smoke-signup.mjs | Add referral cases to the Phase 5 8-case smoke; one file, one command; ref attribution is part of the signup POST | ✓ |
| New smoke-referral.mjs | Dedicated referral smoke (HTTP + DB-level checks); leaves smoke-signup.mjs untouched | |

### Measurability deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Add a documented query recipe | Short SQL recipe in DEPLOY.md Day-2 ops; makes REF-03 "measurable" concretely true | ✓ |
| Just the column, no doc | `referred_by` queryable via ad-hoc SQL; smaller footprint | |

**User's choice:** Extend `smoke-signup.mjs`; add a documented query recipe to `DEPLOY.md`.
**Notes:** REQUIREMENTS.md already names "the DEPLOY.md Day-2 ops path" as the measurement mechanism — shipping the recipe satisfies REF-03 directly.

---

## Claude's Discretion

- Code-generation helper placement and `node:crypto` primitive used.
- New-row code generation site (handler vs. `db.ts` helper).
- Prepared-statement names; `referral_code` lookup statement shape; `VipSignup.referral_code` type (`string` vs `string | null`).
- localStorage key name and `{ref, ts}` JSON shape.
- Migration step order (unique index before/after backfill — both valid).
- Exact `DEPLOY.md` recipe wording; structure of the referral cases inside `smoke-signup.mjs`.
- Plan/wave split.

## Deferred Ideas

- Share UI / native share sheet / team-named copy / email share line — Phase 14.
- Per-team OG images + server-rendered `/r/CODE` route — Phase 15.
- "You've referred N friends" count (REF-F1), referral leaderboard / rewards (REF-F2) — Future Requirements, out of scope.
- Referral analytics dashboard / admin UI — out of scope; the DEPLOY.md Day-2 query is the lightweight substitute.
