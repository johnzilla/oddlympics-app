# Phase 11: End-to-end + launch gate - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The v2.0 launch gate. Verify all twelve acceptance criteria (AC1–AC12) pass on
production `https://oddlympics.app`, capture per-AC evidence, save the mandated
Lighthouse mobile report, run one real John's-Gmail signup → confirm → manage →
unsubscribe loop, and tag the release `v1.0-consumer-landing`.

**No new product features.** This phase proves phases 5–10 landed. It MAY carry
SMALL fixes that close a failing AC (see D-01), but it does not add capability.

In scope:
- One contrast-fix edit to `src/pages/index.astro` inline styles (D-02), landed first.
- A consolidated `scripts/launch-gate.mjs` prod runner that executes/records
  AC1–AC12 (D-06) plus a `scripts/cleanup-gate-rows.mjs` (D-05).
- The operator gate run against prod, evidence capture, `references/lighthouse-final.html`.
- The annotated `v1.0-consumer-landing` tag, pushed (D-07).
- Bounded in-phase fix-and-reverify for any small failing AC (D-01).

Out of scope (other phases own, or explicitly deferred):
- Any landing copy / structure / meta-tag change (Phase 6 locked) — the only
  landing edit is the D-02 color values.
- Any feature change to signup / manage / email / cron — all verified, not modified.
- A real test framework / Playwright (D-03 rejects it for v2.0).
- Outlook cross-client coverage (Phase 10 closed decision — Gmail+Proton standard).
- Layout.astro refactor (standing v1.1 deferral; do NOT bundle with the contrast commit).

</domain>

<decisions>
## Implementation Decisions

### Gate model & fix scope

- **D-01:** **Bounded fix-and-reverify.** Phase 11 is a verification + launch
  gate that MAY carry SMALL AC-closing fixes in-phase (atomic commit → redeploy
  via GitHub Actions → re-run the gate). "Small" = a change that is itself a
  single trivial task (a CSS color value, a one-line `preventDefault`, a
  copy/header nit). Any failure large enough to need its own plan or
  investigation → escalate to a separate `/gsd-quick` / fix phase, and Phase 11
  reports that AC **red** with its evidence. The phase boundary stays bounded:
  verify all 12, carry only small closing fixes. Re-running must be one command
  (see D-06) so the loop is cheap before the 2026-05-19 deadline.

- **D-02:** **Land the diagnosed a11y contrast fix proactively as the FIRST
  Phase-11 task**, before the gate run. In `src/pages/index.astro` inline
  `<style is:global>`: deepen the banner-pill accent `#d94a1f → #b8350d` and the
  submit-button accent `→ #c43d15` so both clear WCAG-AA ≥ 4.5:1 (Phase 6
  Lighthouse was A11y 94 with exactly these two serious contrast hits — banner
  3.6:1, button 4.24:1 — flagged as a Phase-11 follow-up). Rationale: removes a
  known redeploy+rerun round-trip and de-risks AC8 against prod Lighthouse
  run-to-run variance. This is a public-surface edit — must still pass LAND-02
  (color value only; it does). Color-only, one focused commit — do NOT bundle
  the Layout.astro refactor.

### AC3 browser-test tooling

- **D-03:** Drive AC3's 3-locale tz form-submission test with **puppeteer-core +
  chrome-headless-shell** (the proven Phase-6 pattern: `npx @puppeteer/browsers
  install chrome-headless-shell@stable` → `./chrome-headless-shell/` gitignored,
  `executablePath` for puppeteer-core, `CHROME_PATH` for lighthouse), **not
  Playwright**. Spoof timezone per locale (CDP `Emulation.setTimezoneOverride`
  and/or `TZ=` on the headless launch — whichever deterministically reproduces
  the Phase-6 sub-headline-label behavior). Locales: `America/Detroit`,
  `Europe/London`, `Africa/Lagos`; assert the persisted IANA tz + the rendered
  label ("Detroit time" / "London time" / "Lagos time"). **Documented
  deviation:** AC3 / MILESTONE literally say "Playwright"; we satisfy the AC's
  intent with the established repo pattern, zero new devDependency, and record
  the deviation in this CONTEXT + 11-SUMMARY.

