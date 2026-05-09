# Phase 1: Pre-launch Hardening — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 11 (4 new, 7 modified)
**Analogs found:** 11 / 11 — every file has a strong in-tree analog (CONTEXT.md called them out by file:line)

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `src/pages/api/unsubscribe.ts` | new | api-route (GET handler) | request-response (token-verify → DB UPDATE → 303) | `src/pages/api/confirm.ts` | exact (same shape: token verify, conditional UPDATE, 303 to status page) |
| `src/pages/unsubscribed.astro` | new | static-page (status page) | request-response, URL-param hydration | `src/pages/confirmed.astro` (post-fix shape) + `src/pages/pending.astro` | exact (4th status page in the same family) |
| `deploy/oddlympics-backup.service` | new | systemd-unit (oneshot) | batch (rclone → B2) | `deploy/oddlympics.service` | role-match (different Type=, no ExecStart server, but same User/Group/Hardening shape) |
| `deploy/oddlympics-backup.timer` | new | systemd-timer | event-driven (calendar) | (no in-tree timer) — pair with the new `.service` above | no analog (timer is a new artifact type for this repo) |
| `src/pages/confirmed.astro` | modified | static-page | request-response, URL-param hydration | `src/pages/index.astro:61-78` + `src/pages/pending.astro:28-35` | exact (the canonical inline-script pattern is documented in CONTEXT.md as the literal fix) |
| `src/lib/token.ts` | modified | utility (HMAC token mint/verify) | transform (data → signed string → data) | self (in-place change to TTL constant + `Payload` type extension) | self (extend, don't replace) |
| `src/lib/email.ts` | modified | service-wrapper (Resend send) | request-response (HTTPS to Resend) | self (extend `sendMagicLink` to inject `List-Unsubscribe` headers; possibly add a sibling sender) | self |
| `src/lib/db.ts` | modified | data-access | CRUD + on-import migration | self (existing `CREATE TABLE IF NOT EXISTS` block at lines 15-26 — add an `ALTER TABLE … ADD COLUMN IF NOT EXISTS unsubscribed_at`) | self |
| `src/pages/api/signup.ts` | modified | api-route (POST handler) | request-response | self (single-line flip in `originOk` at line 22) | self |
| `deploy/Caddyfile` | modified | reverse-proxy config | request-response (header injection) | self (existing `header { … }` block at lines 24-32) | self (add `Content-Security-Policy[-Report-Only]` line) |
| `DEPLOY.md` | modified | docs | n/a | self (existing Day 2 table at lines 99-122) | self (add restore runbook section) |

## Pattern Assignments

### `src/pages/api/unsubscribe.ts` — new (api-route, request-response)

**Analog:** `src/pages/api/confirm.ts` (entire file, 26 lines).

**Imports + frontmatter pattern** (`src/pages/api/confirm.ts:1-5`):
```ts
import type { APIRoute } from 'astro';
import { verifyToken } from '../../lib/token';
import { markConfirmed, getByEmail } from '../../lib/db';

export const prerender = false;
```
Apply directly: replace `markConfirmed, getByEmail` with a new `markUnsubscribed` prepared statement (added in `src/lib/db.ts`). Token verify call shape is identical but with a `purpose: 'unsubscribe'` claim check (see token.ts pattern below).

**Core handler shape** (`src/pages/api/confirm.ts:7-21`):
```ts
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) return redirect('/confirmed?status=bad-token');

  const result = verifyToken(token);
  if (!result) return redirect('/confirmed?status=bad-token');

  const updated = markConfirmed.get(result.email);
  if (updated) return redirect('/confirmed?status=ok');

  // Already confirmed (or never signed up). Idempotent: still send to confirmed.
  const existing = getByEmail.get(result.email);
  if (existing) return redirect('/confirmed?status=already');
  return redirect('/confirmed?status=unknown');
};
```
**Adaptation for unsubscribe:**
- All redirect targets become `/unsubscribed?status=...` (CONTEXT.md D-09).
- `verifyToken(token, { purpose: 'unsubscribe' })` (signature extension TBD by planner).
- `markUnsubscribed.get(email)` — new prepared statement using the same conditional-UPDATE shape as `markConfirmed` (`WHERE email = ? AND unsubscribed_at IS NULL`).
- The `getByEmail.get()` already-unsubscribed branch maps to `/unsubscribed?status=already`.

**Local redirect helper** (`src/pages/api/confirm.ts:23-25`):
```ts
function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}
```
Copy verbatim. Same pattern, file-local helper, no shared utility.

---

### `src/pages/unsubscribed.astro` — new (static-page, URL-param hydration)

**Analog (structure):** `src/pages/pending.astro` (entire 64-line file is the smaller, more apt template than `confirmed.astro`).
**Analog (URL-param read):** `src/pages/index.astro:61-78` (status-keyed COPY map) — apply this for `?status=ok|already|bad-token`.

**Frontmatter pattern** (`src/pages/pending.astro:1-3`):
```astro
---
export const prerender = true;
---
```
Keep `prerender = true`. Per CONTEXT.md D-21 and ARCHITECTURE.md "Critical abstraction" section, do NOT read `Astro.url.searchParams` in the frontmatter — that's the bug HARDEN-01 is fixing on `confirmed.astro`.

**Head + analytics block** (`src/pages/pending.astro:5-18`):
```astro
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>Check your email — oddlympics</title>
  <!-- Privacy-friendly analytics by Plausible -->
  <script async src="https://plausible.io/js/pa-wRAab3seDWDDBnGbRbe0K.js"></script>
  <script is:inline>
    window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
    plausible.init()
  </script>
</head>
```
Copy verbatim, swap title to "Unsubscribed — oddlympics" or similar. `noindex` is correct for a status page.

**Inline-script status reader** — combine `pending.astro:28-35` (URL param read) with `index.astro:63-77` (COPY map keyed by code):
```astro
<!-- Skeleton with placeholders the script swaps at runtime -->
<span id="banner" class="banner"></span>
<h1 id="headline" class="headline"></h1>
<p id="sub" class="subhead"></p>

<script is:inline>
  try {
    const COPY = {
      ok: { banner: 'Unsubscribed', headline: '…', sub: '…' },
      already: { banner: 'Already unsubscribed', headline: '…', sub: '…' },
      'bad-token': { banner: 'Link expired', headline: '…', sub: '…' },
    };
    const status = new URL(location.href).searchParams.get('status') || 'ok';
    const c = COPY[status] || COPY.ok;
    document.getElementById('banner').textContent = c.banner;
    document.getElementById('headline').textContent = c.headline;
    document.getElementById('sub').textContent = c.sub;
  } catch {}
</script>
```
This is the literal `confirmed.astro`-after-fix pattern. Same rule applies to the `confirmed.astro` modification.

**`<style is:global>` block** (`src/pages/pending.astro:44-63`):
```astro
<style is:global>
  :root {
    --bg: #0b0b0e;
    --fg: #ececf1;
    --fg-dim: #b8b8c2;
    --accent: hsl(18 70% 56%);
    --pad: 48px;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--mono); -webkit-font-smoothing: antialiased; }
  body { min-height: 100dvh; }
  .hero { min-height: 100dvh; display: flex; align-items: center; padding: var(--pad); }
  .hero-content { max-width: 720px; }
  .banner { display: inline-block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: var(--accent); border: 1px solid var(--accent); padding: 5px 10px; border-radius: 999px; margin-bottom: 18px; }
  .headline { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; margin: 0 0 14px; }
  .subhead { font-size: 14px; line-height: 1.55; color: var(--fg-dim); margin: 0; max-width: 540px; }
  .link { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
  @media (max-width: 520px) { :root { --pad: 28px; } .headline { font-size: 30px; } }
</style>
```
Copy verbatim. CONTEXT.md D-09 / "Established Patterns" explicitly says **do not** introduce a shared layout in this phase (CLAUDE.md "4th page lands" trigger does technically hit, but a security-hardening phase isn't the right time per CONTEXT.md `<deferred>`).

---

### `src/pages/confirmed.astro` — modified (HARDEN-01 fix)

**Analog:** `src/pages/index.astro:61-78` (status-keyed COPY map + URL-param read) and `src/pages/pending.astro:28-35` (single-element URL-param read).

**Bug** (`src/pages/confirmed.astro:1-29`): the entire frontmatter `const status = Astro.url.searchParams.get('status') ?? 'ok'` and the `COPY[status]` lookup happen at build time. Result: build bakes `?status=ok` and the four `?status=…` redirect targets all render the same "Confirmed" page.

**Fix pattern (paste from `index.astro:61-78`):**
```astro
<script is:inline>
  try {
    const COPY = {
      'bad-email': 'That email looks off — try again.',
      'bad-form': 'Something went wrong with the form. Try again.',
      'bad-origin': 'Submission blocked. Please use the form on this page.',
      'rate-limited': 'Too many tries. Wait an hour and try again.',
      email: "We couldn't send the confirmation email. Try again in a minute.",
      server: 'Server hiccup. Try again in a minute.',
    };
    const code = new URL(location.href).searchParams.get('error');
    if (code) {
      const el = document.getElementById('error');
      el.textContent = COPY[code] || 'Something went wrong.';
      el.hidden = false;
    }
  } catch {}
</script>
```

**Adaptation for confirmed.astro:**
- The existing `COPY` object (currently in frontmatter at lines 5-26 of `confirmed.astro`) moves verbatim into the `<script is:inline>` body (drop the TS `Record<…>` type — it's a JS object literal in the script).
- Read `searchParams.get('status')`, default to `'ok'`.
- Three placeholder elements (`#banner`, `#headline`, `#sub`) replace the templated `{c.banner}`, `{c.headline}`, `{c.sub}`.
- **Per D-03:** the `bad-token` branch's `sub` copy must be updated to mention the new 24h TTL (was 7 days at line 19) AND should include the "Re-send confirmation →" CTA back to `/`. Add a new `add-cta` flag in COPY entries or hardcode the link in HTML and toggle visibility.
- Keep `prerender = true`. Keep the existing `<style is:global>` block (lines 59-78) as-is.
- Keep the Plausible block (lines 38-43) as-is.

---

### `src/lib/token.ts` — modified (HARDEN-06 + HARDEN-02 token purpose claim)

**Analog:** self (this is a focused extension of the existing 56-line file).

**TTL change (D-02)** — line 4:
```ts
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
```
becomes:
```ts
const TTL_SECONDS = 60 * 60 * 24; // 24 hours
```
Update the comment too. Per D-04, no proactive invalidation — `verifyToken` checks the embedded `exp` so already-minted 7-day tokens age out naturally.

**Existing `Payload` type** (lines 12-15):
```ts
type Payload = {
  email: string;
  exp: number;
};
```
**Extension for D-06 (purpose claim):**
```ts
type Payload = {
  email: string;
  exp: number;
  purpose?: 'confirm' | 'unsubscribe';
};
```
Default-undefined keeps backward compatibility with any in-flight 7-day tokens that have no `purpose` field (treat undefined as `'confirm'`).

**Existing `mintToken` signature** (lines 30-34):
```ts
export function mintToken(email: string): string {
  const payload: Payload = { email, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}
```
**Extension:** add an optional second arg `purpose?: 'confirm' | 'unsubscribe'`. When supplied, embed in payload. Keep the no-arg call site (`signup.ts:85`) working without a code change there. Planner picks the exact signature shape — options:
- `mintToken(email, purpose?)` — minimal change.
- `mintToken(email, opts?: { purpose?: '…'; ttlSeconds?: number })` — slightly more flexible if unsubscribe wants a longer TTL than confirm.

**Existing `verifyToken`** (lines 36-55):
```ts
export function verifyToken(token: string): { email: string } | null {
  // …HMAC verify, JSON parse, exp check…
  return { email: payload.email };
}
```
**Extension:** accept an optional expected purpose; reject if payload.purpose is set and doesn't match. Mirror signature: `verifyToken(token, expectedPurpose?: 'confirm' | 'unsubscribe')`.

**Critical pattern to preserve:** `timingSafeEqual` after length-checking the buffers (lines 41-44):
```ts
const expected = sign(body);
const a = Buffer.from(sig);
const b = Buffer.from(expected);
if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
```
Do not regress to `===`. CONCERNS.md flags timing-safe compare as the established security primitive.

---

### `src/lib/email.ts` — modified (HARDEN-02 List-Unsubscribe headers + body footer)

**Analog:** self (extend the existing `sendMagicLink` and possibly add a `sendUnsubscribeAck` sibling).

**Existing send call** (`src/lib/email.ts:50-51`):
```ts
const { error } = await resend.emails.send({ from: FROM, to: email, subject, text, html });
if (error) throw new Error(`Resend error: ${error.message}`);
```

**Extension for D-08 (RFC 8058 headers):** Resend's SDK accepts a `headers` field on the send payload. Inject for **non-confirmation** marketing/notification emails (D-07: confirmation email is exempt under CAN-SPAM):
```ts
const { error } = await resend.emails.send({
  from: FROM,
  to: email,
  subject,
  text,
  html,
  headers: {
    'List-Unsubscribe': `<${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
});
```

**Important — scope per D-07:** `sendMagicLink` itself is the **double-opt-in confirmation** and is EXEMPT from List-Unsubscribe. Do NOT add the headers here. They go on a future `sendLaunchPing` / `sendNotification` function. For Phase 1, the planner should:
- (a) decide whether to add a thin scaffold for the unsubscribe-bearing send function now (so the unsubscribe URL/token mint path is exercised end-to-end), OR
- (b) just expose the headers shape as a documented helper and wait for Phase 2 to wire in real notification emails.

CONTEXT.md `<code_context>` Reusable Assets line says: *"the existing send call is the place to inject `List-Unsubscribe` headers"* — interpret as "the place is already located and known," not "inject on every send."

**Existing dev fallback** (lines 42-48):
```ts
if (!resend) {
  // Dev fallback: print the magic link to the console so you can test the flow
  // without configuring Resend.
  console.log('\n[email-dev-fallback] Magic link for', email);
  console.log('  ', url, '\n');
  return;
}
```
Mirror this in any new send function: prefix log with `[email-dev-fallback]`, print the unsubscribe URL, return early. CLAUDE.md and CONCERNS.md both call this out as a hard rule (never throw on missing email config in dev).

**Existing env reads** (lines 3-6):
```ts
const API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM = process.env.EMAIL_FROM ?? 'oddlympics <onboarding@resend.dev>';
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const isProd = process.env.NODE_ENV === 'production';
```
`SITE_URL` is already read here — reuse for the unsubscribe URL base. No new env var needed for List-Unsubscribe.

---

### `src/lib/db.ts` — modified (HARDEN-02 schema migration + new prepared statement)

**Analog:** self (extend the existing 60-line file).

**Existing migration block** (lines 15-26):
```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS vip_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    requested_sport TEXT NOT NULL DEFAULT 'world_cup',
    confirmed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vip_signups_confirmed ON vip_signups(confirmed_at);
`);
```

**Extension pattern (D-05 + Established Patterns):** SQLite supports `ALTER TABLE … ADD COLUMN IF NOT EXISTS` since 3.35 (CONTEXT.md `<code_context>` confirms this). Append after the existing `db.exec`:
```ts
db.exec(`
  ALTER TABLE vip_signups ADD COLUMN IF NOT EXISTS unsubscribed_at INTEGER;
`);
```
Note: column is `INTEGER` (unix epoch seconds), matching `confirmed_at` and `created_at` storage convention. (CONTEXT.md D-05 says "TEXT" — confirm with planner; the in-tree convention for timestamps is INTEGER unix seconds via `strftime('%s','now')`. Recommend INTEGER for consistency, but flag this as a question for planner.)

**Existing `markConfirmed` prepared statement** (lines 50-55):
```ts
export const markConfirmed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET confirmed_at = strftime('%s','now')
  WHERE email = ? AND confirmed_at IS NULL
  RETURNING *
`);
```

**New `markUnsubscribed` (mirror the shape):**
```ts
export const markUnsubscribed = db.prepare<[string]>(`
  UPDATE vip_signups
  SET unsubscribed_at = strftime('%s','now')
  WHERE email = ? AND unsubscribed_at IS NULL
  RETURNING *
`);
```
Same idempotency primitive (`WHERE … IS NULL`) — second click is a no-op, returns no row, route reads as "already unsubscribed". Identical to confirm flow's idempotency model (CONCERNS.md MEDIUM section calls this out as the existing safety net).

**Existing `VipSignup` type** (lines 28-36):
```ts
export type VipSignup = {
  id: number;
  email: string;
  requested_sport: string;
  confirmed_at: number | null;
  created_at: number;
  ip: string | null;
  user_agent: string | null;
};
```
Extend with `unsubscribed_at: number | null;`.

---

### `src/pages/api/signup.ts` — modified (HARDEN-03, single-line flip)

**Analog:** self. CONTEXT.md D-20 and `<code_context>` Reusable Assets both say "the structure is right — only the `if (!origin) return true` line needs flipping."

**Existing `originOk`** (lines 18-34):
```ts
function originOk(request: Request, siteUrl: string | undefined): boolean {
  // Block obvious cross-site POSTs. Same-origin browser submits include the
  // matching Origin header.
  const origin = request.headers.get('origin');
  if (!origin) return true; // some same-origin form posts omit Origin; fall back to allow
  try {
    const o = new URL(origin);
    if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return true;
    if (siteUrl) {
      const s = new URL(siteUrl);
      return o.host === s.host;
    }
    return false;
  } catch {
    return false;
  }
}
```

**Fix:** flip line 22 from `return true` to `return false` and update the comment:
```ts
const origin = request.headers.get('origin');
if (!origin) return false; // modern browsers attach Origin to cross-origin form POSTs; treat absence as suspicious
```
Localhost allowlist (lines 24-25) is preserved as-is. The `back('bad-origin')` branch in `POST` (line 45) already handles the rejection redirect; the `index.astro` COPY map (line 66 of index.astro) already has the user-facing message: "Submission blocked. Please use the form on this page." No other changes needed.

---

### `deploy/Caddyfile` — modified (HARDEN-04 CSP)

**Analog:** self. CONTEXT.md D-18 explicitly says CSP joins the existing security headers block.

**Existing security headers block** (lines 24-32):
```caddyfile
# Security headers
header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    X-Frame-Options "DENY"
    # Caddy adds Server: Caddy by default; hide it
    -Server
}
```

**Extension (D-16 step 1 — report-only):**
```caddyfile
header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    X-Frame-Options "DENY"
    Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://plausible.io; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
    -Server
}
```

**Extension (D-16 step 2 — enforce, after 1-2 days of clean reports):**
Rename `Content-Security-Policy-Report-Only` → `Content-Security-Policy`. Same value.

**Reload command** (`DEPLOY.md:109`): `systemctl reload caddy` — already in the deploy user's sudoers allowlist (`bootstrap.sh:88-95`). Two-step rollout: ssh in, edit `/etc/caddy/Caddyfile`, reload. (Alternative: commit to `deploy/Caddyfile` and rsync via existing deploy workflow — but the workflow doesn't currently sync the Caddyfile, only `dist/`. Planner decides whether to extend the workflow or do it manually for this phase.)

**D-19 verification:** after enforce step, `curl -I https://oddlympics.app | grep -i security-policy` to confirm header present, then run securityheaders.com scan, target A grade.

