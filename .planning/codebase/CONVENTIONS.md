# Conventions

**Last mapped:** 2026-05-08

## TypeScript

- **Strict mode** — `tsconfig.json` extends `astro/tsconfigs/strict` (no other overrides).
- **`type` over `interface`** for shape types (`type VipSignup`, `type Payload`).
  No `interface` declarations exist anywhere in `src/`.
- **`node:` prefix on all built-ins:** `node:crypto`, `node:fs`, `node:path`
  (`src/lib/token.ts:1`, `src/lib/db.ts:2-3`).
- **Prepared-statement generics:** `db.prepare<[string, string, string | null, string | null]>(...)`
  (`src/lib/db.ts:38-40`) — the param tuple is typed inline.
- **Return-type annotations** on exported functions (`mintToken(...): string`,
  `verifyToken(...): { email: string } | null`, `sendMagicLink(...): Promise<void>`).
  No untyped returns.
- **No `any`.** Casts go through `as` only at FormData boundaries
  (`((form.get('email') as string) ?? '').trim()`, `src/pages/api/signup.ts:61`).

## Naming

- `camelCase` functions and locals
- `SCREAMING_SNAKE_CASE` module constants
- `PascalCase` types
- `kebab-case` files (multi-word) and URL slugs
- See STRUCTURE.md for the full list with examples

## Error handling — three patterns

**Pattern 1: API route → 303 redirect with error slug.**
The route never throws to the framework. Every failure mode returns a `Response`
with status 303 and a `?error=<slug>` query param.

```ts
function back(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/?error=${encodeURIComponent(message)}` },
  });
}
```

`src/pages/api/signup.ts:36-41`. Used for `bad-origin`, `bad-form`, `bad-email`,
`rate-limited`, `email`, `server`. Confirm route does the same with
`/confirmed?status=<slug>` (`src/pages/api/confirm.ts:23-25`). Slugs are
short, lowercase, kebab-case.

**Pattern 2: Lib function → null on failure.**
`verifyToken` returns `{ email } | null` rather than throwing. The caller
treats `null` as "redirect to error page" (`src/pages/api/confirm.ts:12`).
`src/lib/token.ts:36-55` shows the pattern: every parse/length/expiry check
is an early `return null`.

**Pattern 3: Module-load throw on missing prod config.**
Required env vars throw at module init, not at first request. This makes the
service fail fast on `systemctl restart` rather than at the first failing user
request.

```ts
if (!API_KEY && isProd) {
  throw new Error('RESEND_API_KEY is required in production');
}
```

`src/lib/email.ts:8-10`, `src/lib/token.ts:6-8`. The dev path uses a
fallback (console log for email, hardcoded insecure secret for token signing).

## Logging

- **`console.error` for caught DB / email failures** in route handlers, with a
  `[scope]` prefix: `console.error('[signup] db error', err)`,
  `console.error('[signup] email error', err)` (`src/pages/api/signup.ts:81,90`).
- **`console.log` for the dev email fallback** with a tag: `[email-dev-fallback]`
  (`src/lib/email.ts:45`).
- **No structured logger** (no pino, no winston). systemd captures stdout/stderr
  to journald; tail with `journalctl -u oddlympics -f` (`DEPLOY.md:105`).
- No correlation IDs, no request IDs.

## CSS

- **Inline `<style is:global>` per page**, not a shared stylesheet. CLAUDE.md
  rationale: "Three pages doesn't justify the abstraction. Refactor to a
  shared layout when a 4th page lands." See `src/pages/index.astro:84-236`.
- **CSS variables defined in `:root`** of each page. The shared set:

  ```css
  --bg: #0b0b0e;
  --fg: #ececf1;
  --fg-dim: #b8b8c2;
  --accent: hsl(18 70% 56%);
  --pad: 48px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  ```

- **One mono font everywhere.** `--mono` is the only family used; no separate
  display/body font.
- **Mobile breakpoint at 520px** with a single `@media` block per page.
- **Reduced motion respected** in `index.astro:233-235`.

## Astro patterns

- `export const prerender = true;` for static pages, `false` for API routes.
  This is a project-wide convention with no exceptions.
- Frontmatter (`---` block) is for *build-time* values (titles, descriptions,
  static content). For request-time URL params on a prerendered page, use a
  `<script is:inline>` that reads `new URL(location.href).searchParams.get(...)`
  with a `try { ... } catch {}` wrapper.
- API route signatures: `export const POST: APIRoute = async ({ request, site }) => {...}`
  and `export const GET: APIRoute = async ({ url }) => {...}`. Always destructure
  what you need from the context arg.

## Form handling

- **`<form method="post" action="/api/signup">`** — old-school HTML POST, no
  fetch/AJAX, no JSON. Server returns 303 redirect; browser follows.
- **Honeypot field** named `website` with class `.hp` (visually hidden,
  `tabindex="-1"`, `aria-hidden="true"`). If filled → silent fake-success
  (`src/pages/api/signup.ts:55-59`).
- **Email validation:** regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` plus a 254-char
  length cap (`src/pages/api/signup.ts:9, 64`).
- **Allowlists** for enum-like fields: `VALID_SPORTS = new Set([...])`,
  unknown values coerce to `'other'` (`src/pages/api/signup.ts:10, 67`).

## Security posture (in code)

- **Constant-time comparison** for HMAC signatures: `timingSafeEqual` after
  length check (`src/lib/token.ts:42-44`).
- **Input always lowercased + trimmed** before hashing/storing
  (`src/pages/api/signup.ts:61`).
- **DB writes parameterized** via prepared statements — no string interpolation.
- **Origin check on POST** (`src/pages/api/signup.ts:18-34`) layered on top of
  Caddy's edge security headers.
- **Magic links idempotent** via `WHERE confirmed_at IS NULL` clause in the
  UPDATE — safe to click twice.

## What you won't see in this codebase

- No comments explaining what code does — only why-comments where the choice
  is non-obvious (e.g. `src/pages/api/signup.ts:55` "Honeypot: bots fill this;
  humans don't see it.", `astro.config.mjs:8-10` why CSRF is off).
- No JSDoc.
- No barrel `index.ts` exports — every import names its file directly:
  `import { upsertVipSignup } from '../../lib/db';`.
- No `default export` in lib modules — only named exports.
- No async wrappers around sync code.
- No try/catch around things that can't reasonably throw.
