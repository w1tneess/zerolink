# Security Policy & Threat Model

## Threat Model Overview

ZeroLink is engineered for public exposure without compromising visitor privacy or host security.

### 1. Malicious Destinations & Open Redirect Abuse
- **Risk:** Attackers shortening `javascript:` XSS payloads, `data:` URLs, credential-stuffed URLs, or phishing targets.
- **Mitigations:**
  - Strict protocol allowlist (`http:` and `https:` only) enforced on all inputs and imports (`src/lib/security/url-validator.ts`).
  - Rejects embedded username/password credentials (`https://user:pass@host`) and ASCII control characters, and caps destination URL length at 4,096 characters.
  - Verbatim URL storage with zero HTML injection and safe decoding via `safeDecodeURIComponent`; `/[slug]+` (`/inspect/[slug]`) lets visitors inspect destinations safely before navigating without counting a click.
  - Anonymous `/report` flow automatically pauses (`flagged`) reported public links while keeping owner `admin` links protected from malicious false-flagging.
  - Admin-managed domain blocklist normalized via IDNA (`domainToASCII`), validated for RFC hostname syntax, and enforced across exact domains and subdomains on public creation.

### 2. Server-Side Request Forgery (SSRF) & Redirect Loops
- **Risk:** Shortening loopback, cloud metadata (`169.254.169.254`), RFC1918 private IPs, obfuscated IP encodings, or self-referential loops.
- **Mitigations:**
  - `src/lib/security/url-validator.ts` parses dotted, decimal, octal, hex, and shorthand IPv4 as well as IPv6 addresses, blocking all private, loopback, link-local, CGNAT, benchmarking, discard-only (`100::/64`), unique local (`fc00::/7`), link-local (`fe80::/10`), multicast (`ff00::/8`), IPv4-compatible (`::/96`), IPv4-mapped (`::ffff:0:0/96`), IPv4-translated (`::ffff:0:0:0/96`), and NAT64 (`64:ff9b::/96`) ranges, plus `.localhost`, `.local`, and `.internal` hostnames.
  - Blocks hostnames matching `APP_BASE_URL` or the incoming `Host` header (including IPv6 host-with-port comparisons).
  - `/api/shorten` validates `Origin` against `APP_BASE_URL` and `Host` before constructing returned short URLs or QR codes to prevent spoofed `Origin` forgery.

### 3. Automated Spam Without Visitor Tracking
- **Risk:** Bots flooding storage, `/report`, password unlock, or admin login without a traditional third-party CAPTCHA.
- **Mitigations:**
  - In-memory sliding-window rate limiter (`src/lib/rate-limit.ts`) with bounded LRU bucket capacity (`20,000` buckets) keyed by `HMAC-SHA256(dailyRandomSecret, ip)` where `dailyRandomSecret` rotates every 24 hours in RAM and is never persisted to disk or logs. Enforced on `/api/shorten`, `/api/report`, `/api/auth/login`, and `/api/links/[slug]/unlock`.
  - Stateless HMAC-signed SHA-256 hashcash Proof-of-Work (`/api/pow/challenge`, solved client-side via `public/pow-worker.js` Web Worker) with a bounded single-use replay guard (`25,000` records) + hidden honeypot field (`website`).

### 4. Admin Workspace & Data Protection
- **Authentication:** `scrypt` password hashing (`N=16384, r=8, p=1`) + timing-safe comparison + HMAC-SHA256 signed `HttpOnly`, `Secure` (in production), `SameSite=Strict` cookie (`ls_admin_session`, 12-hour TTL). Production deployments require an explicit `SESSION_SECRET` (>=16 characters).
- **SQL Injection & Concurrency:** 100% parameterized Drizzle ORM queries with SQLite WAL mode, `foreign_keys = ON`, `busy_timeout = 5000`, transactional moderation actions, and atomic `clicks < max_clicks` enforcement on redirect/unlock increments.
- **CSV Formula Injection:** Exports escape leading `=`, `+`, `-`, `@`, `\t`, and `\r` characters with `'` and serve CSV files with `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`. Imports enforce strict Zod validation, status allowlisting, and a 10,000-row / 2 MB batch limit.
- **Cache Poisoning:** Expiring or click-capped links disallow `301` redirects, and all redirects send `Cache-Control: no-store, no-cache, must-revalidate`.
- **HTTP Headers:** `src/lib/security/headers.ts` and `next.config.ts` enforce `Content-Security-Policy` (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security` in production.

## Reporting a Vulnerability

If you discover a security vulnerability in ZeroLink, please do **not** open a public issue with exploit details. Contact the repository maintainer privately with steps to reproduce and impact details so a coordinated fix can be released.
