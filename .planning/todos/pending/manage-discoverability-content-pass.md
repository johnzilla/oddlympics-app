---
title: /manage + multi-team discoverability — content & entry pass
date: 2026-05-16
priority: high
context: Launch-readiness. World Cup kickoff 2026-06-11 (~26 days out). Background and rationale in .planning/notes/multi-team-discoverability-gap.md.
---

# /manage + multi-team discoverability — content & entry pass

Make the Phase 12 multi-team capability and the magic-link model **legible**.
Content + light affordance only — no backend, no redesign.

## Scope

- [ ] **Signup (`/`)** — microcopy near the team field setting the
      expectation: you can follow up to 5 teams, and you can add/change them
      anytime after signing up.
- [ ] **Confirmation email** — add a line + link telling the user `/manage`
      exists and what it is for ("add or change the teams you follow"). This
      is the channel we know reaches them.
- [ ] **`/manage` intro** — a short header/intro on the page explaining what
      it is and what you can do (add/remove up to 5 teams, change timezone,
      unsubscribe).
- [ ] **"Why magic-link / no account" trust copy** — explain the model as a
      *feature*: no password to create or leak, no account, privacy. Decide
      placement (signup, the magic-link request step, `/manage`, or a mix) —
      lead with the benefit, not the mechanism.
- [ ] **Entry affordance** — replace the "very tiny" footer `manage account`
      link with a real returning-user entry path. **Gated on the
      `/gsd-sketch` outcome** for the entry UX (see related sketch).

## Dependencies / sequencing

1. `/gsd-sketch` the entry-affordance UX first (throwaway mockups).
2. Then one focused task: ship the copy across all surfaces + build the
   chosen entry affordance.

## Done looks like

A person who signs up understands they can follow more than one team and
knows how to come back to do it; a returning user has an obvious path back to
`/manage`; the magic-link model builds trust instead of confusion. Verified
by re-running the same manual test that surfaced the gap.

## Related

- Note: `.planning/notes/multi-team-discoverability-gap.md`
- Sketch: entry-affordance UX (`/gsd-sketch`)
