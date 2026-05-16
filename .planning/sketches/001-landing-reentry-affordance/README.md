---
sketch: 001
name: landing-reentry-affordance
question: "Where does a returning user spot 'let me back in' on the landing page without cannibalizing new-signup conversion?"
winner: "B"
tags: [entry, landing, conversion]
---

# Sketch 001: Landing re-entry affordance

## Design Question

The landing page's #1 job is converting **new** signups. A returning user
(signed up last week, wants to add Brazil) currently has no path except a
13px footer link. Where does the "I'm already in, let me back" affordance
live so it's discoverable but doesn't steal attention from the primary
conversion — and reads as oddlympics-wide, not World-Cup-only?

## How to View

open .planning/sketches/001-landing-reentry-affordance/index.html

## Variants

- **A: Top utility strip** — persistent accent-soft bar above the hero
  ("Already on oddlympics? Manage what you follow →"). Always visible, never
  touches the conversion column. Cost: adds permanent chrome to a focused page.
- **B: Quiet link under the form** — a single muted secondary line directly
  below the signup form, exactly where a confused returning user looks (they
  try to "sign up" again). Zero extra chrome; path of least resistance —
  reuses existing `.wrap`, one line of markup.
- **C: Below-fold card** — a distinct bordered card with room to explain the
  no-account model ("you don't have a password — you never made one").
  Most explanatory, lowest discoverability (below the fold).

## What to Look For

- Does the affordance get noticed **without** pulling the eye off "Get my
  kickoff alerts"? (A is loudest, B is quietest, C is invisible until scroll.)
- Does the copy read as durable oddlympics ("manage what you follow"), not a
  WC-only thing? Toggle each variant and read it as a first-time visitor vs.
  a returning one.
- B and C also surface the no-account model inline — does that reassurance
  belong on the landing page, or only on /manage (sketch 002)?
- Resize to 375px (toolbar 📱): does the strip (A) wrap badly? Does the card
  (C) push the fold too far?
- The `Follow up to 5 teams — add anytime, no account needed` form note
  rides in all three — confirm it sets the multi-team expectation cleanly.