---

### `deploy/oddlympics-backup.service` — new (HARDEN-05, systemd oneshot)

**Analog:** `deploy/oddlympics.service` (entire 53-line file).

**Reuse — `[Unit]` and identity** (`deploy/oddlympics.service:6-14`):
```ini
[Unit]
Description=oddlympics teaser app (Astro + Node)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=oddlympics
Group=oddlympics
WorkingDirectory=/opt/oddlympics
EnvironmentFile=/etc/oddlympics.env
```

**Adapt for backup service:**
```ini
[Unit]
Description=oddlympics SQLite backup → Backblaze B2
After=network-online.target oddlympics.service
Wants=network-online.target

[Service]
Type=oneshot                              # was: simple — backup runs once and exits
User=oddlympics                           # same — only user with read on DATA_DIR
Group=oddlympics
WorkingDirectory=/var/lib/oddlympics      # was: /opt/oddlympics
EnvironmentFile=/etc/oddlympics-backup.env  # NEW separate env per D-15
ExecStart=/path/to/backup-script.sh       # was: node entry.mjs
```

**Reuse — hardening flags verbatim** (`deploy/oddlympics.service:33-46`):
```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=true
MemoryDenyWriteExecute=false
RestrictRealtime=true
RestrictSUIDSGID=true
SystemCallArchitectures=native
```
**Critical:** keep `ReadWritePaths=/var/lib/oddlympics` (line 31 of oddlympics.service) plus add `ReadWritePaths=/tmp` (or `/var/cache/oddlympics-backup`) for the rclone temp dir / sqlite snapshot file. `ProtectSystem=strict` will block writes everywhere else.

