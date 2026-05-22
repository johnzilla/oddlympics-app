# Requirements: oddlympics — Milestone v2.1 Referral & Social Sharing

**Defined:** 2026-05-22
**Core Value:** A user picks their team and gets a kickoff notification in their local time, on time, before group stage 2026-06-11.
**Milestone goal:** Turn every new signup into a referral channel — let a user share their personalized World Cup signup and track which signups it drives back.

## Milestone v2.1 Requirements

Requirements for the Referral & Social Sharing milestone. Each maps to exactly one roadmap phase (see Traceability).

### Referral Attribution

- [x] **REF-01**: Every signup is assigned a unique, stable referral code
- [x] **REF-02**: The landing page accepts a `?ref=CODE` param and carries it through the signup form
- [x] **REF-03**: `/api/signup` records the referring code on the new signup (`referred_by` column) so share-driven signups are measurable

### Share Experience

- [ ] **SHARE-01**: A share prompt with the user's referral link appears on `/pending`, `/confirmed`, and `/manage`
- [ ] **SHARE-02**: The confirmation email includes a personalized share line + referral link
- [ ] **SHARE-03**: The share action offers the native share sheet (Web Share API) with a copy-link fallback
- [ ] **SHARE-04**: Shared content names the user's team (personalized message)

### Personalized Open Graph

- [ ] **OG-02**: A per-team Open Graph image exists for each of the 48 World Cup teams
- [ ] **OG-03**: A shared referral link unfurls on social platforms with the sharer's team image

## Future Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Referral Engagement

- **REF-F1**: User can see their own referral count ("you've referred N friends")
- **REF-F2**: Referral leaderboard or rewards for top referrers

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full referral program (rewards, points, leaderboard, milestone unlocks) | A measurable share loop is the v2.1 goal; gamification is a separate, larger build — deferred to Future Requirements. |
| Two-sided incentives (referrer + referee both rewarded) | Same as above — no rewards layer in v2.1. |
| Referral analytics dashboard / admin UI | Attribution is satisfied by the `referred_by` DB column, queryable via the DEPLOY.md Day-2 ops path. A dashboard is not worth the surface area on a 20-day runway. |
| Direct social-platform API posting (post-to-X, etc.) | Sharing is a link + native share sheet; OAuth'd API posting is multi-week integration work per platform. |
| Dedicated referral-fraud / anti-abuse system | Existing honeypot + Origin check + rate limit apply to the signup path unchanged; a self-referral or fake-code abuse system is not justified before real abuse is observed. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REF-01 | Phase 13 | Complete |
| REF-02 | Phase 13 | Complete |
| REF-03 | Phase 13 | Complete |
| SHARE-01 | Phase 14 | Pending |
| SHARE-02 | Phase 14 | Pending |
| SHARE-03 | Phase 14 | Pending |
| SHARE-04 | Phase 14 | Pending |
| OG-02 | Phase 15 | Pending |
| OG-03 | Phase 15 | Pending |

**Coverage:**
- v2.1 requirements: 9 total
- Mapped to phases: 9 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 — roadmap created, all 9 requirements mapped to Phases 13–15*
