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

## Ad buys

| date       | network   | medium  | campaign | content     | ad copy (what was shown)                                                | destination URL | result |
|------------|-----------|---------|----------|-------------|-------------------------------------------------------------------------|-----------------|--------|
| 2026-06-11 | kickbacks | spinner | wc2026   | weird-next  | `Thinking… World Cup alerts now, weird sports next → oddlympics`         | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=weird-next` | _pending_ |
| 2026-06-11 | kickbacks | spinner | wc2026   | utility     | `Compiling… your team's World Cup matches, your timezone, one ping → oddlympics` | `https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=utility` | _pending_ |

### Copy/paste URLs

```
# Ad #1 — "weird-next" creative
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=weird-next

# Ad #2 — "utility" creative
https://oddlympics.app/?utm_source=kickbacks&utm_medium=spinner&utm_campaign=wc2026&utm_content=utility
```

> After the buy, fill the **result** column with: spend, impressions/clicks (from
> kickbacks), and Signup Submit conversions (from Plausible, filtered to this
> content tag). That closes the loop on which line actually pulled.
