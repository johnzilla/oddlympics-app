# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repository is currently a blank slate: only `README.md` (a single-line title), `LICENSE` (MIT), and the initial commit exist. There is no source code, build system, test suite, or architecture to document yet.

When the first feature work begins, update this file with:
- The build/lint/test commands once a toolchain is chosen.
- The high-level architecture once enough code exists that it spans multiple files.
- Any conventions established in early commits that future contributors should follow.

Until then, treat decisions about language, framework, and project layout as open — confirm direction with the user before scaffolding.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
