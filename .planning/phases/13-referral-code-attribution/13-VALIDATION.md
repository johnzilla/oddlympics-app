---
phase: 13
slug: referral-code-attribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `scripts/smoke-signup.mjs` — custom Node ESM smoke (no vitest/jest in project) |
| **Config file** | none — script is self-contained |
| **Quick run command** | `node scripts/smoke-signup.mjs` (server must be running on `:4321`) |
| **Full suite command** | `node scripts/smoke-signup.mjs` (same — only smoke suite in project) |
| **Estimated runtime** | ~5 seconds |

The smoke requires a running server: `npm run dev` (or `npm run build && node ./dist/server/entry.mjs`) in one terminal, smoke in another. Exit 0 = all cases PASS.

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-signup.mjs`
- **After every plan wave:** Run `node scripts/smoke-signup.mjs`
- **Before `/gsd:verify-work`:** Full smoke must be green (existing 8 cases + new referral cases)
- **Max feedback latency:** ~10 seconds (server boot + smoke run)

---

## Per-Task Verification Map

> Populated by the planner / `/gsd:validate-phase` once PLAN.md task IDs exist.
> Every implementation task in this phase maps to one or more smoke cases below,
> except the two `index.astro` carry-through behaviors (manual-only — see below).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-NN-NN | NN | N | REF-01/02/03 | — / V5,V6 | malformed/unknown/self ref → `referred_by` NULL, signup still 303s | integration | `node scripts/smoke-signup.mjs` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirements → Test Map

| Req / SC | Behavior | Test Type | Command | Coverage |
|----------|----------|-----------|---------|----------|
| REF-01 / SC1 | Every `vip_signups` row has a non-null, unique `referral_code` after migration | integration (DB) | `node scripts/smoke-signup.mjs` | `REF-code-uniqueness` case |
| REF-01 / SC1 | Backfill idempotency — second boot finds zero NULL `referral_code` rows | integration (DB) | `node scripts/smoke-signup.mjs` | `REF-code-uniqueness` case (re-run is no-op) |
| REF-01 | New signup row gets a `referral_code` at insert time | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-code-uniqueness` case |
| REF-02 / SC2 | `?ref=CODE` carry-through — hidden field populated from URL param | manual-only | — | inline script not curl-testable |
| REF-02 / SC2 | localStorage fallback — no URL param, stored ref (≤30d) used | manual-only | — | inline script not curl-testable |
| REF-03 / SC3 | Valid ref → `referred_by` set to that code | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-valid-ref` case |
| REF-03 / SC3 | Direct (no-ref) signup → `referred_by` NULL | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-direct-no-ref` case |
| SC4 | Unknown ref → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-unknown-ref` case |
| SC4 | Malformed ref → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-malformed-ref` case |
| SC4 | Self-referral → `referred_by` NULL + signup succeeds | integration (POST + DB) | `node scripts/smoke-signup.mjs` | `REF-self-ref` case |

---

## Wave 0 Requirements

- [x] `scripts/smoke-signup.mjs` — exists (Phase 5, 8 cases). Phase 13 **extends** it; no new framework or stub files needed.

*Existing infrastructure covers all phase requirements — extension only.*

**Sequencing constraint:** Phase 13 referral cases that issue valid POSTs MUST use a distinct `X-Forwarded-For` IP (`192.0.2.43`) so they do not consume the rate-limit slots tracked against `SMOKE_IP` (`192.0.2.42`). Case-7 (rate-limit) depends on exactly 3 slots used from `SMOKE_IP`. The existing 8 cases must stay green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `?ref=CODE` populates the hidden form field | REF-02 / SC2 | Inline `<script is:inline>` runs only in a browser; not reachable via curl | Load `/?ref=k7m2qx9a` in a browser, open DevTools, confirm `#ref` input `.value === 'k7m2qx9a'` |
| localStorage no-param fallback + 30-day TTL | REF-02 / SC2 | Same — client-side `localStorage` state | Visit `/?ref=k7m2qx9a`, then visit `/` (no param); confirm `#ref` still set. Confirm a stored entry with `ts` older than 30 days is ignored |
| localStorage defensive fallback (private mode) | REF-02 | `localStorage` throws in Safari private mode | In a private window, load `/?ref=k7m2qx9a`; page must not error; form submits (with or without ref) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (smoke case) or are listed under Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — extension only)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
