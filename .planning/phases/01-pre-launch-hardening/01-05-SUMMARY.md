---
phase: 01-pre-launch-hardening
plan: "05"
subsystem: caddy/security-headers
tags:
  - csp
  - caddy
  - security-headers
  - report-only
dependency_graph:
  requires:
    - deploy/Caddyfile (existing security-headers block)
  provides:
    - Content-Security-Policy-Report-Only header on all oddlympics.app responses
  affects:
    - plan 01-06 (flips report-only to enforcing CSP — must be byte-identical)
tech_stack:
  added: []
  patterns:
    - Caddy header directive inside existing header block
key_files:
  modified:
    - deploy/Caddyfile
decisions:
  - "D-16: report-only first then enforce (two-step deploy)"
  - "D-17: keep 'unsafe-inline' for script-src and style-src; all three pages use inline scripts and styles"
  - "D-18: CSP lives in Caddyfile alongside existing security headers, not in Astro"
  - "No report-uri/Reporting-Endpoints collector — browser console check suffices for 3-4 static pages"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 1
---

# Phase 1 Plan 05: CSP Report-Only Header — Summary

**One-liner:** Added `Content-Security-Policy-Report-Only` header to `deploy/Caddyfile` with the D-17 minimal allow-list policy; paused at checkpoint for human deploy + 1-2 day observation window before plan 06 flips to enforcement.

## Status: CHECKPOINT REACHED (Task 2 — human-action)

Task 1 (Caddyfile edit) is complete and committed. Task 2 requires a human to:
1. `scp` the updated Caddyfile to the droplet
2. Reload Caddy
3. Observe real traffic for 24-48 hours for zero CSP violations
4. Send the resume signal before plan 06 runs

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Content-Security-Policy-Report-Only to Caddyfile | 3c3d42b | deploy/Caddyfile |

## Caddyfile Diff Applied

```diff
  # Security headers
  header {
      Strict-Transport-Security "max-age=31536000; includeSubDomains"
      X-Content-Type-Options "nosniff"
      Referrer-Policy "strict-origin-when-cross-origin"
      X-Frame-Options "DENY"
+     Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
      # Caddy adds Server: Caddy by default; hide it
      -Server
  }
```

The new line is inserted between `X-Frame-Options "DENY"` and the `# Caddy adds Server` comment — exactly where plan 06 will rename it from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` using an identical value.

## Policy Value (D-17 verbatim, concatenated for Caddy)

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
```

## Deviations from Plan

None — plan executed exactly as written. The edit substitution matched verbatim including tab indentation.

## Checkpoint: Task 2 — Human Deploy + Observation

**Type:** human-action  
**Blocked on:** manual deploy (the GitHub Actions workflow does not rsync `deploy/Caddyfile` — only `dist/`)

### Deploy steps (for the operator after orchestrator merges the worktree branch)

```bash
# 1. After merge to main, pull locally
git pull origin main

# 2. Copy Caddyfile to droplet
scp deploy/Caddyfile root@oddlympics.app:/etc/caddy/Caddyfile

# 3. Validate and reload
ssh root@oddlympics.app 'caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy && systemctl status caddy --no-pager | head -10'

# 4. Probe all four paths
for path in / /pending /confirmed /unsubscribed; do
  echo "=== https://oddlympics.app${path} ==="
  curl -sI "https://oddlympics.app${path}" | grep -iE 'content-security-policy|strict-transport|x-content-type|x-frame|referrer-policy'
done

# 5. Browser console check (Chrome + Safari, DevTools open, each page hard-reloaded)
# Expected: zero [Report Only] CSP violation messages on all four pages
```

### Resume signal

After 24-48 hours of zero violations under real traffic, send:

> "approved — proceed to plan 06"

Or if violations are observed:

> "policy needs adjustment: \<details\>"

## Acceptance Criteria Status (Task 1 — verified locally)

| Check | Result |
|-------|--------|
| `grep -c 'Content-Security-Policy-Report-Only' deploy/Caddyfile` == 1 | PASS |
| All 9 CSP directive fragments present (grepped individually) | PASS |
| `grep -cP 'Content-Security-Policy[^-]' deploy/Caddyfile` == 0 (no enforcing header) | PASS |
| HSTS, nosniff, X-Frame-Options, Referrer-Policy, -Server all preserved | PASS |
| Line count increased by exactly 1 (37 → 38) | PASS |

## Known Stubs

None — this plan modifies only the Caddyfile. No UI stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The CSP header is a browser-side restriction only.

## Self-Check: PASSED

- [x] `deploy/Caddyfile` modified and contains `Content-Security-Policy-Report-Only`
- [x] Commit `3c3d42b` exists: `feat(01-05): add Content-Security-Policy-Report-Only to Caddyfile`
- [x] SUMMARY.md written at `.planning/phases/01-pre-launch-hardening/01-05-SUMMARY.md`
- [x] STATE.md not modified (orchestrator owns writes)
- [x] ROADMAP.md not modified (orchestrator owns writes)
