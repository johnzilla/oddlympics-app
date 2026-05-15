---
phase: 09-manage-editor-unsubscribe
plan: "03"
subsystem: routing
tags:
  - redirect
  - manage-01
  - d-01
dependency_graph:
  requires:
    - 09-02  # sendManageLink() now writes /manage URLs; redirect is useful once that lands
  provides:
    - thin-301-redirect-schedule-to-manage
  affects:
    - src/pages/schedule.astro
tech_stack:
  added: []
  patterns:
    - Astro frontmatter-only page (no HTML body) as a server-side redirect handler
key_files:
  modified:
    - src/pages/schedule.astro
decisions:
  - In-process Astro page required for query-string-preserving 301 (Astro redirects: config drops query strings — upstream limitation, RESEARCH Q1)
  - 301 (permanent) chosen over 302 per D-01 — browser-cacheable, correct for permanent URL consolidation
metrics:
  duration: "63s"
  completed: "2026-05-15"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 09 Plan 03: Schedule 301 Redirect Handler Summary

Replaced `src/pages/schedule.astro` (a 351-line full editor page) with a 9-line server-rendered thin handler that issues a permanent 301 redirect to `/manage`, preserving the query string verbatim via `Astro.url.search`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace schedule.astro with thin 301 redirect handler | 4ea506e | src/pages/schedule.astro |

## Final File Content

```astro
---
export const prerender = false;
// D-01: /schedule is now a thin 301 redirect to /manage, preserving ?token=
// Astro.redirect defaults to 302; pass 301 for permanent (browser caches it).
// Astro's `redirects:` config cannot preserve query strings (upstream limitation),
// so an in-process handler is required.
const dest = '/manage' + (Astro.url.search || '');
return Astro.redirect(dest, 301);
---
```

## Verification Evidence

Static file checks (all pass):
- `wc -l src/pages/schedule.astro` → 9 lines (≤ 10 threshold)
- `grep -c "return Astro.redirect" src/pages/schedule.astro` → 1
- `grep -c "Astro.url.search" src/pages/schedule.astro` → 1
- `grep -c "prerender = false" src/pages/schedule.astro` → 1
- No `<style>`, `<form>`, `<select>`, `<html>`, or `import` present
- `npm run build` → exit 0

Live redirect verification (dev server, curl -sI with redirect:manual):

```
GET /schedule            → 301, Location: /manage
GET /schedule?token=abc  → 301, Location: /manage?token=abc
GET /schedule?status=saved → 301, Location: /manage?status=saved
GET /schedule?status=saved&foo=bar → 301, Location: /manage?status=saved&foo=bar
```

All must_haves from plan frontmatter satisfied:
- GET /schedule (no query string) returns 301 with Location: /manage — PASS
- GET /schedule?token=ABC123 returns 301 with Location: /manage?token=ABC123 — PASS
- GET /schedule?status=saved returns 301 with Location: /manage?status=saved — PASS
- schedule.astro file contains no editor UI — PASS (9 lines, frontmatter only)

## Wave Dependency Note

Plan 09-04 (manage.astro editor) MUST land in the same Wave 2 and MUST remove `manage.astro:7`'s legacy `if (session) return Astro.redirect('/schedule')` redirect as its first step. Without that removal, a session-valid user hitting /manage would be redirected to /schedule, which now 301s back to /manage — an infinite redirect loop. The planner has ordered 09-04 with removal-first; both plans can land in any order within Wave 2 so long as 09-04 ships the removal atomically with the editor branch.

## Deviations from Plan

None — plan executed exactly as written.

`astro check` reports pre-existing errors (missing `@types/node`, `@types/better-sqlite3`) that are unrelated to this plan's change. The new `ts(6133)` warning on `schedule.astro:7` ("dest is declared but its value is never read") is a false positive from `astro check`'s static analysis in the context of Astro's frontmatter `return` syntax — the runtime correctly uses `dest` in the `Astro.redirect(dest, 301)` call, and the build and live curl tests confirm correct behavior. This is an out-of-scope pre-existing checker limitation.

## Threat Flags

None — this change is a pure server-side redirect with no new network endpoints, no auth paths, no file access, and no schema changes.

## Known Stubs

None.

## Self-Check: PASSED

- src/pages/schedule.astro exists: FOUND
- Commit 4ea506e exists: FOUND
- 301 redirect verified via live curl: PASS
- Query string preserved verbatim: PASS
