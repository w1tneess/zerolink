# ZeroLink — Open-Source, Zero-Telemetry Public & Personal Link Shortener

ZeroLink is a fast, auditable, self-hostable URL shortener built with Next.js (App Router), TypeScript, Tailwind CSS, Drizzle ORM, and SQLite. It serves **two isolated modes** from a single minimal deployment:

1. **Public Mode (`/`)**: Anyone can shorten links immediately with zero account creation, zero tracking cookies, and zero third-party CAPTCHAs.
2. **Personal / Owner Mode (`/admin`)**: Single-owner authenticated workspace for permanent custom vanity links (e.g. `/github`, `/resume`), full CRUD, JSON/CSV import & export, and public link moderation.

---

## Privacy & Transparency Guarantees

- **Zero Telemetry:** No Google Analytics, no third-party font CDNs, no external QR APIs, no ad pixels, and no visitor tracking cookies.
- **Zero Persistent IP / UA Logging:** Redirects increment only an integer counter (`clicks = clicks + 1`). Visitor IPs, `User-Agent`, referrers, and geolocation are never stored.
- **100% Verbatim URL Fidelity:** Query parameters (`?a=1&b=2`), percent-encoding (`%20`, `%2F`), and hash fragments (`#section`) are stored and returned verbatim in HTTP `Location` headers.
- **Transparent Inspection (`/[slug]+`):** Appending `+` or `?preview=true` to any short link opens a safe preview card showing the exact full destination URL, ownership badge (`Verified Personal Link` vs. `Public Visitor Link`), creation/expiry timestamps, and a manual continue button.

---

## Anti-Abuse & Security Architecture

- **Ephemeral 24h Rotating-Key Rate Limiter:** Sliding-window limits on `/api/shorten`, `/api/report`, `/api/auth/login`, and `/api/links/[slug]/unlock` keyed by `HMAC-SHA256(dailyRandomSecret, ip)` in RAM only.
- **Privacy-Preserving Bot Protection:** Stateless HMAC-signed SHA-256 hashcash Proof-of-Work (`/api/pow/challenge`) solved locally in the browser + invisible honeypot field.
- **Strict URL & SSRF Validation:** Allows only `http://` and `https://`; blocks `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, private/loopback/link-local/CGNAT IPs (including decimal/hex/octal obfuscations), self-referential loops, reserved routes, and admin-blocked domains.
- **Personal Link Isolation:** Public abuse reports (`/report`) never disable or auto-flag `owner_type = 'admin'` links.
- **CSV Formula Injection Neutralization:** CSV exports escape leading `=`, `+`, `-`, `@`, tab, and CR characters.

---

## Quick Start (Under 5 Minutes)

### 1. Clone & Install

```bash
git clone <your-repo-url> link-shortener
cd link-shortener
npm install
```

### 2. Configure `.env`

```bash
cp .env.example .env
```

Generate a strong scrypt password hash for your owner account and a session secret:

```bash
npm run hash-password -- "your-strong-owner-password"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste those into `.env`:

```env
APP_BASE_URL=http://localhost:3000
DATABASE_DRIVER=sqlite
DATABASE_URL=./data/links.db
ADMIN_PASSWORD_HASH=scrypt:...
SESSION_SECRET=...
POW_DIFFICULTY=16
DEFAULT_REDIRECT_CODE=302
```

### 3. Run Locally & Test

```bash
npm run dev
# Run automated test suite
npm test
```

Open `http://localhost:3000` for Public Mode and `http://localhost:3000/admin` for Personal Owner Mode.

---

## Deployment Guides

### Docker / Self-Hosted Linux

```bash
docker compose up -d --build
```

Place behind Caddy or Nginx for automatic TLS (`HTTPS`). Ensure `APP_BASE_URL` matches your public `https://` origin.

### Swapping SQLite for Turso / Cloudflare D1 / PostgreSQL

1. Update `DATABASE_DRIVER` and `DATABASE_URL` in `.env`.
2. Swap the Drizzle connection adapter in `src/db/index.ts` (and `src/db/schema.ts` dialect if targeting PostgreSQL).

### Vercel / Cloudflare Notes

- Because local `better-sqlite3` stores data on a local disk, serverless platforms (Vercel) require configuring a remote database driver (Turso/libSQL or Postgres) in `src/db/index.ts` via `DATABASE_URL`.
- For Cloudflare Workers / Pages, swap `src/db/index.ts` to `drizzle-orm/d1` bound to your D1 database.
