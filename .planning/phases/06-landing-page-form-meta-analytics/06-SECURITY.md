---
phase: 06-landing-page-form-meta-analytics
audited: 2026-05-13
auditor: gsd-security-auditor
asvs_level: 1
block_on: open
threats_total: 21
threats_closed: 21
threats_open: 0
unregistered_flags: 0
status: SECURED
---

# Phase 06 — Security Audit Report

**Audit scope:** Verify every declared threat mitigation from the
`<threat_model>` blocks of `06-01-PLAN.md`, `06-02-PLAN.md`, and
`06-03-PLAN.md` against the implemented code. Implementation files are
read-only — this audit does NOT scan for new vulnerabilities. It verifies
declared dispositions only.

**Result: SECURED.** 21 / 21 threats verified. Zero unregistered flags
(none of the three Phase 6 summaries declared a `## Threat Flags`
section, and no new attack surface appeared during implementation that
maps to no threat ID).

The single declared mitigation update — code-fixer commit `08acf5c`
relaxing `T-06-17`'s smoke email pattern from `@example.invalid` to
`@example.com` — is an acceptable refinement of the mitigation (still
RFC-reserved, still gitignored DB, still cleanup-hint logged), not a
regression of `T-06-17` itself. Verified in evidence below.

---

## Plan 01 — Landing markup, head, form (T-06-01..09)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-06-01 | Spoofing (honeypot) | accept (existing) | Honeypot markup verbatim: `src/pages/index.astro:109` — `<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />`. CSS rule verbatim: `src/pages/index.astro:433-440` — `.hp { position: absolute; left: -10000px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }` (NOT `display: none`, per anti-pattern note). Server-side short-circuit retained at `src/pages/api/signup.ts:58-61` — non-empty `website` field 303s to `/pending` (silent pass for bots). |
| T-06-02 | Tampering (team field) | mitigate (existing) | Server-side allow-list at `src/pages/api/signup.ts:6` (`import { VALID_TEAMS } from '../../lib/teams'`) + `src/pages/api/signup.ts:77-80` — `if (!VALID_TEAMS.has(rawTeam)) { console.log(...); return back('bad-form'); }`. Set source: `src/lib/teams.ts:10` — `VALID_TEAMS: ReadonlySet<string> = new Set(TEAMS.map((t) => t.slug))` from `references/teams.json` (48 entries). Bad team → 303 `/?error=bad-form`, no DB row. |
| T-06-03 | Tampering (timezone field) | mitigate (existing) | Server-side fallback at `src/pages/api/signup.ts:7` (`import { VALID_TZ, FALLBACK_TZ }`) + `src/pages/api/signup.ts:83-90` — `if (rawTz && VALID_TZ.has(rawTz)) { tz = rawTz; } else { tz = FALLBACK_TZ; console.log('[signup] tz-fallback ...'); }`. Constants in `src/lib/timezones.ts:1` (`FALLBACK_TZ = 'America/New_York'`) and `src/lib/timezones.ts:11` (`VALID_TZ` from `Intl.supportedValuesOf('timeZone')`). Invalid/empty tz does NOT reject — silent fallback, log line emitted. |
| T-06-04 | Tampering (?error= host element) | mitigate | Plan 01 ships the `<p id="error" class="error" role="alert" hidden></p>` host element at `src/pages/index.astro:116`. The actual swap logic ships in Plan 02 and is verified under T-06-10 (uses `textContent` + COPY lookup-table). |
| T-06-05 | Information Disclosure (prohibited terms) | mitigate | Source-level grep clean: `grep -iE 'bitcoin\|lightning\|crypto\|world domination\|personal olympics' src/pages/index.astro` returns zero matches. Build-artifact grep clean: same grep against `dist/client/index.html` returns zero matches. `package.json:14` exposes `check:land-02` wrapper. (Side note: WR-04 in `06-REVIEW.md` flagged that the npm-script grep pattern itself literally contains the prohibited terms — non-blocking for the threat disposition; the canonical gate is the rendered HTML which is clean.) |
| T-06-06 | Information Disclosure (teams.json supply chain) | accept | `references/teams.json` is committed in-repo, reviewed during Phase 5. Build-time import only — `src/lib/teams.ts:1` uses `import teams from '../../references/teams.json' with { type: 'json' }`; `src/pages/index.astro:2` consumes via the typed re-export. No runtime fetch. Disposition documented in this audit table as accepted intentional risk. |
| T-06-07 | Repudiation / Availability (og:image 404 window) | accept (per CONTEXT D-07) | `src/pages/index.astro:14, 54, 61` hardcode `https://oddlympics.app/og-image.png` as the OG + Twitter image; the PNG ships in Phase 8. Between Phase 6 ship and Phase 8 ship social shares lack image preview but the link works. Disposition documented as accepted intentional risk; `06-VERIFICATION.md` IN-04 and `06-REVIEW.md` IN-04 also record this. |
| T-06-08 | Tampering (CSP regression, Plan 01) | mitigate | `deploy/Caddyfile` was NOT modified during Phase 6. `git log --since="2026-05-13" --until="2026-05-15" -- deploy/Caddyfile` returns no commits. Last Caddyfile commit predates Phase 6 (`7539c6f revert: drop B2 backup plumbing, enforce CSP directly` — Phase 1.5). CSP still emits `script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; form-action 'self'; frame-ancestors 'none'` at `deploy/Caddyfile:30` — verified. Inline `<script is:inline>` + `<style is:global>` blocks added in Plan 01/02 remain CSP-compatible. |
| T-06-09 | Tampering (form action open-redirect) | accept | `<form>` action is the hardcoded same-origin literal string `/api/signup` at `src/pages/index.astro:80` — `<form method="post" action="/api/signup" id="signup-form" class="form-card">`. Not user-controlled. CSP `form-action 'self'` (verified at `deploy/Caddyfile:30`) is the backstop. Disposition documented as accepted intentional risk. |