**Reuse — logging** (lines 49-50): `StandardOutput=journal` / `StandardError=journal`. Same. `journalctl -u oddlympics-backup -f` to tail.

**Reuse — install target** (lines 52-53): `[Install] WantedBy=multi-user.target` — same shape, but timer is what gets enabled (see below).

**Bootstrap install pattern** (`deploy/bootstrap.sh:64-65`):
```bash
echo "==> systemd unit"
install -m 644 "$REPO_DIR/oddlympics.service" /etc/systemd/system/oddlympics.service
```
Extend bootstrap.sh with two more `install` lines for the backup service + timer, plus an `install` for `oddlympics-backup.env.example` (mirroring `oddlympics.env.example` at line 69), plus an `apt-get install -y rclone` (per D-12). Plus `systemctl enable oddlympics-backup.timer`.

---

### `deploy/oddlympics-backup.timer` — new (HARDEN-05, systemd timer)

**No in-tree analog** — this is a new artifact type. Pair it with the new `.service` file. Standard systemd timer shape:
```ini
[Unit]
Description=Daily oddlympics SQLite backup to B2

[Timer]
OnCalendar=*-*-* 03:00:00 UTC          # CONTEXT.md D-11 + Discretion: pick low-traffic hour
Persistent=true                         # run on next boot if missed
Unit=oddlympics-backup.service

[Install]
WantedBy=timers.target
```

