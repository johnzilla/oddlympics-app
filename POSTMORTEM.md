# oddlympics — Postmortem

**What it was:** A personalized "when does MY team play" notification service for the
2026 FIFA World Cup. Pick your team → get one email an hour before each of their
matches, kickoff shown in your local time. Free, no app, no ads, no betting odds.

**Timeline:** Built pre-tournament; launched **2026-06-11** (group stage); ran clean
through **2026-07-19** (final: Spain def. Argentina).

**The real goal:** a lead-gen wedge — capture a broad, international audience during
the World Cup, then convert them into a future community for the weird/niche sports
nobody covers (curling, competitive Excel, BattleBots, speedcubing). The World Cup
was the acquisition event, not the end product.

**Verdict:** product success, distribution failure, and a personal win worth more
than either.

---

## Final numbers

- **Signups:** 9 total, 7 confirmed (78% opt-in) — but 6 were test accounts.
  **3 genuine strangers:** 1 organic (Japan fan, Jakarta) · 1 via the X pinned post
  (Argentina fan) · 1 kickbacks freebie-farmer.
- **Kickoff emails delivered:** **39, zero errors,** across the full tournament —
  including the Argentina fan's alert for the final itself, an hour before kickoff,
  in their timezone.
- **Signups by source:** direct 7 · X 1 · kickbacks 1 · Reddit 0.
- **"What's next" community votes:** 0.
- **Ad spend:** ~$218 on kickbacks.ai (7 campaigns, ~28k impressions) → 1 signup (the farmer).

## What worked

- **The product, unqualified.** Shipped solo on a hard, immovable deadline and ran
  flawlessly for five weeks. 39 real alerts, zero misses, correct timezones,
  multi-subscriber fan-out — the core promise held for every match.
- **Reliability engineering.** Caught and fixed a *silently-broken production pipeline*
  days before launch (the deploy never shipped `references/`; `teams.json` held
  pre-draw guesses) — the class of invisible bug that kills projects.
- **Full-funnel attribution, built from scratch** (UTM capture + referral graph in
  SQLite + a CLI ops dashboard). Every signup and send was measurable.
- **Honesty as positioning.** No ads, no odds, no tracking creepiness, "built by one
  person, not a company." Consistent end to end.

## What didn't

- **Cold-start distribution.** ~$218 + weeks of effort across kickbacks, X, and Reddit
  netted 3 real humans (one a farmer). Niche free-consumer acquisition, solo, is brutal.
- **Wrong-room marketing.** Kickbacks reached developers mid-code (wrong intent); early
  X reached a dev/maker following (not soccer fans). Right message, wrong audience —
  repeatedly.
- **The lead-gen thesis is unproven, closer to disproven.** 3 signups and 0 votes = no
  list to convert and no signal on which weird sport. The wedge never produced the
  volume to bootstrap a community.
- **Founder-market-fit gap.** The founder doesn't watch soccer, which closed the organic
  "be a regular in the fan community" path — you can't authentically belong to a tribe
  you're not in.

## Lessons (the durable ones)

1. **Building is easy; distribution is the edge.** The product was never in doubt after
   launch day. Every hard problem was getting humans to know it exists.
2. **Distribution requires belonging to the room.** Ads hit the wrong context; organic
   requires the right tribe. You can't fake being a regular.
3. **Match the channel to the audience's *intent and context*, not just demographics.**
   The right people showed up and still didn't convert, because the moment was wrong.
4. **Verify against reality, not fixtures.** Every offline smoke passed while production
   was silently dead. The live audit caught it.
5. **Cheap experiments beat theorizing.** $218 bought a *definitive* answer on a channel,
   reusable forever. Tuition, not waste.
6. **Patience is the differentiator.** Distribution is flat-flat-then-maybe-curve; most
   projects die during the flat part, mistaking "not yet" for "never."

## The real ROI

The growth numbers were tiny. The *point* wasn't. This was the founder's first real
distribution reps — first ads, first build-in-public threads, first Reddit post, first
builder-to-builder outreach — after a career of shipping 40+ repos and abandoning each
before the un-fun part. **The product was the vehicle; the growth was the founder.** By
that measure, it succeeded.

## Status & next steps

- **Keep it idling.** $6/month, maintenance-free. It'll wake for Euro 2028, WC 2030, the
  Olympics. Don't sunset a working, reliable, proven-seasonal asset.
- **If pursuing the weird-sports community:** reverse the order — build the audience
  *first*, in tribes you genuinely belong to (weird-sports / builder / Bitcoin), then the
  tool. Community before product.
- **Carry the muscle forward:** every future build starts distribution-first.

_Spain won. oddlympics didn't miss a kickoff. And the founder learned to ship_ and _sell._