---

## Plan 02 — Inline JS: tz-swap, ?error= swap, Plausible listener (T-06-10..16)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-06-10 | Tampering / Info Disclosure (XSS via `?error=`) | mitigate | `src/pages/index.astro:213-231` — the `?error=` rendering uses a closed COPY lookup-table (six known codes) and `textContent` only. Critical lines: `src/pages/index.astro:227` — `el.textContent = COPY[code] || 'Something went wrong.';`. `textContent` does NOT parse HTML; injection attempts via `?error=<script>...` are surfaced as inert text. Hard fallback string `'Something went wrong.'` prevents attacker-controlled values reaching the DOM. Defense-in-depth: `grep -F 'innerHTML' src/pages/index.astro` returns zero — never used anywhere in the file. |
| T-06-11 | Tampering (XSS via Intl tz string) | accept | Browser CLDR is the source; user has no input path. Even if the IANA string were attacker-influenced, both DOM writes use `textContent`: `src/pages/index.astro:208` (`if (el) el.textContent = label;`) for the city label, and `src/pages/index.astro:203` (`tzInput.value = tz`) for the hidden field (an input value, not parsed as HTML). Backend `VALID_TZ` validation at `src/pages/api/signup.ts:85` (`if (rawTz && VALID_TZ.has(rawTz))`) — invalid → `FALLBACK_TZ`, no rejection. Disposition documented as accepted intentional risk. |
| T-06-12 | Information Disclosure (`console.log` in prod) | mitigate | Hostname gate at `src/pages/index.astro:242-244` — `const h = location.hostname; if (h === 'localhost' || h === '127.0.0.1') { console.log('[plausible] Signup Submit', { team: team }); }`. Mirrors the `[email-dev-fallback]` bracket-tag precedent in `src/lib/email.ts`. Prod console stays clean (oddlympics.app hostname does not match). |
| T-06-13 | Spoofing (Plausible event with spoofed `team` prop) | accept | The `team` prop comes from `form.team.value` (`<select name="team" required>` at `src/pages/index.astro:83`). A hostile client could craft a custom Plausible POST, but Plausible is observability — the `vip_signups` row in SQLite is authoritative. The empty-team guard at `src/pages/index.astro:239` (`if (!team) return;`) ensures every fired event has a non-empty `team` prop. Disposition documented as accepted intentional risk. |
| T-06-14 | Denial of Service (Plausible script blocked/4xx) | accept | Plausible call wrapped: `src/pages/index.astro:240` — `try { window.plausible('Signup Submit', { props: { team: team } }); } catch {}`. Outer `try { ... } catch {}` block also wraps the submit-listener registration at `src/pages/index.astro:234-247`. Exception swallowed; form navigation proceeds regardless. Disposition documented as accepted intentional risk. |
| T-06-15 | Tampering (page-unload cancels in-flight Plausible request) | accept (initial), mitigate (fallback documented) | Fire-and-forget pattern: `grep -F preventDefault src/pages/index.astro` returns zero — no `preventDefault()` on the submit listener. Relies on Plausible's `pa-*.js` `sendBeacon` path (assumption A1, RESEARCH §Pitfall 1). Phase 11 AC11 verifies dashboard event aggregation post-launch; fallback (`e.preventDefault(); plausible(...); setTimeout(() => form.submit(), 0)`) documented in plan §threat_model for future swap if drops are observed. Disposition documented as accepted initial-ship risk with documented mitigation path. |
| T-06-16 | Tampering (CSP regression, Plan 02) | mitigate | Same evidence as T-06-08: `deploy/Caddyfile` was NOT modified during Phase 6. CSP at `deploy/Caddyfile:30` still allows `'unsafe-inline'` on `script-src` (for the inline block at `src/pages/index.astro:198-248`) and `https://plausible.io` on `connect-src` (for sendBeacon). No CSP change made. |

