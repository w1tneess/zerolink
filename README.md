<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/logo-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="./public/logo-light.svg" />
    <img alt="ZeroLink logo" src="./public/logo-light.svg" width="72" height="72" />
  </picture>
</p>

# ZeroLink — Open-Source, Zero-Telemetry Public & Personal Link Shortener

ZeroLink is a fast, auditable, self-hostable URL shortener built with Next.js (App Router), TypeScript, Tailwind CSS, Drizzle ORM, and SQLite. It serves **two isolated modes** from a single minimal deployment:

1. **Public Mode (`/`)**: Anyone can shorten links immediately with zero account creation, zero tracking cookies, and zero third-party CAPTCHAs. Supports optional public custom endings (toggleable by the owner), selectable expiration (`24h`, `7d`, `30d`, or owner default), optional password protection, instant local SVG QR codes, and anonymous abuse reporting (`/report`).
2. **Personal / Owner Mode (`/admin`)**: Single-owner authenticated workspace (with `Cmd/Ctrl + K` quick create) for permanent custom vanity links (e.g. `/github`, `/resume`), configurable `301`/`302`/`307` redirects, click caps, expiration dates, notes, JSON/CSV import & export, public link moderation, domain blocklist management, and runtime site settings.

---

## Privacy & Transparency Guarantees

- **Zero Telemetry:** No Google Analytics, no third-party font CDNs (`Switzer` and `Azeret Mono` are self-hosted in `src/fonts/`), no external QR APIs (generated locally via `qrcode`), no ad pixels, and no visitor tracking cookies.
- **Zero Persistent IP / UA Logging:** Redirects increment only an integer counter (`clicks = clicks + 1`) when anonymous click counting is enabled. Visitor IPs, `User-Agent`, referrers (`Referrer-Policy: no-referrer`), and geolocation are never stored.
- **100% Verbatim URL Fidelity:** Query parameters (`?a=1&b=2`), percent-encoding (`%20`, `%2F`), and hash fragments (`#section`) are stored and returned verbatim in HTTP `Location` headers.
- **Transparent Inspection (`/[slug]+`):** Appending `+` or `?preview=true` to any short link opens `/inspect/[slug]` without counting a visit, showing the exact full destination URL, ownership badge (`Verified owner link` vs. `Public link`), status, creation/expiry timestamps, visit counts, and a manual continue or unlock button.

---

## Anti-Abuse & Security Architecture

- **Ephemeral 24h Rotating-Key Rate Limiter:** Sliding-window limits with bounded LRU bucket eviction on `/api/shorten`, `/api/report`, `/api/auth/login`, and `/api/links/[slug]/unlock`, keyed by `HMAC-SHA256(dailyRandomSecret, ip)` in RAM only.
- **Privacy-Preserving Bot Protection:** Stateless HMAC-signed SHA-256 hashcash Proof-of-Work (`/api/pow/challenge`) solved locally in a browser Web Worker (`public/pow-worker.js`) with single-use replay protection + an invisible honeypot field.
- **Strict URL & SSRF Validation:** Allows only `http://` and `https://`; rejects embedded credentials, control characters, private/loopback/link-local/CGNAT/multicast IPs (including decimal/hex/octal/shorthand IPv4 and IPv4-mapped/NAT64/ULA IPv6), self-referential loops, reserved system routes, and IDN-normalized blocked domains.
- **Personal Link Isolation:** Public abuse reports (`/report`) automatically flag public links for safety review, while `owner_type = 'admin'` links are never disabled or auto-flagged by public reports.
- **CSV Formula Injection Neutralization:** CSV exports escape leading `=`, `+`, `-`, `@`, tab, and CR characters with `'` and serve downloads with `Content-Security-Policy: sandbox`.

See [`SECURITY.md`](./SECURITY.md) for the full threat model and [`DESIGN.md`](./DESIGN.md) for the visual system and motion architecture.

---

## Routes & Endpoints

