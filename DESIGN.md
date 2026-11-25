# ZeroLink — Design System & Concept (`DESIGN.md`)

## Concept Card

```
Idea:        The Optical Sightline — every short URL unfolds into its verbatim origin, path,
             ?query, and #fragment before you ever click through.
Metaphor:    Architectural transit signage & optical routing plate; nothing hidden behind a redirect.
Signature:   The Live Optical Routing Sightline: a continuous hairline conduit on `/` that stays
             alive with a quiet ambient drift at rest and splits any entered URL into live
             anatomical segments, resolving into the issued short plate and local QR SVG.
Emotion:     Immediate clarity, precision, and quiet trust in the first 3 seconds.
Motion verb: Resolve & align — masked lines lift cleanly (expo.out), hairlines draw left-to-right,
             primary fills sweep across, and pages hand off via a fast radial curtain.
Screenshot:  The asymmetrical split hero at 1440px: massive Switzer display headline + clean
             single-row shortener input on the left, live refracted URL sightline plate on the right.
```

## Palette (Obsidian & Cobalt Signal)

Dark-first default with a deliberately calibrated architectural paper light theme (defined in `src/app/globals.css`).

| Role | Dark | Light | Use |
|---|---|---|---|
| Ground (`--bg`) | `#0a0b0d` | `#f6f6f3` | Page canvas |
| Surface (`--surface`) | `#111317` | `#ffffff` | Plates, inputs, modals |
| Elevated (`--surface-elevated`) | `#181b21` | `#ecece8` | Secondary fills, controls |
| Ink (`--text`) | `#f2f1ec` | `#0e1014` | Primary text & display |
| Secondary (`--text-secondary`) | `#a2a8b4` | `#484f5b` | Body copy, descriptions |
| Muted (`--text-muted`) | `#8f97a5` | `#616874` | Metadata, coordinates (≥4.5:1 AA) |
| Line (`--line`) | `rgba(242, 241, 236, 0.11)` | `rgba(14, 16, 20, 0.11)` | 1px structural rules |
| Accent (`--accent`) | `#2563eb` | `#1d4ed8` | Primary CTA, focus ring, optical beam |
| Accent ink (`--accent-ink`) | `#7ea8ff` | `#1d4ed8` | Links, active route tokens |
| Curtain (`--curtain`) | `#14171f` | `#0e1014` | Route transition wipe |

## Typography

- **Display & UI:** `Switzer` (`400`, `500`, `600`, self-hosted in `src/fonts/` via `next/font/local` in `src/app/fonts.ts`).
- **Data & URLs:** `Azeret Mono` (`400`, `500`, self-hosted) strictly for URLs, slugs, PoW readouts, and `tabular-nums` counters.
- **Display scale (`.zl-display`):** `clamp(2.4rem, 1.35rem + 4vw, 4.5rem)`, tracking `-0.032em`, line-height `1.04`, font-weight `500`, `text-wrap: balance`.
- **Body copy:** `15px–17px`, line-height `1.625–1.65`, measure `max-w-[54ch]` on hero intro. Sentence case everywhere.

## Grid, Layout & Anti-Slop Commitments

- 12-column architectural grid (`max-w-[1360px]`), fluid `--gutter`.
- **No eyebrow kickers** above headings, **no generic 3-column icon cards**, **no ghost cards** (declare elevation once via `1px` hairline or surface step), **no gradient text**, **no em-dashes in UI labels**.
- **Four section families on `/` (`src/app/page.tsx`):**
  1. Asymmetric split hero (`Shorten any link. Check where it goes.` + live Optical Sightline preview plate in `PublicShortener`).
  2. Statement + tabular facts strip (`Short links shouldn't spy on the people who click them.` + `0` tracking cookies, `0` visitor details saved, `0` sign-ups or pop-up puzzles, `100%` original link kept intact).
  3. Full-width ruled feature ledger (`How your links work`: full link preservation, automatic expiration, simple visit counts, quiet spam protection, QR codes & previews).
  4. Direct `/<slug>+` preview strip (`Check any short link before opening it` with `QuickInspect`) + architectural footer.
- **Motion & Reduced-Preference Handling (`src/engine/`, `src/motion/setup.ts`, `src/app/globals.css`):**
  - Smooth scroll via `Lenis`, `SplitText` masked line reveals, and radial-clip route transition curtain (`#curtain`) wired through `<Motion />`.
  - The optical sightline pulse drifts smoothly on GSAP's ticker at rest, pauses offscreen via `ScrollTrigger`, and halts completely under `prefers-reduced-motion: reduce`.
  - Also honors `prefers-reduced-transparency: reduce` (solid header & backdrop) and `prefers-contrast: more` (stronger hairline borders).