---

## Plan 03 — Verification harness (T-06-17..21)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-06-17 | Tampering (smoke pollutes dev DB) | accept (existing pattern) | Smoke POSTs use `@example.com` addresses (`scripts/smoke-landing.mjs:210, 222` — `email: \`smoke-landing-${Date.now()}@example.com\``). Note: the plan originally specified `@example.invalid`; code-fixer commit `08acf5c` updated to `@example.com` to align with `scripts/smoke-signup.mjs` and to avoid Resend rejection of `.invalid` addresses when `RESEND_API_KEY` is set (per 06-REVIEW WR-02). This is an acceptable refinement of the mitigation — still uses an RFC-reserved test domain, still leaves cleanup hint at `scripts/smoke-landing.mjs:234` (`sqlite3 data/oddlympics.db "DELETE FROM vip_signups WHERE email LIKE 'smoke-landing-%@example.com'"`), still writes against a gitignored DB (`.gitignore:31` excludes `data/`). T-06-17's threat (DB pollution) is unchanged in severity. Disposition documented as accepted intentional risk. |
| T-06-18 | Information Disclosure (smoke logs DB rows/PII) | mitigate | Smoke is HTTP-only — `grep -E 'better-sqlite3\|new Database\|DATABASE_PATH' scripts/smoke-landing.mjs` returns zero matches. No DB import, no DB connection, no row reads. All assertions are HTML-string grep + HTTP status + Location header. Zero PII surface. |
| T-06-19 | Repudiation (Plausible dashboard config drift) | accept | DEPLOY.md Day-2-ops row added at `DEPLOY.md:114` — `grep -F "Plausible custom-goal" DEPLOY.md` exits 0. Row text: "Plausible custom-goal management (on-demand, when adding new custom events; Phase 6 added `Signup Submit`) | Visit `https://plausible.io/oddlympics.app/settings/goals` → '+ Add goal' → 'Custom event' → name = exact event name (case-sensitive) → Save. ..." Makes the goal discoverable for re-verification. Phase 11 AC11 closes the loop post-launch. Disposition documented as accepted intentional risk. |
| T-06-20 | Spoofing (operator marks goal configured without doing it) | accept | Solo developer project; trust model is "operator and developer are the same human (johnzilla)". Phase 11 AC11 catches a lie within 7 days post-launch (no event aggregation visible). Operator confirmed goal configured on 2026-05-14 per `06-03-SUMMARY.md:90` ("Operator confirmed via /gsd checkpoint reply: 'Goal configured.'"). Disposition documented as accepted intentional risk. |
| T-06-21 | Information Disclosure (Lighthouse JSON commits secrets) | accept | `references/lighthouse-phase-06.json` (415 KB, committed via `06-03 4c49148`) is a Lighthouse 13.3.0 mobile run against `http://localhost:4321` — performance metrics + audit results only, no secrets. Endpoint is localhost; no DB credentials, no API keys, no PII. Disposition documented as accepted intentional risk. |

---

## Unregistered Flags

None.

None of the three Phase 6 SUMMARY files (`06-01-SUMMARY.md`,
`06-02-SUMMARY.md`, `06-03-SUMMARY.md`) declared a `## Threat Flags`
section. The implementation introduced no new attack surface beyond what
the 21 threats in the register cover.

