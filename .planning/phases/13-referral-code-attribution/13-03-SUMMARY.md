---
phase: 13-referral-code-attribution
plan: "03"
subsystem: landing-page
tags: [referral, localStorage, inline-script, form, client-side]
dependency_graph:
  requires: [13-02]
  provides: [REF-02, SC2]
  affects: [src/pages/index.astro]
tech_stack:
  added: []
  patterns:
    - independent try/catch inline-script blocks (fourth added alongside existing three)
    - localStorage {ref, ts} first-touch persistence with 30-day TTL
    - client-side hidden-field population via document.getElementById + .value assignment
key_files:
  created: []
  modified:
    - src/pages/index.astro
decisions:
  - "Hidden ref input placed adjacent to timezone hidden input (line 94) — keeps all hidden/special fields grouped"
  - "localStorage key: 'oddlympics_ref' — consistent with project's oddlympics_ prefix idiom"
  - "First-seen only: localStorage.getItem check before setItem — never overwrites an existing entry (D-11)"
  - "No client-side validation of the ref value — client transports, server validates (D-13)"
  - "Nested try/catch for JSON.parse separate from outer localStorage write — malformed entry silently ignored"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-22T21:21:24Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 13 Plan 03: Landing-page ref field + localStorage reader Summary

Hidden `ref` input on the signup form + a defensive fourth inline-script block reading `?ref=CODE` from the URL, persisting first-touch to localStorage with 30-day TTL, and falling back to the stored value — so referral codes ride along with the POST.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add hidden ref input to signup form | 837b77e | src/pages/index.astro (+1 line) |
| 2 | Add defensive ?ref= + localStorage reader inline-script block | 58848c3 | src/pages/index.astro (+35 lines) |

## What Was Built

**Task 1 — Hidden `ref` input:**

Added `<input type="hidden" name="ref" id="ref" value="" />` at line 94 of `src/pages/index.astro`, grouped with the existing `timezone` and `requested_sport` hidden inputs. The `name="ref"` attribute matches the server's `form.get('ref')` in Plan 13-02. The `id="ref"` is the target for Task 2's inline script.

**Task 2 — Defensive inline-script block (Block 4):**

Added a fourth independent `try/catch` block inside the existing `<script is:inline>` element (after the Plausible submit listener). The block:

1. Reads `?ref=` from the URL via `new URL(location.href).searchParams.get('ref')` (consistent with Block 2's `?error=` pattern)
2. If a URL ref is present: uses it as the active ref, then writes it to `localStorage` under `'oddlympics_ref'` as `{ ref, ts }` JSON — only if nothing is already stored (first-touch, D-11)
3. If no URL ref: reads `localStorage.getItem('oddlympics_ref')`, parses it in its own nested `try/catch`, and uses the stored `.ref` if the entry exists and `Date.now() - ts < TTL` (30 days, D-12); otherwise leaves `activeRef` empty
4. Assigns `activeRef` to `document.getElementById('ref').value` — transport only, no validation (D-13)
5. Entire outer `try/catch` makes any `localStorage` `DOMException` (private mode, disabled) fall through silently — page never breaks (Pitfall 6)

## Verification

- `grep -c 'name="ref"' src/pages/index.astro` → 1 (AC1)
- `grep -c 'id="ref"' src/pages/index.astro` → 1 (AC1)
- `grep -c "searchParams.get('ref')" src/pages/index.astro` → 1 (AC2)
- `grep -c 'oddlympics_ref' src/pages/index.astro` → 1 (AC3)
- `grep -c '30 \* 24 \* 60 \* 60 \* 1000' src/pages/index.astro` → 1 (AC3)
- `grep -c "document.getElementById('ref')" src/pages/index.astro` → 1 (AC4)
- `npx astro check` → no errors for index.astro (pre-existing token.ts errors unrelated)

Manual verifications (per 13-VALIDATION.md § Manual-Only Verifications) are not automated here — they require a running dev server and browser DevTools:
1. Load `/?ref=k7m2qx9a` → `#ref` value should equal `k7m2qx9a`
2. Load `/` (no param) → `#ref` should retain `k7m2qx9a` from localStorage
3. Manually set stored `ts` to >30 days ago → `#ref` should be empty
4. Private/incognito window → page renders without error, form submittable

## Deviations from Plan

None — plan executed exactly as written. Hidden field placed adjacent to timezone input as specified. All four D-10..D-13 decisions honored. Block structure matches the three existing independent try/catch blocks.

## Threat Flags

No new threat surface beyond what the plan's threat model covers (T-13-08, T-13-09, T-13-10). The ref value is only ever assigned to `input.value` via DOM property — never `innerHTML`, never written to markup. No new XSS surface.

## Known Stubs

None. The hidden field is wired: the inline script populates it from the URL/localStorage, and the form POSTs it to `/api/signup` which reads it via `form.get('ref')` (Plan 13-02).

## Self-Check: PASSED

- `src/pages/index.astro` — exists and contains all required patterns
- Commit 837b77e — confirmed in git log (Task 1: hidden ref input)
- Commit 58848c3 — confirmed in git log (Task 2: inline script block)
