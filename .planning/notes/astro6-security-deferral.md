---
title: Astro 6 security advisories — deliberate post-launch deferral
date: 2026-05-16
context: Dependabot/npm-audit triage during launch-readiness (~26 days to 2026-06-11 World Cup kickoff).
---

# Astro 6 security advisories — deliberate post-launch deferral

## Decision

**Accept the risk and defer the Astro 6 / `@astrojs/node` 10 upgrade until
after the World Cup launch.** This is a documented, evidence-based risk
acceptance — not an oversight.

## What was fixed now (2026-05-16)

Targeted `overrides` added to `package.json`, applied via `npm install`:

- `devalue` → `^5.8.1` — clears the **HIGH** advisory (DoS via sparse array
  deserialization). Clean non-major transitive bump.
- `yaml` → `^2.8.3` (resolved 2.9.0) — clears the **MEDIUM** advisory (stack
  overflow via deeply nested YAML). Transitive, dev-tooling only (flows
  through `@astrojs/check`).

`npm audit`: 8 → 2. `npm run build` green; `npx astro check` unchanged
(19 pre-existing type errors, **0 new**).

## What was deferred and why

The 2 remaining `moderate` advisories (`astro`, `@astrojs/node`) have **no
Astro-5 patch** — the only fix is a major migration to `astro@6.x` +
`@astrojs/node@10.x`.

The advisories themselves:

1. Server Islands — encrypted-parameter cross-component replay / memory-
   exhaustion DoS / cache poisoning.
2. XSS in `define:vars` via incomplete `</script>` sanitization.

**Exploitability in this codebase: none.** Verified 2026-05-16:

- `grep -rEl 'server:defer' src/` → **0 files** (no Server Islands used)
- `grep -rEl 'define:vars' src/` → **0 files** (no `define:vars` used)

Both vulnerable features are entirely unused. The risk surface is empty.

**Cost of fixing now:** Astro 5 → 6 is a major framework migration (adapter
compat, breaking changes) requiring a full re-test of build, SSR, prerender,
all API routes, and the deploy pipeline. The project constraint is explicit:
"Astro 5 ... no rewrites mid-deadline." 26 days from a FIFA-fixed,
non-negotiable launch date, a speculative framework migration for
non-exploitable advisories is the wrong trade.

## Revisit trigger

After the World Cup launch settles (post-2026-06-11), plan the Astro 6 /
`@astrojs/node` 10 migration as its own scoped effort with full regression
testing. Re-evaluate sooner only if a *new* advisory lands that IS reachable
in this codebase, or if Server Islands / `define:vars` get adopted.