The four WARNING items in `06-REVIEW.md` (WR-01..04) and four INFO items
(IN-01..04) are non-security advisories about smoke-harness robustness
and out-of-scope third-party-script hardening — they do not introduce
new attack surface beyond what the threat register already covers, and
06-REVIEW classifies all as non-blocking.

---

## Accepted Risks Log

The following dispositions are formally accepted as intentional risk for
Phase 6. Each has documented residual exposure and a re-verification
trigger.

| Threat | Risk | Re-verification |
|--------|------|-----------------|
| T-06-01 | Honeypot is detection-only, not prevention; sophisticated bots ignore visible-honeypot fields | Phase 11 AC11 — observe sign-up funnel for bot-shaped traffic |
| T-06-06 | `references/teams.json` is in-repo and reviewed; if a malicious commit lands the slugs/labels are XSS via `value={t.slug}` / `{t.label}` rendering. Mitigated by code review at PR time. | Any PR that modifies `references/teams.json` triggers code-review attention |
| T-06-07 | OG-image 404 window between Phase 6 ship and Phase 8 ship — social shares lack image preview | Phase 8 ships `public/og-image.png`, closing the window |
| T-06-09 | Form action is hardcoded `/api/signup`; CSP `form-action 'self'` is the backstop | CSP audit (any future Caddyfile edit) |
| T-06-11 | IANA tz string from `Intl.DateTimeFormat()` — accepted as trusted browser CLDR source | Browser-vendor CLDR-poisoning is a hypothetical not-our-threat-model risk |
| T-06-13 | Plausible event `team` prop is observability, not authoritative state | `vip_signups` SQLite row is the source of truth |
| T-06-14 | Plausible script blocked/4xx → event drop is acceptable (analytics best-effort) | Phase 11 AC11 measures dashboard event count vs. SQLite row count |
| T-06-15 | Fire-and-forget Plausible POST may be canceled by page-unload before sendBeacon completes | Phase 11 AC11 — if drop rate >5%, swap to `preventDefault + setTimeout(form.submit, 0)` fallback per RESEARCH §Pitfall 1 |
| T-06-17 | Smoke writes RFC-6761 reserved-domain rows into dev SQLite — gitignored, cleanup hint logged | Operator-driven `sqlite3 ... DELETE FROM vip_signups WHERE email LIKE 'smoke-landing-%@example.com'` |
| T-06-19 | Plausible dashboard config drift — operator could change/delete the goal post-launch | DEPLOY.md Day-2-ops row makes the goal's existence discoverable; Phase 11 AC11 re-verifies |
| T-06-20 | Operator marks goal configured without doing it — solo-dev trust model | Phase 11 AC11 catches within 7 days post-launch |
| T-06-21 | Lighthouse JSON contains localhost performance metrics — no secrets | One-shot commit; no recurring exposure |

---

## Audit Methodology

1. Loaded all files from `<required_reading>`: three plans, three
   summaries, VERIFICATION.md, REVIEW.md, and all implementation files
   (`src/pages/index.astro`, `src/pages/api/signup.ts`, `src/lib/teams.ts`,
   `src/lib/timezones.ts`, `scripts/smoke-landing.mjs`, `deploy/Caddyfile`,
   `DEPLOY.md`).
2. Extracted the STRIDE threat register from each plan's `<threat_model>`
   block — 21 threats total across 9 + 7 + 5.
3. For each `mitigate` threat: grep'd the cited file path for the
   declared mitigation pattern and recorded file:line evidence.
4. For each `accept` threat: recorded the documented mitigation pattern
   from the threat register and verified it still holds in code
   (per audit constraint — `accept` ≠ "skip verification").
5. For `T-06-08` and `T-06-16` (CSP non-regression): confirmed
   `deploy/Caddyfile` was untouched during Phase 6 via `git log
   --since=2026-05-13 --until=2026-05-15 -- deploy/Caddyfile`.
6. Scanned `## Threat Flags` sections in all three summaries — none
   declared.
7. Cross-referenced `06-REVIEW.md` advisory items (WR-01..04, IN-01..04)
   to confirm none represent new attack surface absent from the threat
   register.

---

_Audited: 2026-05-13_
_Auditor: Claude (gsd-security-auditor)_
_ASVS Level: 1_
