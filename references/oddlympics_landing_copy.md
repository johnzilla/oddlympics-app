# Oddlympics — Landing Page Copy Doc (consumer launch)

**Date:** May 12, 2026
**Audience:** Casual World Cup fans (Mexico, England, Argentina, Nigeria, etc.) hitting the page from cold Meta/TikTok/Reddit traffic
**Voice:** Dry and useful — no jokes, no hype, sound like a person not a brand
**Visual direction:** Light, sans-serif, consumer-friendly (see the HTML file for implementation)

---

## Above the fold

### Banner pill (top of hero)
`WORLD CUP 2026 · JUNE 11 – JULY 19`

### Headline
**Your team's matches. In your time zone. One ping before kickoff.**

### Sub-headline (timezone is filled in by JS — fallback shown)
> Pick your team. We'll email you one hour before every match in **your local time**. Nothing else. Free, no ads, no betting odds.

*(JS replaces "your local time" with the literal detected zone, e.g. "Eastern Time" or "Lagos time.")*

### Form
- **Field 1:** Team dropdown — defaults to "Pick your team" with all 48 teams, grouped by confederation.
- **Field 2:** Email — placeholder `you@example.com`
- **Submit button:** `Get match alerts`
- **Below submit, small text:** "One ping 1 hour before kickoff. Unsubscribe in one click."

### Trust line (under form)
> Built by one person in Michigan. No app to install. We'll never sell your email.

---

## Section 2 — How it works (three steps, monospace bullets work even on a light page)

### Heading
**How it works**

### Steps
1. **Pick your team.** Choose one or more of the 48 teams in the 2026 World Cup.
2. **We figure out your time zone.** Every match time gets translated to where you actually are.
3. **You get one email per match.** One hour before kickoff. That's it.

---

## Section 3 — Why I built this

### Heading
**Why this exists**

### Body (60–80 words, first-person, no name needed)
> The 2026 World Cup is being played across three countries and four time zones. If your team isn't from the US, Canada, or Mexico, half your matches will be at awkward local hours. The big sports apps will buzz you 17 times a day with betting odds and "engagement" pings. I just wanted one alert for the matches I cared about. So I built it. Free for the whole tournament.

---

## Section 4 — What's next (teaser for the real product)

### Heading
**After the World Cup**

### Body
> The plan is to do this for sports that nobody else covers properly — curling, esports, BattleBots, the Rubik's Cube World Championship, the Microsoft Excel World Championship (it's real, and it's on ESPN), lumberjack sports, drone racing. If you sign up now, you get a vote on what comes next.

---

## Section 5 — FAQ (optional, helps with cold traffic trust)

**Heading:** Common questions

**Q: Is this really free?**
Free for the entire 2026 World Cup. No card required.

**Q: How many emails will I get?**
One per match for the teams you pick. If you choose one team, you'll get 3 emails during the group stage. If they advance, more. That's the maximum.

**Q: Will you sell my email?**
No. We use a single email provider to send the alerts. Unsubscribe link in every message.

**Q: Are you affiliated with FIFA, ESPN, or any team?**
No. This is an independent project. Match times are pulled from public schedules.

**Q: Why should I trust this?**
You shouldn't — yet. Try it for one match. If the email doesn't show up on time, unsubscribe.

---

## Section 6 — Footer

- Manage your subscription → `/manage`
- Privacy → `/privacy`
- Terms → `/terms`
- Contact → `mailto:hello@oddlympics.app`
- Copyright line: `© 2026 Oddlympics. Independent project. Not affiliated with FIFA.`

---

## Meta tags (replace current set)

```html
<title>Oddlympics — World Cup 2026 alerts in your time zone</title>
<meta name="description" content="Pick your team. Get one email one hour before every 2026 World Cup match, in your local time zone. Free. No ads. No betting odds.">

<!-- Open Graph -->
<meta property="og:title" content="World Cup 2026 alerts in your time zone">
<meta property="og:description" content="Pick your team. One ping, one hour before kickoff, in your local time. Free for the whole tournament.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://oddlympics.app">
<meta property="og:image" content="https://oddlympics.app/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Oddlympics — World Cup 2026 alerts in your time zone">
<meta property="og:site_name" content="Oddlympics">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="World Cup 2026 alerts in your time zone">
<meta name="twitter:description" content="Pick your team. One ping, one hour before kickoff. Free.">
<meta name="twitter:image" content="https://oddlympics.app/og-image.png">
```