`Persistent=true` is the critical flag — survives droplet reboots without missing a day. CONTEXT.md "Claude's Discretion" leaves the exact cadence to the planner; `03:00 UTC` is suggested as a low-traffic window.

---

### `DEPLOY.md` — modified (HARDEN-05 docs)

**Analog:** the existing Day 2 table (lines 99-122) and the "What is NOT in v1" section (lines 131-136).

**Existing manual backup line** (line 110):
```markdown
| Back up the DB | `sqlite3 /var/lib/oddlympics/oddlympics.db ".backup /tmp/oddlympics-$(date +%F).db"` |
```
Stays — manual escape hatch is still useful.

**Existing deferred line** (line 133):
```markdown
- **DB backups** to off-droplet storage. Add a daily cron + `rclone` to S3/B2 before launch.
```
Move out of the deferred section once HARDEN-05 ships; mention the new section by anchor.

**New section to add (D-14 restore runbook):** anchor it after the Day 2 table. Use the existing pipe-table style for inspect/restore commands. Document:
1. How to list backups (`rclone ls b2:bucket/path`).
2. How to download the latest snapshot to a scratch location.
3. How to verify integrity (`sqlite3 file.db "PRAGMA integrity_check"`).
4. Smoke-test queries: row count, last confirmed email (mirror the signal-pull query at `DEPLOY.md:115-122`).
5. How to swap into prod (stop service → restore → start service) — call out the brief ~2s downtime.
6. The B2 retention policy (30d daily / 12w weekly per D-13) and where the bucket lifecycle rules live.
7. Where credentials live (`/etc/oddlympics-backup.env`, root-owned, group-readable per D-15).

