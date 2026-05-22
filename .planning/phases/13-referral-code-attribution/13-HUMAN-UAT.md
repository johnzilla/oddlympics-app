---
status: partial
phase: 13-referral-code-attribution
source: [13-VERIFICATION.md]
started: 2026-05-22T21:58:50Z
updated: 2026-05-22T21:58:50Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ?ref= URL param populates hidden field in browser
expected: Load `http://localhost:4321/?ref=k7m2qx9a`, then in DevTools Console `document.getElementById('ref').value` returns `'k7m2qx9a'`.
result: [pending]

### 2. localStorage fallback carries code across navigations
expected: After test 1, navigate to `http://localhost:4321/` with no `?ref=` param; `document.getElementById('ref').value` still returns `'k7m2qx9a'`.
result: [pending]

### 3. 30-day TTL expiry
expected: In DevTools Console run `localStorage.setItem('oddlympics_ref', JSON.stringify({ ref: 'k7m2qx9a', ts: Date.now() - 31*24*60*60*1000 }))` then reload `/`; `document.getElementById('ref').value` returns `''` (expired entry discarded).
result: [pending]

### 4. Private/incognito mode resilience
expected: Open a private/incognito window and load `/?ref=k7m2qx9a`; page renders with no console errors and the form submit button is functional (localStorage DOMException silently swallowed).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
