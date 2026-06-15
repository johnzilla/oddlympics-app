# UTM / ad-buy log

Plausible **tracks** campaigns; it does not **manage** them. A campaign exists only
because traffic arrived carrying its `utm_*` params — the meaning of each value
lives here, not in Plausible. Keep this file the single source of truth for
"which UTM string = which ad buy."

## Naming convention (never deviate — Plausible buckets by exact string)

- **lowercase, hyphens, no spaces** (`kickbacks`, not `Kickbacks` or `kickbacks ai`)
- `utm_source`  = where the traffic came from — the network/platform (`kickbacks`)
- `utm_medium`  = the format/placement (`spinner`, `email`, `social`)
- `utm_campaign`= the push / time period (`wc2026`)
- `utm_content` = the specific creative/variant — use this to A/B test ad copy

## How to read it in Plausible

Dashboard → filter **Campaign = wc2026** → break down by **UTM Content** to compare
creatives. Conversion metric: the **Signup Submit** goal (fires on signup-form
submit, tagged with team). Ground truth for confirmed leads + the "what's next"
votes lives in the prod DB (`vip_signups`, `feature_requests`) — Plausible is the
top-of-funnel mirror; UTM is not stored per-row in the DB (window-correlate, or
add a hidden `utm_source` field later if you want airtight per-signup attribution).

## Creative assets

- **Brand icon** — `marketing/oddlympics-icon.png` (512×512, ~12 KB PNG). The
  slashed-circle **ø** mark, rust (`#e06a37`) on near-black (`#0b0b0e`). Used as the
  kickbacks "brand icon" slot (PNG/JPG/WebP ≤ 64 KB). Reads as `null` / empty-set /
  ø to developers — eye-catching for the dev audience and a nod to "odd".
  - Canonical source: `public/favicon.svg` — the same mark is the site favicon, so
    browser tab and ad share one identity.
  - Regenerate: `node scripts/render-icon.mjs` (deterministic; `ICON_SIZE=256` for a
    smaller variant). Pure shapes, no font dependency.

## Kickbacks retrospective — CLOSED 2026-06-15 (do not re-run)

7 campaigns over Jun 11–15, every variable tested. **Verdict: kickbacks delivers
cheap, fast, broad, globally-distributed dev reach that converts to ~0 real
signups.** Fully characterized — more buys would only re-confirm the zero.

| date | impressions | spend | CPM | kb-clicks |
|---|---|---|---|---|
| 6/11 | 1,264 | $38.60 | ~$31 | 6 |
| 6/11 | 1,392 | $40.02 | ~$29 | 4 |
| 6/12 | 1,310 | $38.37 | ~$29 | 0 |
| 6/12 | 2,203 | $42.31 | ~$19 | 0 |
| 6/12 | 2,138 | $21.38 | ~$10 | 0 |
| 6/13 | 11,198 | $28.40 | ~$2.50 | 0 |
| 6/15 | 8,691 | $11.04 | ~$1.27 | 0 |
| **Σ** | **~28,000** | **~$218** | **~$7.8** | **10** |

**Reconciled funnel:** ~28,000 impressions → ~52 real visits (Plausible) → 1 signup
(freebie-farmer `myairdropacc@`, tz-pain creative) → **0 genuine fans.**