**Verification step (D-14 acceptance):** "Restore must be tested before phase complete." Add a checkbox-style entry in the runbook stating the restore drill must be run end-to-end on a scratch host before HARDEN-05 is marked done.

---

## Shared Patterns

### 303 Redirect Helper — file-local, not shared
**Source:** `src/pages/api/confirm.ts:23-25` and `src/pages/api/signup.ts:36-41`.
**Apply to:** `src/pages/api/unsubscribe.ts`.
```ts
function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}
```
Both existing API routes define this locally; do not extract a shared helper. CLAUDE.md "Conventions established" + STACK.md ("No barrel `index.ts` exports", "No JSDoc", "No async wrappers around sync code") imply file-local helpers are preferred over shared utilities at this scale.

### Status-Keyed COPY Map (URL-param driven UX)
**Sources:**
- `src/pages/index.astro:63-70` — error code → user message string
- `src/pages/confirmed.astro:5-26` — status code → `{banner, headline, sub}` object (currently broken; this map shape is correct, only the read-time matters)
**Apply to:** `src/pages/unsubscribed.astro`, fixed `src/pages/confirmed.astro`.
**Rule:** define the COPY map **inside `<script is:inline>`**, not in frontmatter. The frontmatter version only works on SSR pages (`prerender = false`).

