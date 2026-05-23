---
status: partial
phase: 14-share-experience
source: [14-VERIFICATION.md]
started: 2026-05-23T02:15:00Z
updated: 2026-05-23T02:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Native share sheet on mobile (SC3, D-20)
expected: Tap Share on /pending?email=...&rc=<real>&team=brazil on iOS Safari and Android Chrome → OS share sheet opens with text "I'm following Brazil — get your team's World Cup kickoff alerts." and URL "<origin>/?ref=<rc>" pre-populated. Cancel the share sheet → button does NOT swap to "Copied!" (T-14-17 AbortError no-fall-through). Repeat on /confirmed?status=ok&rc=<real> and on /manage after sign-in.
result: [pending]

### 2. Clipboard fallback on desktop (SC3, D-20)
expected: Click Share on the same three pages in desktop Chrome / Safari / Firefox → button text flashes "Copied!" for ~1.5s then restores; paste into a new tab address bar to confirm the URL was copied to the clipboard. On Firefox (no navigator.share), confirm fallback fires on first click.
result: [pending]

### 3. Hidden-when-empty branches (D-03, D-16)
expected: GET /pending directly (no ?rc=) → share card invisible. GET /confirmed directly (no params) → share card invisible. GET /confirmed?status=bad-token → share card invisible. GET /confirmed?status=unknown → share card invisible. Confirmed visually (hidden attribute) in browser DevTools or by absence of the card on the rendered page.
result: [pending]

### 4. Cross-client email rendering (SC2, D-20)
expected: With RESEND_API_KEY configured (or production), trigger a real signup and inspect the confirmation email in Apple Mail (iOS + macOS), Gmail (web + Android), Outlook (web), Proton Mail. Verify: (a) the muted share <p> "Know someone else following <team>? Share your link: <url>" renders below the Confirm-email button; (b) the <strong> team name renders bold; (c) the <a href> link is clickable and points at <origin>/?ref=<rc>; (d) the plaintext fallback shows the shareLine; (e) no visual collision with the accent-colored NO_ACCOUNT callout (D-12).
result: [pending]

### 5. /manage share card visibility per branch (D-17)
expected: Sign in to /manage as a confirmed non-unsubscribed user → share card visible between "Save selection" button and schedule list. Trigger unsubscribe via the email link → re-visit /manage with the same session → unsubscribed branch shown; share card NOT visible. Sign out → /manage shows signed-out branch; share card NOT visible. Visit /manage with an expired/invalid token → share card NOT visible.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
