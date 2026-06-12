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

## Ad buys

| date       | network   | medium  | campaign | content     | ad copy (what was shown)                                                | destination URL | result |
|------------|-----------|---------|----------|-------------|-------------------------------------------------------------------------|-----------------|--------|
| 2026-06-11 | kickbacks | spinner | wc2026   | weird-next  | `World Cup alerts now, weird sports next - oddlympics` (52ch)         | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=weird-next` | _pending_ |
| 2026-06-11 | kickbacks | spinner | wc2026   | utility     | `World Cup alerts in your time zone, one ping - oddlympics` (57ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=utility` | _pending_ |
| 2026-06-12 | kickbacks | spinner | wc2026   | name-first  | `oddlympics: your team's World Cup, in your time zone` (52ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=name-first` | _pending_ |
| 2026-06-12 | kickbacks | spinner | wc2026   | tz-pain     | `team plays at 3am your time? we'll ping you - oddlympics` (56ch) | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=tz-pain` | _pending_ |

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
