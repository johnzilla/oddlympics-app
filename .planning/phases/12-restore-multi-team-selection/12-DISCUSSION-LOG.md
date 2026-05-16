# Phase 12: Restore multi-team selection - Discussion Log

> **Audit trail only.** Not consumed by downstream agents — they read CONTEXT.md.

**Date:** 2026-05-16
**Phase:** 12-restore-multi-team-selection
**Areas discussed:** Store + migration, /manage multi-select UX, Selection rules, MVP scope vs deadline

---

## Pre-discussion constraint (user-volunteered, LOCKED)

User: *"solo dev and builder, no signups, no legacy — do not block on preserving legacy signup."*
→ D-02: overrides PROJECT.md's additive-migration / preserve-email-list mandate
for this phase. No migration ceremony. Significantly de-risks scope + deadline.

## Store + migration

| Option | Selected |
|--------|----------|
| Join table `user_teams(email, team_slug)` | ✓ |
| Delimited/JSON column on `vip_signups` | |

**Choice:** Join table. Simplest correct cron query + matches SQLite idiom;
`CREATE TABLE IF NOT EXISTS` (additive, no destructive migration). → D-01.

## /manage multi-select UX

| Option | Selected |
|--------|----------|
| Confederation-grouped checkboxes | ✓ |
| Add/remove chips + picker | |
| Native `<select multiple>` | |

**Choice:** Confederation-grouped checkboxes (reuses teams.json grouping, no
framework JS). **User add-on:** also update body copy ("follow up to 5 teams"
or similar) when scoping. → D-04.

## Selection rules / edge cases

| Option | Selected |
|--------|----------|
| ≥1 required, no upper cap | |
| Allow zero = subscribed but silent | |
| Cap at a max N | ✓ |

**Choice:** Cap at a max N. User asked for guidance on the value (3 vs 5);
Claude recommended **5** (covers nation+heritage+host+favorite without biting;
blocks all-48 flood; lowerable later). **User confirmed: max 5**, ≥1 required,
server-enforced reusing the Phase-9 `too-many`→`bad-team` path. → D-05.

## MVP scope vs 2026-06-11

| Option | Selected |
|--------|----------|
| Store + /manage multi + cron join + N-team email copy | ✓ |
| Also add 'primary team' concept now | |
| Tightest: /manage + store only this phase | |

**Choice:** The tight launch-unblocking slice. → D-08.

## Claude's Discretion

- `vip_signups.team` keep/drop/seed (no legacy obligation); `user_teams` DDL
  details; optional inline checkbox-cap nicety; exact /manage copy; remove
  `team_ids[]` legacy fallback?; N-team email phrasing; plan/wave split.

## Deferred Ideas

- 'Primary team' concept; per-team reorder; `/schedule` revival; multi-team
  analytics; subject-line personalization; the duplicated-`<style>` accent
  tech-debt (Layout.astro refactor — not this phase).

## Sequencing note

ROADMAP Phase-12 stub auto-generated "Depends on: Phase 11" — INVERTED.
Authoritative (D-09): Phase 12 depends on 5–10; Phase 11 launch gate re-runs
AFTER 12 and only then cuts the withheld `v1.0-consumer-landing` tag.
