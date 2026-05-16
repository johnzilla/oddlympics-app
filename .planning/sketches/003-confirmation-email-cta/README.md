---
sketch: 003
name: confirmation-email-cta
question: "What does the durable re-entry CTA inside the confirmation email look like, given email constraints (table layout, inline CSS, no JS)?"
winner: "B"
tags: [email, entry]
---

# Sketch 003: Confirmation-email re-entry CTA

## Design Question

The confirmation email is the **one channel we know reaches the user**.
Today it says nothing about coming back. What's the re-entry treatment —
and how hard does it lean on "this email IS your account-less way back in"?
Constrained medium: real HTML email (table layout, inline CSS, bulletproof
button, no JS, ~600px). Rendered in a faux mail-client frame.

## How to View

open .planning/sketches/003-confirmation-email-cta/index.html

## Variants

- **A: Plain button** — confirmation + a clear bulletproof "Manage what you
  follow →" button. Minimal, no hard sell. Path of least resistance.
- **B: "Keep this email — it's your key"** — an accent-soft callout that
  reframes the email itself as the durable, account-less re-entry point
  ("you never made an account — keep this email; the button always brings
  you back, including new sports as oddlympics grows"). Sells the model in
  the channel that reaches them.
- **C: Quiet footer line** — re-entry demoted to a one-line footer note
  ("add teams / change time zone: manage what you follow — one-time link,
  no password"). Lowest emphasis; tests whether a dedicated block is
  overkill for a confirmation email.

## What to Look For

- Does B's callout feel reassuring or pushy in a *confirmation* email (the
  user just signed up — is "keep this email" helpful or presumptuous)?
- A vs C: is a real button worth the visual weight, or does a footer line
  do the job without making the email feel like marketing?
- All three are sport-agnostic ("manage what you follow", "new sports as
  oddlympics grows") — does the future-sports nod land or feel premature?
- Subject lines differ per variant (see the client-meta bar) — which subject
  best signals "this is useful, keep it"?
- The body keeps the Phase-10 personalization (names team + timezone) — make
  sure the re-entry block doesn't bury the core "you're in" confirmation.

## Decisions

- **Winner: B ("keep this email — it's your key" callout).** Puts the
  no-account pitch in the one channel guaranteed to reach the user and makes
  the email itself the durable, sport-agnostic re-entry point. Consistent
  with sketch-002's signed-out trust block (same "no account / no password"
  message, same accent-soft treatment) — implement them with shared copy.
