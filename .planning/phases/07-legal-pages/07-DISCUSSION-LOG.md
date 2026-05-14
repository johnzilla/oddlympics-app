# Phase 7: Legal pages - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 7-legal-pages
**Areas discussed:** Markdown rendering pipeline, Last-updated date strategy, Page chrome / structure, CSS shell scope

---

## Markdown rendering pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-author in `.astro` | Extract `privacy.md` + `terms.md` as the editorial source-of-truth, hand-translate into Astro pages as HTML. Mirrors Phase 6 D-02 precedent. No new build deps. | ✓ |
| Build-time `.md` import | Astro Content Collections or remark transform; render `references/*.md` at build time. Adds frontmatter wiring + body CSS scoping work. | |
| Co-located markdown in `src/pages` | Move canonical `.md` into `src/pages/`; Astro renders `.md` files as routes natively. Loses `references/` convention. | |

**User's choice:** Hand-author in `.astro`.
**Notes:** Phase 6 D-02 precedent confirms hand-translation from `references/*.md` is the project pattern. Pages are ~350 total words — overhead of a markdown pipeline isn't justified.

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-plan docs sweep | Single commit before `/gsd-plan-phase 7`: extract stubs from copy doc, fill ESP → "Resend", commit `docs(07): extract legal stubs to references/{privacy,terms}.md`. Mirrors Phase 6 D-01. | ✓ |
| First Phase 7 plan task | Plan 07-01 = extract + gap-fill; Plan 07-02 = author the pages. Mixes editorial and code work. | |
| Inline in copy doc (no extraction) | Skip standalone files; reference stubs by anchor. Contradicts roadmap's explicit "lives at `references/{privacy,terms}.md`". | |

**User's choice:** Pre-plan docs sweep.
**Notes:** Roadmap explicitly says copy lives at standalone files; sweep keeps editorial work isolated from plan execution.

---

## Last-updated date strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded const, manual bump | `LAST_UPDATED = '2026-05-13'` per page; bump only on content change (not on every deploy). Single source per page. | ✓ |
| Git commit date injected at build | `git log -1 --format=%cs references/privacy.md` at build, rendered into page. Auto-current but couples deploy timing to date display. | |
| Both shown explicitly | Two lines: content-edit date + deploy date. Visually noisier than legal-doc convention. | |

**User's choice:** Hardcoded const, manual bump.
**Notes:** Legal-doc convention is content-edit date, not deploy date. LEGAL-01/02's literal "matches deploy date" is satisfied at first ship (where they coincide). Avoiding spurious updates on cosmetic deploys is the better legal posture.

| Option | Description | Selected |
|--------|-------------|----------|
| ISO long form `May 13, 2026` | Matches the copy doc's existing `**Last updated: May 12, 2026**`. Unambiguous for US + international readers. | ✓ |
| ISO `2026-05-13` | Sortable, matches STATE.md / git-log style. More technical-looking on a consumer legal page. | |
| Long form with zone `May 13, 2026 (US Eastern)` | Adds zone disambiguation. Over-specified for "last updated". | |

**User's choice:** ISO long form `May 13, 2026`.
**Notes:** Stays consistent with copy doc voice.

---

## Page chrome / structure

| Option | Description | Selected |
|--------|-------------|----------|
| Footer-only, match landing | No header bar. Page starts with `<h1>`. Footer (Manage / Privacy / Terms / Contact) is the only nav. | ✓ |
| Minimal header with wordmark back-link | Top-left `oddlympics` wordmark `<a>` linking home. ~15 lines extra CSS + header element. | |
| Inline "Back to home" link | Single `← Back to oddlympics.app` link above h1 or below footer. Lighter than full header. | |

**User's choice:** Footer-only, match landing.
**Notes:** Paid-ad reviewers expect simple legal pages; the footer's sibling links + browser back-button cover return navigation.

| Option | Description | Selected |
|--------|-------------|----------|
| `mailto:` with `<code>` styling | `<a href="mailto:..."><code>...</code></a>`. Clickable + monospace cue. Matches footer's existing `Contact` mailto. | ✓ |
| Plain `mailto:` link | Regular page font; underline-on-link signals actionability. | |
| Plain text (no link) | Literal string. Harms UX for GDPR/CCPA email workflow. | |

**User's choice:** `mailto:` with `<code>` styling.
**Notes:** Consistent with project's existing footer Contact link pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Match landing 720px | Reuse `--max: 720px` from `index.astro`. Consistent across site. | ✓ |
| Narrower 640px for prose | Tighter measure for long-line readability; introduces a new token or override. | |
| Same 720px but introduce `--max-prose` token | Same value today; namespaced for future divergence. Premature abstraction. | |

**User's choice:** Match landing 720px.
**Notes:** Visual consistency outweighs marginal readability gain on short legal copy.

---

## CSS shell scope

| Option | Description | Selected |
|--------|-------------|----------|
| Trimmed shell | Copy only: `:root` tokens, resets, html/body, `.wrap`, `.site-footer`, typography (h1/h2/p/ul/a), `prefers-reduced-motion`. Drop form/select/banner/FAQ rules. ~80–120 lines. | ✓ |
| Full paste (literal) | Copy the entire `<style is:global>` verbatim. Zero divergence risk; ~250 lines of dead CSS per page. | |
| Build a shared partial via Astro slot | Effectively the Layout.astro refactor — CLAUDE.md says deferred to v1.1. | |

**User's choice:** Trimmed shell.
**Notes:** Cleaner code review surface; legal pages have no form/banner/FAQ so the dead CSS is real.

| Option | Description | Selected |
|--------|-------------|----------|
| Inherit landing values | Same 520px breakpoint, same h1/h2 type scale, same tokens. | ✓ |
| Tune for prose | Slightly smaller h1, tighter line-height. | |

**User's choice:** Inherit landing values.
**Notes:** Visual consistency landing ↔ privacy ↔ terms matters more than a prose-tuned variant.

---

## Claude's Discretion

- Whether `LAST_UPDATED` stays ISO with a formatter helper or pre-formatted as the display string.
- `<h2>` vs `<strong>` rendering for the copy doc's bold-label sections (`**What we collect:**`, etc.). Pick one and apply consistently.
- `<h2>` + `<ul>` vs `<dl>` for the "What we collect / don't / never do" groups.
- Whether to add a `<noscript>` block (almost certainly no).
- Minor punctuation/whitespace normalization during the docs-sweep extraction beyond the ESP gap-fill.
- Whether to extract a shared `formatDate()` utility (almost certainly no — duplication is cleaner at this scale).

## Deferred Ideas

- Shared `Layout.astro` extraction (deferred to v1.1 per CLAUDE.md).
- Build-time markdown rendering (revisit at >5 content pages or when non-engineers contribute copy).
- Git-commit-date injection for "Last updated" (revisit only on real audit need).
- Top header / wordmark back-link (revisit on paid-ad reviewer feedback).
- Prose-tuned measure 640px (revisit only if readability complaints surface).
- Live link to Resend's privacy policy (external dependency surface).
- Cookie banner (not needed — cookie-free site).