### Inline-script URL-param Read
**Sources:**
- `src/pages/index.astro:71` — `new URL(location.href).searchParams.get('error')`
- `src/pages/pending.astro:30` — `new URL(location.href).searchParams.get('email')`
**Apply to:** `src/pages/unsubscribed.astro`, fixed `src/pages/confirmed.astro`.
**Rule:** wrap in `try {} catch {}` (both existing examples do). Default the value if absent. Always validate before injecting (pending.astro validates email shape with the same regex used server-side).

### Idempotent Conditional UPDATE (DB)
**Source:** `src/lib/db.ts:50-55` (`markConfirmed`):
```sql
UPDATE vip_signups SET confirmed_at = strftime('%s','now')
WHERE email = ? AND confirmed_at IS NULL
RETURNING *
```
**Apply to:** new `markUnsubscribed` prepared statement. Returns a row only on the first successful flip; subsequent calls return nothing. Route handler maps "no row returned" + "row exists in `getByEmail`" → already-done state. CONTEXT.md D-01 explicitly leans on this pattern as the rationale for **not** building a `used_tokens` table.

### Schema Migration on Module Import
**Source:** `src/lib/db.ts:15-26` (single `db.exec` block at module load).
**Apply to:** schema additions in this phase (`unsubscribed_at` column).
**Rule:** use `IF NOT EXISTS` everywhere — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. No migration framework. CONCERNS.md MEDIUM flags this as scaling-limited, but accepts it for current scope.

