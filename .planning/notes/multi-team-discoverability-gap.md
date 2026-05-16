---
title: Multi-team + magic-link discoverability gap
date: 2026-05-16
context: Surfaced during hands-on testing of the live v2.0 site, ~26 days before World Cup kickoff (2026-06-11). Captured via /gsd-explore "UI UX updates".
---

# Multi-team + magic-link discoverability gap

## The finding

Hands-on testing of production revealed that the Phase 12 multi-team
capability **and** the magic-link identity model are functionally invisible
to users. The features exist in code; nothing in the user-facing surface
tells anyone they exist or how to reach them. Building it and never surfacing
it is arguably worse than not building it — the work is wasted and returning
users hit dead ends.

## The four invisible surfaces

1. **Signup (`/`)** — asks for one team. No copy says you can follow up to 5
   teams, or that there is a "later" where you add more.
2. **Confirmation email** — the one channel we *know* reaches the user. It is
   silent about `/manage` entirely (no link, no mention it exists).
3. **Entry affordance** — the only door back to `/manage` is a "very tiny"
   `manage account` link in the footer. A returning user who wants to add
   Brazil has no real path. (Owner found it only by hunting for that link.)
4. **`/manage` itself** — lands cold with no explanation of what the page is
   or what you can do there.

## The insight worth not losing

The magic-link / no-account / no-password model is currently treated as
unexplained plumbing. **Explained well, it is a trust selling point**
("we don't make you create an account or remember a password — we email you
a one-time link; that's it; here's why: privacy, no passwords to leak").
Unexplained, the same flow reads as broken or sketchy when a user clicks
"manage account" and just gets asked for their email with no context.
Whatever we ship here should *sell* the model, not just describe it.

## Strategic constraint — durable, sport-agnostic re-entry (future oddlympics)

The product roadmap is **not World Cup forever** — oddlympics is the
"weird sports" play (strongman, cubing, niche long tail). The expected user
behaviour is *recurring return visits* to manage which sports/teams they
follow, across tournaments and eventually across sports. Today's only
surface is the WC landing, but the re-entry affordance and `/manage` must
be designed as the **durable, account-less home for whatever you follow on
oddlympics** — not a World-Cup-specific screen.

Concrete implications for this work:
- Entry affordance + `/manage` copy is sport-agnostic ("manage what you
  follow on oddlympics"), not "your World Cup teams".
- `/manage` information architecture must visibly scale to multiple sports
  (e.g. a "Football — World Cup 2026" group that structurally implies future
  groups), so adding non-football sports later is not a rewrite.
- The magic-link email is the durable re-entry point to the *whole*
  oddlympics relationship, reinforcing the no-account model as a long-term
  trust feature, not one-tournament plumbing.

This is cheap to honour now (copy + IA framing) and expensive to retrofit.

## Scope decision reached

Not a visual-polish problem and not a backend change — it is a content +
light-affordance pass. Decided shape (via /gsd-explore):

- **Content pass** across all four surfaces, including the "why magic-link /
  no account" trust copy.
- **Rethink the entry affordance** — a real returning-user path, not just a
  less-tiny footer link. The entry UX is design-uncertain enough to warrant a
  throwaway sketch *before* building.

Runs as launch-readiness work (no active milestone): **sketch the entry UX →
one focused task** for the copy + the chosen affordance.

## Related artifacts

- Todo: `.planning/todos/pending/manage-discoverability-content-pass.md`
- Sketch: entry-affordance UX (handed to `/gsd-sketch`)