| Route | Purpose |
|---|---|
| `/` | Public shortener, live URL sightline preview, and quick `/<slug>+` inspector |
| `/[slug]` | Verbatim redirect (`301`/`302`/`307`), password gate redirect, or unavailable status page |
| `/[slug]+` or `/[slug]?preview=true` | Rewritten via `src/proxy.ts` to `/inspect/[slug]` without counting clicks |
| `/unlock/[slug]` | Password entry gate for protected short links |
| `/report` | Anonymous abuse reporting form |
| `/admin` & `/admin/login` | Single-owner link management, moderation queue, blocklist, and settings |
| `/api/health` | SQLite connectivity health check (used by Docker `HEALTHCHECK`) |
| `/robots.txt` & `/sitemap.xml` | Crawl rules and sitemap generated from `APP_BASE_URL` |

---

## Quick Start (Under 5 Minutes)

### 1. Clone & Install

```bash
git clone https://github.com/w1tneess/zerolink.git zerolink
cd zerolink
npm install
```

### 2. Configure `.env`

```bash
cp .env.example .env
```

Generate a strong `scrypt` password hash for your owner account (minimum 8 characters) and a 32-byte session secret:

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
POW_SECRET=
POW_DIFFICULTY=16
DEFAULT_REDIRECT_CODE=302
```

| Variable | Description |
|---|---|
| `APP_BASE_URL` | Public base URL of your instance (used for short link display, metadata, and loop prevention) |
| `DATABASE_DRIVER` | `sqlite` (default), `turso`, or `postgres` |
| `DATABASE_URL` | SQLite file path (default `./data/links.db`) or remote connection string |
| `ADMIN_PASSWORD_HASH` | `scrypt:<salt>:<hash>` generated via `npm run hash-password` for `/admin` login |
| `SESSION_SECRET` | Random secret (>=16 chars, **required in production**) to sign owner cookies and PoW challenges |
| `POW_SECRET` | Optional separate HMAC secret (>=16 chars) for PoW challenges (defaults to `SESSION_SECRET`) |
| `POW_DIFFICULTY` | Leading zero bits required for SHA-256 PoW (`4`–`24`, default `16`) |
| `DEFAULT_REDIRECT_CODE` | Default HTTP redirect code (`301`, `302`, or `307`; default `302`) |

### 3. Run Locally & Verify

```bash
npm run dev
# Run automated Vitest suite
npm test
# Lint & production build check
npm run lint && npm run build
```

Open `http://localhost:3000` for Public Mode and `http://localhost:3000/admin` for Personal Owner Mode.

---

## Deployment Guides

### Docker / Self-Hosted Linux

Ensure `APP_BASE_URL`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` are set in `.env`, then run:

```bash
docker compose up -d --build
```

`docker-compose.yml` mounts the persistent `zerolink_data` volume at `/app/data` (`DATABASE_URL=/app/data/links.db`), builds Next.js in standalone mode (`NEXT_STANDALONE=1`), and monitors `/api/health`. Place behind Caddy or Nginx for automatic TLS (`HTTPS`) and ensure `APP_BASE_URL` matches your public `https://` origin.

### Swapping SQLite for Turso / Cloudflare D1 / PostgreSQL

1. Update `DATABASE_DRIVER` and `DATABASE_URL` in `.env`.
2. Swap the Drizzle connection adapter in `src/db/index.ts` (and `src/db/schema.ts` / `drizzle.config.ts` dialect if targeting PostgreSQL, then run `npm run db:push`).

### Vercel / Cloudflare Notes

- Because `better-sqlite3` stores data on local disk, serverless deployments (Vercel) require configuring a remote database driver (Turso/libSQL or Postgres) in `src/db/index.ts` via `DATABASE_URL`.
- For Cloudflare Workers / Pages, swap `src/db/index.ts` to `drizzle-orm/d1` bound to your D1 database.

---

## Documentation & License

- [`SECURITY.md`](./SECURITY.md) — Threat model, SSRF rules, PoW, rate limiting, and vulnerability reporting
- [`DESIGN.md`](./DESIGN.md) — Visual tokens, typography, layout commitments, and motion system
- [`LICENSE`](./LICENSE) — MIT License
