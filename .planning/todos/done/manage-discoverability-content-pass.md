---
title: /manage + multi-team discoverability — content & entry pass
date: 2026-05-16
priority: high
status: done
completed: 2026-05-16
completed_by: quick task 260516-q33 (commits 8885e42, 1b3a37f, eb67661)
context: Launch-readiness. World Cup kickoff 2026-06-11 (~26 days out). Background and rationale in .planning/notes/multi-team-discoverability-gap.md.
---

> ✅ **Done 2026-05-16** via `/gsd-quick` task `260516-q33`. Shipped sketch
> winners 001-B (under-form re-entry link) + 002-B (signed-out trust block +
> sport accordion + "editor"→"right back in" copy fix) + 003-B (confirmation
> email "keep this email" callout); shared no-account copy in `src/lib/copy.ts`.
> See `.planning/quick/260516-q33-manage-discoverability-content-and-entry/`.
> Local commits on `main`, not pushed.

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
- [ ] **Entry affordance** — add a quiet secondary link directly under the
      signup form on `/` ("Already signed up? Manage what you follow on
      oddlympics →"). Resolved by sketch 001 (Variant B). The 13px footer
      link can stay as-is; the under-form link is the real path.

## Resolved design directions (sketches 001–003, all winners committed)

See `.planning/sketches/MANIFEST.md` + per-sketch READMEs for the built
mockups. Decisions to implement:

- **Landing entry (001-B):** quiet secondary link under the signup form,
  not new chrome. Sport-agnostic copy ("manage what you follow on
  oddlympics"). No no-account explanation on the landing page.
- **/manage (002-B):** sport-accordion IA — one collapsible block per
  sport, future sports as quiet "Coming soon" rows. Signed-out request
  screen carries the `no password / no account` accent-soft trust block.
  Copy fix: never say "the editor" → "takes you right back in".
- **Confirmation email (003-B):** "Keep this email — it's your key"
  accent-soft callout reframing the email as the durable re-entry point.
  **Shares copy with the 002 signed-out trust block** — implement the
  "no account / no password" message once, reuse in both surfaces.
- **Durability:** all copy + IA is sport-agnostic by decision (future
  weird-sports roadmap) — see `.planning/notes/multi-team-discoverability-gap.md`.

## Dependencies / sequencing

1. ~~`/gsd-sketch` the entry-affordance UX~~ — DONE (sketches 001–003,
   winners marked).
2. One focused task: ship the copy + the 001-B link + 002-B accordion +
   003-B email callout, with the shared no-account copy factored once.
   Runnable as `/gsd-quick` (no backend, no new milestone).

## Done looks like

A person who signs up understands they can follow more than one team and
knows how to come back to do it; a returning user has an obvious path back to
`/manage`; the magic-link model builds trust instead of confusion. Verified
by re-running the same manual test that surfaced the gap.

## Related

- Note: `.planning/notes/multi-team-discoverability-gap.md`
- Sketch: entry-affordance UX (`/gsd-sketch`)
