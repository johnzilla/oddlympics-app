# Sketch Manifest

## Design Direction

The durable, account-less re-entry flow for oddlympics. A confirmed user who
signed up with one team must be able to discover how to come back, request a
one-time magic link, and land in a `/manage` hub that *sells* the no-account
model rather than reading as broken. Visual system is **locked** — editorial
minimalist verbatim from `src/components/Layout.astro` (off-white `#fafaf7`,
near-black `#14151a`, rust `#b8350d`, sans body + mono accents, no framework
JS). Strategic constraint: this is **not World Cup–specific** — it's the
recurring home for whatever you follow on oddlympics (future weird-sports
roadmap), so copy + information architecture must scale beyond one tournament.

## Reference Points

The live oddlympics.app surfaces themselves (`index.astro`, `manage.astro`,
shared `Layout.astro`) — these sketches must read as the same product, not a
generic mockup. No external references; the brand is already established.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | landing-reentry-affordance | Where does a returning user spot "let me back in" on the landing page without cannibalizing new-signup conversion? | **B — quiet link under the signup form** | entry, landing, conversion |
| 002 | manage-trust-screen | How does the `/manage` request screen sell the no-account model + scale to multiple sports? | **B — sport accordion (collapsible block per sport)** | trust, manage, IA |
| 003 | confirmation-email-cta | What does the durable re-entry CTA inside the confirmation email look like (table/inline-CSS, no JS)? | TBD | email, entry |
