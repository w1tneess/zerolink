# Security Policy & Threat Model

## Threat Model Overview

ZeroLink is engineered for public exposure without compromising visitor privacy or host security.

### 1. Malicious Destinations & Open Redirect Abuse
- **Risk:** Attackers shortening `javascript:` XSS payloads, `data:` URLs, or phishing targets.
- **Mitigations:**
  - Strict protocol allowlist (`http:` and `https:` only) enforced on all inputs and imports.
  - Verbatim URL storage with zero HTML injection; `/[slug]+` preview lets visitors inspect destinations safely before navigating.
  - Anonymous `/report` flow automatically pauses (`flagged`) reported public links while keeping owner `admin` links protected from malicious false-flagging.
  - Admin-managed domain blocklist checked on every public creation.

### 2. Server-Side Request Forgery (SSRF) & Redirect Loops
- **Risk:** Shortening loopback, cloud metadata (`169.254.169.254`), RFC1918 private IPs, or self-referential loops.
- **Mitigations:**
  - `src/lib/security/url-validator.ts` parses standard, decimal, octal, hex, and shorthand IPv4 as well as IPv6 and IPv4-mapped IPv6 addresses, blocking all private, loopback, link-local, CGNAT, and multicast ranges.
  - Blocks hostnames matching `APP_BASE_URL` or the incoming `Host` header.

### 3. Automated Spam Without Visitor Tracking
- **Risk:** Bots flooding storage or `/report` without a traditional third-party CAPTCHA.
- **Mitigations:**
  - In-memory sliding-window rate limiter keyed by `HMAC-SHA256(dailyRandomSecret, ip)` where `dailyRandomSecret` rotates every 24 hours in RAM and is never persisted to disk or logs.
  - Stateless HMAC-signed SHA-256 hashcash Proof-of-Work (`/api/pow/challenge`) with single-use replay protection + hidden honeypot field.

### 4. Admin Workspace & Data Protection
- **Authentication:** `scrypt` password hashing (`N=16384, r=8, p=1`) + timing-safe comparison + HMAC-SHA256 signed `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- **SQL Injection:** 100% parameterized Drizzle ORM queries.
- **CSV Formula Injection:** Exports escape leading `=`, `+`, `-`, `@`, `\t`, and `\r` characters with `'`.
- **Cache Poisoning:** Expiring or click-capped links disallow `301` and always send `Cache-Control: no-store`.
- **HTTP Headers:** Enforces `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and HSTS in production.

## Reporting a Vulnerability

If you discover a security vulnerability in ZeroLink, please do **not** open a public issue with exploit details. Contact the repository maintainer privately with steps to reproduce and impact details so a coordinated fix can be released.
