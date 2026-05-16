---
sketch: 002
name: manage-trust-screen
question: "Does the /manage room's information architecture scale from 'your World Cup teams' to 'everything you follow on oddlympics' without a rewrite — and does the request screen sell the no-account model?"
winner: "B"
tags: [trust, manage, IA]
---

# Sketch 002: /manage trust + multi-sport IA

## Design Question

Two things on one screen:

1. **Trust (the door):** the magic-link request screen must *sell* the
   no-account model ("no password — you never made one, nothing to leak"),
   not read as broken. This is shared across all variants (low design
   uncertainty — it's framing/copy). Toggle **"Signed out"** to see it.

2. **IA (the room):** the genuinely uncertain question — does the signed-in
   editor's structure survive the weird-sports roadmap? Today it's football
   only; tomorrow it's strongman, speedcubing, the long tail. The three
   variants are three answers to "how does one sport become many without a
   rewrite or a relearn?"

## How to View

open .planning/sketches/002-manage-trust-screen/index.html

Use the **state toggle** (Signed in / Signed out) and the variant tabs.

## Variants (signed-in IA)

- **A: Flat, sport-prefixed** — current confederation structure wrapped in a
  "Football — World Cup 2026" section, with an explicit "more sports coming"
  note. Path of least resistance: smallest change to today's `manage.astro`.
- **B: Sport accordion** — one collapsible block per sport; future sports
  show as collapsed "Coming soon" rows. Each sport self-contained; the page
  stays short as sports multiply.
- **C: Two-pane sport rail** — left rail of sports you follow (+ browse all),
  right pane is the detail editor. Most scalable for many sports; heaviest
  chrome for the single-sport present.

## What to Look For

- **The roadmap test:** mentally add 8 weird sports to each. Which still
  feels right? Which becomes a scroll marathon (A), a clean list (B), or
  over-built-for-today (C)?
- **The today test:** it's football-only for ~weeks. Which respects that
  without looking empty or pre-bloated?
- Signed-out state: does the `⌗ No password. No account.` trust block read
  as a *selling point* or as an apology? Is it too loud above the form?
- Copy is sport-agnostic throughout ("Everything you follow", "Your
  oddlympics") — does anything still smell World-Cup-locked?
- 375px (📱): two-pane (C) is the responsive risk — does the rail collapse
  acceptably or break?

## Decisions

- **Winner: B (sport accordion).** Scales cleanly as sports multiply *and*
  respects football-only-today (only Football expanded; future sports are
  quiet collapsed "Coming soon" rows — no empty/pre-bloated feeling).
- **Copy fix:** signed-out subhead dropped the jargon "straight to the
  editor" → "a one-time link that takes you right back in." Users don't
  think of `/manage` as "an editor." Carry this into implementation copy.