### Prod test-data hygiene

- **D-04:** AC3 + AC4 prod submissions use recognizable **John's-Gmail `+tag`
  addresses** (Gmail strips `+tag` for delivery → all land in John's inbox, but
  each is a distinct DB row). Contract: `+tag` pattern, e.g.
  `johnturner+ac3-detroit@gmail.com`, `…+ac3-london@…`, `…+ac3-lagos@…`,
  `…+ac4@…` (planner pins exact local-parts; the `+tag` convention is the lock).
  Read-only ACs (AC1/2/6/7) and no-row-by-design ACs (AC9 bad-team, AC12
  honeypot) write nothing and need no hygiene.

- **D-05:** Post-gate cleanup via a committed **`scripts/cleanup-gate-rows.mjs`**
  — **dry-run by default** (prints the rows it WOULD delete), `--confirm` to
  execute, **idempotent** (re-run = no-op), `DELETE FROM vip_signups WHERE email
  LIKE` the `+tag` pattern. Matches the project's dry-run-by-default destructive-
  script convention (`launch-blast.mjs`, `send-kickoff-notifications.mjs`,
  `backup-pre-05.mjs`). It is an **operator action** run on the droplet against
  `DATABASE_PATH` (same operator mechanism as `backup-pre-05` / DEPLOY.md Day-2
  DB-inspection; deploy user's sudoers is systemctl-only). Cleanup runs **after
  the tag is cut** (D-07) so the verified rows still exist on the tagged state
  and through any re-verify; recorded as the final operator step in 11-SUMMARY.

### Verification mechanism

- **D-06:** One consolidated **`scripts/launch-gate.mjs`** runner, default
  target `https://oddlympics.app` (env override, mirrors smoke-* `SMOKE_BASE_URL`):
  - Automates the scriptable ACs: **AC1** (landing renders, "Your team's
    matches" present ≥ 1), **AC2** (parse rendered `<select>` → exactly 48
    options matching `references/teams.json`), **AC6** (`/og-image.png` 200,
    `image/png`, exactly 1200×630, < 300 KB), **AC7** (prohibited-terms grep
    across `/`, `/privacy`, `/terms`, `/manage` — extends `check:land-02` which
    today only greps `dist/client/index.html`), **AC9** (`team=fake_team` → 303
    `/?error=bad-form`, no row), **AC12** (honeypot `website` set → no row).
  - Drives **AC3** via the D-03 puppeteer-core path (3 locales).
  - Shells **AC8**: `lighthouse https://oddlympics.app --preset=mobile` via the
    chrome-headless-shell binary; writes the HTML report to **exactly
    `references/lighthouse-final.html`** (SC2 / done-definition #5 path — NOT
    under `.planning/`); asserts all four categories ≥ 90.
  - For operator-gated ACs (**AC4** full Gmail loop + < 60 s timing + unsubscribe,
    **AC10** backfilled-row banner + save, **AC11** Plausible dashboard event)
    and **opengraph.xyz** preview (done-definition #4): emits a clear
    operator-action prompt and captures the pasted/linked evidence (screenshot
    path / dashboard URL) into the report.
  - Emits a single **per-AC PASS/FAIL table** and writes artifacts under
    `.planning/phases/11-end-to-end-launch-gate/evidence/` (mirrors the Phase-10
    evidence/ + SUMMARY-table pattern). Re-runnable as one command — this is
    what makes the D-01 loop cheap. npm alias matches existing `smoke:*` /
    `og:render` naming (planner pins exact alias).

### Release tag

- **D-07:** Final gate step, **only after all 12 ACs are green** and evidence
  captured, and **before** the D-05 cleanup delete:
  `git tag -a v1.0-consumer-landing <commit>` where `<commit>` is the `main`
  commit whose GitHub Actions **Deploy** run is green and which the gate
  verified; annotated message names the milestone (v2.0 Consumer Landing &
  Signup Flow) + "AC1–AC12 verified passing on production"; then
  `git push origin v1.0-consumer-landing`. The string is **exactly
  `v1.0-consumer-landing`** — the v2.0 *milestone label* and the
  `v1.0-consumer-landing` *tag name* are deliberately different per
  ROADMAP/MILESTONE done-definition. **Do NOT "fix" the tag to v2.0.** No tags
  currently exist in the repo.

### Claude's Discretion

- Exact npm script alias for the gate runner (`gate` / `launch:gate` /
  `smoke:gate`) — match the existing colon/kebab convention.
- Exact `+tag` local-parts for the D-04 test emails (the `+tag` contract is the
  lock; suffixes are flexible).
- Whether `launch-gate.mjs` is one self-contained file or a thin orchestrator
  that shells the existing `smoke-landing` / `smoke-signup` / `smoke-manage`
  scripts internally for the ACs they already cover — reuse vs. reimplement is
  the planner's call **as long as the single per-AC verdict + single re-run
  command (D-06) holds**.
- Plan/wave split (e.g. contrast-fix → gate-runner build → operator gate run +
  evidence → tag → cleanup) — operator-action vs. code tasks split naturally.
- The AC3 tz-spoof technique detail (CDP override vs. `TZ=` launch).
- Whether AC11 needs the Phase-6-noted `preventDefault + setTimeout(form.submit,0)`
  swap — apply ONLY if the live Plausible dashboard shows an unacceptable drop
  rate; this is exactly a D-01 "small in-phase fix".
- **Open implementation question for researcher/planner (not a user decision):**
  AC3 asserts the *persisted* IANA tz. Off-box verification needs either a
  prod-DB read (operator, on droplet) or an indirect assertion (sign in to
  `/manage` for the test email and read back the saved tz, or trust the
  sub-headline label + the confirmation-email tzLabel). Pin AC3's
  persistence-assertion path at plan time. AC9/AC12 "no row" is adequately
  asserted via the 303 redirect contract alone (no DB read needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth requirements (the checklist Phase 11 executes)
- `.planning/REQUIREMENTS.md` §"Acceptance criteria (milestone-level)" — the
  AC1–AC12 table + per-AC "Verified in" column. **The binding checklist.**
- `MILESTONE-consumer-landing.md` §"Acceptance criteria (UAT)" — AC1–AC12 in
  full prose with exact verification commands (curl strings, dimensions) +
  §"Done definition" (5 conditions: all AC pass; tag; real Gmail signup < 60 s;
  opengraph.xyz preview; `references/lighthouse-final.html` all ≥ 90).
- `.planning/ROADMAP.md` §"Phase 11: End-to-end + launch gate" — goal + 4
  Success Criteria (SC1 per-AC evidence on prod; SC2 `references/lighthouse-final.html`
  all ≥ 90; SC3 John's-Gmail loop < 60 s + unsubscribe; SC4 tag on deploy commit).
- `.planning/REQUIREMENTS.md` §"Landing page" → **LAND-02** — the prohibited-
  terms list AC7 enforces (`bitcoin|lightning|crypto|world domination|personal
  olympics`, case-insensitive); also binds the D-02 contrast edit.

### Prior-phase decisions (LOCKED — do not relitigate)
- `.planning/phases/10-confirmation-email-update/10-SUMMARY.md` §"Hand-off to
  Phase 11", §"Cross-Client Evidence", §"Deviations" — AC4 baseline (10/10
  Mail-Tester, Gmail/Proton render proof from prod sender `hello@oddlympics.app`);
  Outlook out of scope for v2.0; custom domain is live prod state. Phase 11's
  live AC4 = the John's-Gmail full loop per ROADMAP SC3.
- `.planning/phases/06-landing-page-form-meta-analytics/06-CONTEXT.md` — landing
  page locked (hardcoded `https://oddlympics.app` meta URLs D-08; empty-host
  DOM contract; ASCII-apostrophe convention). Phase 11's ONLY landing edit is
  the D-02 contrast color values.
- `.planning/STATE.md` §"Accumulated Context › Decisions" — Phase-6 Lighthouse
  result (Perf 100 / A11y 94 / BP 100 / SEO 100; banner 3.6:1 + button 4.24:1
  serious WCAG-AA hits; fix `#d94a1f→#b8350d` / button `#c43d15`) AND the
  Phase-6 Plan-2 fire-and-forget Plausible-listener note ("Phase 11 AC11
  verifies dashboard side; if drop rate unacceptable, swap to preventDefault +
  setTimeout") AND the Phase-6 Plan-3 chrome-headless-shell setup
  (`npx @puppeteer/browsers install chrome-headless-shell@stable` →
  `./chrome-headless-shell/` gitignored; `CHROME_PATH` / `executablePath`).

### Project context
- `.planning/PROJECT.md` §"Key Decisions" — v2.0 consumer pivot,
  custom-domain-live, the deliberate v2.0-milestone / `v1.0-consumer-landing`-tag
  naming split (binds D-07; do not "fix").
- `CLAUDE.md` §"Dry-run-by-default safety pattern for outbound side effects",
  §"Background work via systemd timers", §"Production" — D-05 cleanup inherits
  the dry-run-by-default + idempotent convention + the operator/SSH/oddlympics-
  writable-DB mechanism.
- `CLAUDE.md` §"Common commands" / "There is no formal test suite" — smoke-via-
  built-server convention; D-06 extends it (prod-targeted, single verdict, no
  framework).

### Existing code/scripts (READ before implementing)
- `scripts/smoke-landing.mjs`, `scripts/smoke-signup.mjs`,
  `scripts/smoke-manage.mjs`, `scripts/smoke-confirm-email.mjs` — existing
  per-area smokes; `SMOKE_BASE_URL` / `DATABASE_PATH` override convention;
  partial AC coverage D-06 may shell or mirror.
- `package.json` §scripts — `smoke:confirm/landing/manage`, `check:land-02`
  (only greps `dist/client/index.html` — AC7 must extend to `/privacy` `/terms`
  `/manage` on prod), `og:render` — alias-naming convention.
- `scripts/backup-pre-05.mjs`, `scripts/launch-blast.mjs`,
  `scripts/send-kickoff-notifications.mjs` — the dry-run-by-default /
  `--confirm`-or-`--send` / idempotent destructive-script shape `cleanup-gate-rows.mjs`
  mirrors.
- `src/pages/index.astro` inline `<style is:global>` — D-02 color values live
  here (banner pill + submit button accent); read Phase-6 ASCII/structure
  constraints first.
- `.github/workflows/deploy.yml` — push-to-main → rsync + `npm rebuild
  better-sqlite3` + `systemctl restart oddlympics` + 5×curl-200 (~47 s). D-01
  redeploy + D-07 "green-deploy commit" reference this.
- `references/teams.json` — 48-team canonical list AC2 asserts against.
- `.planning/phases/10-confirmation-email-update/evidence/` — the evidence-dir +
  SUMMARY-table packaging Phase 11 mirrors.

### Codebase patterns (downstream MUST match)
- `.planning/codebase/TESTING.md` — "smoke via built server + curl/fetch" is the
  ONLY testing precedent; no framework. D-06 stays in this grain (a script).
- `.planning/codebase/CONVENTIONS.md` — ESM, `node:` prefix, strict TS,
  why-only comments, dry-run-by-default for side effects.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **chrome-headless-shell + puppeteer-core** (Phase 6) — drives AC3 (tz-spoof
  DOM submit) and AC8 (`lighthouse --preset=mobile`) with zero new deps.
- **4 existing smoke scripts** — AC1/AC2/AC7 (landing), AC9/AC12 (signup), AC10
  surface (manage) are substantially already implemented; the gate runner can
  shell them rather than reimplement.
- **`backup-pre-05.mjs` / `launch-blast.mjs` scaffold** — copy the dry-run /
  `--confirm` / idempotent shape for `cleanup-gate-rows.mjs`.
- **GitHub Actions deploy (~47 s)** — the D-01 redeploy mechanism; its green run
  defines the D-07 tag commit.
- **Phase-10 `evidence/` + SUMMARY-table pattern** — Phase-11 evidence packaging.

### Established Patterns
- **Dry-run-by-default** for any destructive/outbound script (D-05 inherits).
- **`SMOKE_BASE_URL` / `DATABASE_PATH` env override** on smokes (D-06 inherits,
  default flips to prod).
- **Operator-action vs. autonomous split** — Phase-10 Wave-3 precedent: deploy +
  external verification is an operator step. AC4/AC8/AC10/AC11 + cleanup + tag
  are operator steps; D-06 prompts for them and captures evidence.
- **LAND-02 grep on every public-surface change** — the D-02 contrast edit must
  pass it (color value only — it does).

### Integration Points
- `launch-gate.mjs` → prod `https://oddlympics.app` (HTTP) + redirect-contract
  assertions (AC9/AC12 "no row" — no DB read) + AC3 persistence assertion (path
  pinned at plan time — see Claude's Discretion open question).
- `launch-gate.mjs` → chrome-headless-shell (AC3 DOM+tz, AC8 lighthouse).
- `cleanup-gate-rows.mjs` → prod DB (operator, droplet, `DATABASE_PATH`) — after
  the tag.
- `git tag` → `origin` (D-07) — outward-facing, last code step.
- Plausible dashboard (AC11), opengraph.xyz (AC6 preview / done-def #4), Gmail
  (AC4) — external, operator-verified with captured evidence.

</code_context>

<specifics>
## Specific Ideas

- AC1 grep token: `"Your team's matches"` (count ≥ 1).
- AC7 surfaces: `/`, `/privacy`, `/terms`, `/manage`; terms (case-insensitive):
  `bitcoin|lightning|crypto|world domination|personal olympics`.
- AC8 artifact path is exactly `references/lighthouse-final.html` (SC2 /
  done-def #5 — NOT under `.planning/`).
- AC6: `/og-image.png` 200, `content-type: image/png`, exactly 1200×630,
  < 300 KB; plus opengraph.xyz preview (done-def #4) shows headline/banner/URL.
- D-02 colors: banner pill `#d94a1f → #b8350d`; submit button `→ #c43d15`
  (target WCAG-AA ≥ 4.5:1).
- Tag string EXACTLY `v1.0-consumer-landing` (annotated, pushed, on green-deploy
  commit; do NOT rename to v2.0 — deliberate per ROADMAP/MILESTONE).
- D-04 test-email `+tag` contract (Gmail `+tag` → John's inbox, distinct rows).

</specifics>

<deferred>
## Deferred Ideas

- **Playwright / a real test framework** — explicitly rejected for v2.0 (D-03).
  Revisit post-launch if cross-browser / visual-regression needs a real harness
  (`.planning/codebase/TESTING.md` Option A `node --test` / Option B Vitest).
- **Outlook cross-client coverage** — out of scope for v2.0 (Phase 10 closed
  decision). Revisit only on a real Outlook-user complaint.
- **AC1 "visual diff vs. `references/landing_preview.png` within tolerance"** —
  MILESTONE-only, tolerance-based; the *binding* AC1 (REQUIREMENTS.md) is just
  the "Your team's matches" grep + render. STATE flags reference image assets as
  possibly missing. Planner: treat grep+render as the hard AC1 gate; the visual
  diff is best-effort if the reference image exists in-repo, else documented
  N/A — do NOT block launch on a missing reference asset.
- **Automated Plausible / opengraph.xyz polling** — no worthwhile API for a
  one-shot gate; manual operator evidence (Phase-10 D-08/D-09 precedent).
- **Layout.astro refactor** — standing v1.1 deferral. Phase 11 touches
  `index.astro` for the D-02 contrast fix — keep that ONE focused color-only
  commit; do NOT bundle the refactor.

None — discussion stayed within phase scope (all decisions are about HOW to run
the launch gate).

</deferred>

---

*Phase: 11-end-to-end-launch-gate*
*Context gathered: 2026-05-15*
