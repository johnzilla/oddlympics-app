---
status: partial
phase: 15-personalized-open-graph
source: [15-VERIFICATION.md]
started: 2026-05-23T20:30:00Z
updated: 2026-05-23T20:30:00Z
---

## Current Test

[awaiting human testing — runs post-deploy]

## Tests

### 1. Real-world social unfurl on production

**Step:** After deploying Phase 15 to https://oddlympics.app, take any real `/r/<code>` URL (e.g., one from a confirmed VIP signup row in production), paste it into a social-platform unfurl debugger, and confirm the preview shows the team-specific image, not the generic OG image.

**Debuggers to use:**
- Twitter/X Card Validator: https://cards-dev.twitter.com/validator (or `curl -A "Twitterbot/1.0"`)
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Slack: paste link into any channel and check the unfurl

**Expected:**
- The unfurl card title reads `Following <Team> · oddlympics` (e.g., `Following England · oddlympics`)
- The preview image is the per-team PNG (e.g., `/og/england.png`) — NOT the generic `/og-image.png`
- The image renders at 1200×630, recognizable team name in the headline

**Result:** [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(none yet)
