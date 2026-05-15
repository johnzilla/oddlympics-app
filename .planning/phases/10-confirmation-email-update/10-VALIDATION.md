---
phase: 10
slug: confirmation-email-update
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node ESM smoke scripts (no test runner — matches `smoke-signup.mjs`, `smoke-manage.mjs` precedent) |
| **Config file** | none — scripts are self-contained |
| **Quick run command** | `npm run smoke:confirm` |
| **Full suite command** | `npm run smoke:confirm && npm run smoke:signup && npm run smoke:manage` |
| **Estimated runtime** | ~3 seconds (offline; smoke:confirm pure-import; signup/manage need dev server) |

---

## Sampling Rate

- **After every task commit:** Run `npm run smoke:confirm`
- **After every plan wave:** Run `npm run smoke:confirm` (Phase 10's only automated suite — signup/manage need a running server)
- **Before `/gsd-verify-work`:** `smoke:confirm` must exit 0; D-08 Mail-Tester score ≥ 8 captured in `10-SUMMARY.md`; D-09 three screenshots committed under `evidence/`
- **Max feedback latency:** 3 seconds (offline smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SIGNUP-04 | — | sendMagicLink(email,token,team,timezone) signature widened; caller in api/signup.ts passes validated values | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | SIGNUP-04 | — | teamLabel('england')==='England'; teamLabel(unknown)===slug | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | SIGNUP-04 | — | tzLabel('America/Detroit')==='Detroit time'; tzLabel('Etc/UTC')==='your local time' | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | SIGNUP-04 | — | Body string contains SIGNUP-04 value-prop line verbatim for canonical pair | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | SIGNUP-04 | — | Subject literal equals "Confirm your World Cup alerts — oddlympics" | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-06 | 01 | 1 | LAND-02 | — | Body LAND-02 grep returns no matches (bitcoin/lightning/crypto/world domination/personal olympics) | unit (smoke import) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-01-07 | 01 | 1 | MANAGE-02 (inherited) | — | Resend send call includes List-Unsubscribe + List-Unsubscribe-Post + Reply-To headers | unit (smoke import of buildHeaders or composer return) | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | SIGNUP-04 | — | scripts/smoke-confirm-email.mjs exists, exit 0 on the 10 cases | unit | `npm run smoke:confirm` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | — | — | package.json has "smoke:confirm" script alias | source assertion | `node -e "process.exit(require('./package.json').scripts['smoke:confirm']?0:1)"` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | SC3 | — | Mail-Tester run from prod sender scores ≥ 8/10 — score + 7 sub-checks pasted into 10-SUMMARY.md §Deliverability Evidence | manual operator | (manual — see Manual-Only Verifications) | ✅ | ⬜ pending |
| 10-03-02 | 03 | 2 | SC2 | — | Three screenshots (mail-gmail.png, mail-proton.png, mail-outlook.png) committed under `.planning/phases/10-confirmation-email-update/evidence/` showing intact layout, resolved links, unsubscribe footer, no LAND-02 terms | manual operator | `ls .planning/phases/10-confirmation-email-update/evidence/mail-{gmail,proton,outlook}.png` (file-existence assertion) | ✅ | ⬜ pending |
| 10-03-03 | 03 | 2 | SC1 | — | A real signup → confirm loop on prod renders the value-prop line correctly with the recipient's actual team + tz (covered by D-09 sends; cross-references 10-03-02 screenshots) | manual operator | (manual — see Manual-Only Verifications) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-confirm-email.mjs` — Phase 10 D-10 offline smoke script (10 cases enumerated in CONTEXT.md §Decisions and §Specifics). Imports `sendMagicLink` body composer (or its constituent helpers `teamLabel` / `tzLabel`) and asserts each case.
- [ ] `package.json` scripts: `"smoke:confirm": "node scripts/smoke-confirm-email.mjs"` — matches existing `smoke:signup` / `smoke:manage` naming convention.
- [ ] `.planning/phases/10-confirmation-email-update/evidence/` directory — committed alongside the screenshots in Plan 03.

*All test-style verifications run via `node` ESM imports — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mail-Tester score ≥ 8/10 from prod sender | SC3 | No public Mail-Tester API; per-deploy one-shot operator action | (1) Open mail-tester.com, copy throwaway address. (2) From a fresh browser profile, sign up on https://oddlympics.app with that address + a real team. (3) Click "Then check your score". (4) Paste numeric score + 7 sub-checks (SPF/DKIM/DMARC/spam-rules/body/links/auth) into `10-SUMMARY.md` §Deliverability Evidence. (5) If < 8, iterate the body or headers; re-deploy; re-run. |
| Gmail / Proton / Outlook cross-client render | SC2 | Email rendering quirks (Gmail clip threshold, Proton dark-mode forcing, Outlook.com webmail) cannot be observed offline; Litmus/Email-on-Acid budget rejected per CONTEXT D-09 | (1) After Mail-Tester passes, sign up three more times from operator-controlled @gmail.com, @proton.me, @outlook.com (or @hotmail.com) inboxes with a real team. (2) Open each delivered email in native web client. (3) Screenshot the rendered message body (sender + subject + body + footer). (4) Commit to `.planning/phases/10-confirmation-email-update/evidence/` as `mail-gmail.png`, `mail-proton.png`, `mail-outlook.png`. (5) Reference all three in `10-SUMMARY.md` §Cross-Client Evidence with pass/fail note per client (layout intact, link resolves, unsubscribe visible, LAND-02 absent). |
| Live signup → confirm loop end-to-end | SC1 | Already covered by 10-03-02 in practice — the same three sends double as SC1 evidence | (Implicitly verified when the three screenshots show the SIGNUP-04 value-prop line rendered with the recipient's actual team + tz. No separate operator step.) |

---

## Validation Sign-Off

- [ ] All tasks have automated verify OR Wave 0 dependencies (smoke:confirm covers tasks 10-01-* / 10-02-*; 10-03-* are explicitly manual operator actions in the table above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Plans 01 + 02 are fully automated; Plan 03 is a deliberate manual deliverability gate that follows passing automated work)
- [ ] Wave 0 covers all MISSING references (smoke-confirm-email.mjs + npm script + evidence/ dir all created by Plans 01/02)
- [ ] No watch-mode flags (`smoke:confirm` is one-shot Node ESM, exits non-zero on mismatch)
- [ ] Feedback latency < 3s (offline smoke — pure imports, no Resend network call)
- [ ] `nyquist_compliant: true` set in frontmatter after Plan 01 + Plan 02 ship

**Approval:** pending