### Security Headers in Caddyfile, Not in App
**Source:** `deploy/Caddyfile:24-32`.
**Apply to:** new CSP header (HARDEN-04). Do NOT add CSP via Astro middleware or per-page meta tags — CONTEXT.md `<code_context>` Established Patterns: "Security headers in Caddyfile, not Astro — established convention; CSP joins them."

### systemd Hardening Block (clone verbatim)
**Source:** `deploy/oddlympics.service:33-46` (the 14-line hardening block).
**Apply to:** new `deploy/oddlympics-backup.service`. Same `User=oddlympics`, `Group=oddlympics`, `ProtectSystem=strict`, etc. The ONLY differences from the app service: `Type=oneshot` instead of `simple`, no long-running `ExecStart`, separate `EnvironmentFile`, and a different `ReadWritePaths` (still need `/var/lib/oddlympics` to read the DB; add `/tmp` or a backup workdir for rclone temp files).

### Production-Throw Guard for Required Env Vars
**Sources:**
- `src/lib/email.ts:8-10` — `RESEND_API_KEY` required in prod, dev fallback to console
- `src/lib/token.ts:6-8` — `MAGIC_LINK_SECRET` required in prod, dev fallback to insecure constant
**Apply to:** any new env vars introduced this phase. If the planner decides B2 credentials need to be readable from Node code (probably not — they're in the backup service env, not the app env per D-15), follow the same `if (!X && isProd) throw` pattern. For the backup service shell-side, just `: "${B2_KEY:?B2_KEY required}"` is enough.

### Honeypot / Silent Bot Handling
**Source:** `src/pages/api/signup.ts:55-59`.
**Apply to:** N/A for this phase (unsubscribe is a GET, no form). Listed for completeness.

---

## No Analog Found

| File | Reason |
|---|---|
| `deploy/oddlympics-backup.timer` | No existing systemd timer in the repo. Standard systemd timer syntax is well-known; planner can write directly. The paired `.service` has a strong analog. |
| (None for the four new code files) | Every new code file has an exact in-tree analog called out by CONTEXT.md. |

---

## Open Questions for Planner

The pattern map surfaces three minor points that need the planner's judgment, none of which block planning:

1. **Type of `unsubscribed_at` column.** CONTEXT.md D-05 says `TEXT`. Existing convention (`confirmed_at`, `created_at` in `db.ts:20-21`) is `INTEGER` unix epoch via `strftime('%s','now')`. Recommend `INTEGER` for consistency; flag for confirmation.
2. **`mintToken` signature extension.** Two reasonable shapes (positional `purpose` arg vs. options object). Either works; planner picks based on call-site count.
3. **Whether to build a working unsubscribe send-path now or just scaffold the headers helper.** D-07 says the unsubscribe link is on "non-confirmation emails" — but Phase 1 doesn't add any non-confirmation emails. Planner decides whether HARDEN-02 includes a stub `sendNotification` or just plumbs the unsubscribe URL/token mint and leaves header injection for Phase 2.

---

## Metadata

**Analog search scope:**
- `src/pages/api/*.ts` (2 files — `signup.ts`, `confirm.ts`)
- `src/pages/*.astro` (3 files — `index.astro`, `pending.astro`, `confirmed.astro`)
- `src/lib/*.ts` (4 files — `db.ts`, `email.ts`, `token.ts`, `rate-limit.ts` — last one read transitively via signup.ts)
- `deploy/*` (4 files — `Caddyfile`, `oddlympics.service`, `bootstrap.sh`, `oddlympics.env.example`)
- `DEPLOY.md`

**Files scanned:** 14 (10 source + 4 deploy + DEPLOY.md, ARCHITECTURE.md, CONCERNS.md, INTEGRATIONS.md, CONTEXT.md, CLAUDE.md as context)

**Pattern extraction date:** 2026-05-08