**Note:** No mention of crypto, Lightning, Bitcoin, "world domination," or "personal Olympics" in any meta tag or visible copy. These trip Meta ad relevance scoring and confuse cold consumer traffic. Keep them in your `/about` or internal docs.

---

## /privacy stub (single page, ~200 words)

> # Privacy Policy — Oddlympics
>
> **Last updated: May 12, 2026**
>
> Oddlympics is operated by an individual developer in Michigan, USA. This is a free, ad-free service for sending World Cup match notifications.
>
> **What we collect:**
> - Your email address (so we can send you alerts)
> - The team(s) you select
> - Your time zone (detected from your browser, used only to calculate match times)
> - Standard server logs (IP, user agent) retained for 30 days for abuse prevention
>
> **What we don't collect:**
> - Your name, address, phone number, or any payment info
> - Any third-party tracking cookies — we use Plausible Analytics, which is cookie-free and GDPR-compliant
>
> **What we never do:**
> - Sell or share your email with anyone
> - Send marketing emails unrelated to your subscription
> - Use your data for advertising
>
> **Your rights:**
> - One-click unsubscribe in every email
> - Email `privacy@oddlympics.app` to request full deletion of your data
> - GDPR / CCPA requests honored within 30 days
>
> **Email delivery is handled by:** [Your ESP — Resend, Buttondown, ConvertKit, etc.]. Their privacy policy also applies to message delivery.
>
> Questions: `hello@oddlympics.app`

---

## /terms stub (~150 words)

> # Terms — Oddlympics
>
> **Last updated: May 12, 2026**
>
> By using Oddlympics, you agree to the following:
>
> 1. **Free service.** Oddlympics is currently free. We may add paid features in the future for non-World-Cup sports. Your World Cup subscription will remain free through July 19, 2026.
> 2. **Best-effort delivery.** We try our best to deliver match alerts on time. If a match is rescheduled by FIFA, or if email delivery fails for technical reasons, we are not liable for missed games.
> 3. **No affiliation.** We are not affiliated with FIFA, ESPN, any national team, or any broadcaster. Match schedules are pulled from public sources.
> 4. **Acceptable use.** Don't use the signup form to submit fake or other people's email addresses. One-click unsubscribe is available in every email.
> 5. **Disputes.** Governed by the laws of Michigan, USA.
>
> Questions: `hello@oddlympics.app`

---

## What's NOT on the page (deliberately)

- "World domination" framing — moved to internal docs only
- "Personal Olympics" — used in /about narrative only, not on landing
- "Bitcoin / Lightning rails" — removed entirely from public marketing copy
- VIP / stranger sports CTA — collapsed into the "What's next" section as a single line, not a separate CTA. After the survey on June 20 you can build a real CTA for the second product.
- Pricing — nothing on the page about money, future paid tiers, or what happens after the Cup. Don't introduce friction.

---

## Pre-launch checklist (before any paid traffic)

- [ ] New copy live on `oddlympics.app`
- [ ] Team dropdown populated with all 48 teams
- [ ] JS timezone detection working, with a sane fallback for users who block it
- [ ] OG image rendering (test with [opengraph.xyz](https://www.opengraph.xyz/))
- [ ] `/privacy` and `/terms` pages live
- [ ] Form posts to `/api/signup` successfully (already working)
- [ ] Confirmation email actually arrives — test from 3 providers (Gmail, Proton, Outlook)
- [ ] Unsubscribe link in confirmation email works end-to-end
- [ ] One real match alert test fires (use Mexico vs. opening match as the test trigger)
- [ ] Plausible tracking signups as a goal
- [ ] Page passes Lighthouse with score >90 on mobile