**Learnings (so we don't repeat the path):**
- **Converts ~0 regardless** of price ($31→$1 CPM), volume, creative, geo, or timing.
  Reach/price/delivery/geo were never the problem — *intent* is: a dev mid-coding
  isn't in "sign up for sports alerts" mode, anywhere on Earth.
- **Only buy at the cheap floor, if ever.** 80% of spend (~$180) bought 30% of reach;
  the two $1–2.50 CPM buys delivered 20k of the 28k impressions for ~$40. Ride the
  price down; never buy at $20–30 CPM.
- **Delivery is fast** (8,691 in 42 min at a cleared bid). Trust the live advertiser
  dashboard counter over any single report or my inference.
- **Kickbacks "clicks" metric is unreliable** (reported 10 vs Plausible's 52 visits).
  Trust the DB + Plausible, never the platform's click field.
- **Daypart/off-peak "clock" buying is feasible but low-value** — geo was already
  global without it (India 8, Indonesia, ME, Africa all showed up). Don't bother.

**What actually showed signal (the real levers):**
- **`weird-next` / identity creative**: 5 visitors but 20% bounce + 219s avg (vs
  tz-pain's 79% / 55s). The weird-sports identity angle drew *engaged* people. Test it.
- **Organic converts where paid doesn't**: the 1 genuine user (Jakarta Japan fan)
  came direct, converted in 24s. X drove ~0 (cold account = no reach) → the work is
  **audience-building**, not more ad spend.

## Ad buys

| date       | network   | medium  | campaign | content     | ad copy (what was shown)                                                | destination URL | result |
|------------|-----------|---------|----------|-------------|-------------------------------------------------------------------------|-----------------|--------|
| 2026-06-11 | kickbacks | spinner | wc2026   | weird-next  | `World Cup alerts now, weird sports next - oddlympics` (52ch)         | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=weird-next` | _pending_ |
| 2026-06-11 | kickbacks | spinner | wc2026   | utility     | `World Cup alerts in your time zone, one ping - oddlympics` (57ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=utility` | _pending_ |
| 2026-06-12 | kickbacks | spinner | wc2026   | name-first  | `oddlympics: your team's World Cup, in your time zone` (52ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=name-first` | _pending_ |
| 2026-06-12 | kickbacks | spinner | wc2026   | tz-pain     | `team plays at 3am your time? we'll ping you - oddlympics` (56ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=tz-pain` | _pending_ |
| 2026-06-12 | x (organic) | social | wc2026 | — | build-in-public launch thread (3 tweets) — see "X launch thread" below | `https://oddlympics.app/?utm_source=x&utm_medium=social&utm_campaign=wc2026` | _pending_ |

> **kickbacks format gotcha:** visible ad text is capped at **60 characters** (the
> destination URL is a separate, uncapped field). Keep `oddlympics` in the copy;
> drop gerund prefixes / arrows to fit; ASCII only (it renders in a terminal). The
> first buy's originals ran past 60 and silently lost the brand cue — the copy in
> the table above is the corrected ≤60 version.

### Copy/paste URLs

```
# Ad #1 — "weird-next" creative
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=weird-next

# Ad #2 — "utility" creative
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=utility

# Ad #3 — "name-first" creative (2026-06-12) — copy: oddlympics: your team's World Cup, in your time zone
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=name-first

# Ad #4 — "tz-pain" creative (2026-06-12) — copy: team plays at 3am your time? we'll ping you - oddlympics
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=tz-pain
```

> After the buy, fill the **result** column with: spend, impressions/clicks (from
> kickbacks), and Signup Submit conversions (from Plausible, filtered to this
> content tag). That closes the loop on which line actually pulled.

## X launch thread (organic, 2026-06-12)

Link lives only in tweet 3 (tweet 1 stays link-free for reach). Post as a reply-chain; pin tweet 1.

**1/** The 2026 World Cup is spread across 4 time zones. If your team isn't from the US, Canada, or Mexico, half its matches land at brutal local hours. Every big sports app will bury that under 17 betting-odds pings a day. I just wanted one alert for the games I care about.

**2/** So I built oddlympics. Pick your team, get one email an hour before each of its matches — in your local time. That's the whole app. No app to install, no betting odds, no engagement pings. One person, a $6 server, plain email. Free for the whole tournament.

**3/** And the World Cup's just the start. Next: the sports nobody covers properly — curling, BattleBots, speedcubing, competitive Excel (real, on ESPN), and any others. All weirdos welcome. Sign up for World Cup alerts and vote on what's next: `https://oddlympics.app/?utm_source=x&utm_medium=social&utm_campaign=wc2026`

## Querying ad → signups → referrals (DB)

As of the utm-capture change, `vip_signups` stores `utm_source/medium/campaign/content`
per signup (first-touch; sanitized lowercase). Referred friends arrive via `/r/CODE`,
which now tags them `utm_source=referral`. So the full funnel — ad → signup → referral —
is answerable in SQL, no Plausible join needed:

```sql
-- Which ad creatives drove not just signups, but referrals (and how contagious):
SELECT  ad.utm_content                                   AS ad,
        COUNT(DISTINCT ad.email)                         AS signups,
        COUNT(ref.email)                                 AS referrals_generated,
        ROUND(1.0*COUNT(ref.email)/COUNT(DISTINCT ad.email), 2) AS viral_coef
FROM        vip_signups ad
LEFT JOIN   vip_signups ref ON ref.referred_by = ad.referral_code
WHERE       ad.utm_source = 'kickbacks'
GROUP BY    ad.utm_content
ORDER BY    referrals_generated DESC;
```

`viral_coef` = referrals per signup — the prize metric (which ad brings users who *share*,
not just users). Ad-driven signups have `utm_source` set; share-driven have `utm_source='referral'`
+ `referred_by` set. Plausible stays the top-of-funnel mirror (visits, Signup Submit by campaign).
