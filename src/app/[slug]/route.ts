import { NextRequest } from "next/server";
import {
  checkLinkAvailability,
  getLinkBySlug,
  incrementAnonymousClick,
  resolveSafeRedirectCode,
} from "@/lib/links/service";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildUnavailableHtml(title: string, message: string, slug: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeSlug = escapeHtml(slug);
  const encodedSlug = encodeURIComponent(slug);

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <title>${safeTitle} | ZeroLink</title>
  <script>
    try {
      if (localStorage.getItem('zerolink_theme') === 'light') {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  </script>
  <style>
    :root {
      --bg: #f6f6f3;
      --surface: #ffffff;
      --elevated: #ecece8;
      --line: rgba(14, 16, 20, 0.14);
      --line-strong: rgba(14, 16, 20, 0.24);
      --text: #0e1014;
      --muted: #484f5b;
      --accent: #1d4ed8;
      --accent-fg: #ffffff;
      --accent-ink: #1d4ed8;
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
    }
    html.dark {
      --bg: #0a0b0d;
      --surface: #111317;
      --elevated: #181b21;
      --line: rgba(242, 241, 236, 0.12);
      --line-strong: rgba(242, 241, 236, 0.22);
      --text: #f2f1ec;
      --muted: #a2a8b4;
      --accent: #2563eb;
      --accent-fg: #ffffff;
      --accent-ink: #7ea8ff;
    }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100dvh;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .skip-link {
      position: fixed;
      left: 24px;
      top: 16px;
      z-index: 100;
      padding: 8px 14px;
      border-radius: 6px;
      background: var(--text);
      color: var(--bg);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transform: translateY(-240%);
    }
    .skip-link:focus-visible { transform: translateY(0); }
    header {
      border-bottom: 1px solid var(--line);
    }
    .nav-wrap {
      max-width: 1360px;
      margin: 0 auto;
      height: 64px;
      padding: 0 clamp(1rem, 0.6rem + 1.8vw, 2.5rem);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      text-decoration: none;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -0.02em;
    }
    nav { display: flex; gap: 24px; }
    .nav-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      padding: 6px 0;
      background: linear-gradient(currentColor 0 0) 0 100% / 0% 1px no-repeat;
      transition: background-size 320ms var(--ease), color 180ms var(--ease);
    }
    .nav-link:hover, .nav-link:focus-visible {
      color: var(--text);
      background-size: 100% 1px;
    }
    main {
      flex: 1;
      display: grid;
      place-items: center;
      padding: 32px 20px;
    }
    .plate {
      max-width: 520px;
      width: 100%;
      border: 1px solid var(--line-strong);
      border-radius: 12px;
      background: var(--surface);
      padding: 32px;
    }
    .sightline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--line);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .coord { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .state { color: var(--accent-ink); flex-shrink: 0; }
    h1 {
      font-size: 28px;
      font-weight: 500;
      letter-spacing: -0.025em;
      margin: 0 0 10px;
    }
    p {
      color: var(--muted);
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 28px;
    }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 240ms var(--ease), border-color 240ms var(--ease), transform 160ms var(--ease);
    }
    .btn-primary {
      background: var(--accent);
      color: var(--accent-fg);
    }
    .btn-primary::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background: var(--text);
      transform: scaleX(0);
      transform-origin: left center;
      transition: transform 360ms var(--ease);
    }
    .btn-primary:hover, .btn-primary:focus-visible { color: var(--bg); }
    .btn-primary:hover::before, .btn-primary:focus-visible::before { transform: scaleX(1); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-ghost {
      border: 1px solid var(--line-strong);
      color: var(--text);
      background: transparent;
    }
    .btn-ghost::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background: var(--elevated);
      transform: scaleY(0);
      transform-origin: bottom center;
      transition: transform 260ms var(--ease);
    }
    .btn-ghost:hover::before, .btn-ghost:focus-visible::before { transform: scaleY(1); }
    .btn-ghost:hover { border-color: var(--text); }
    .btn-ghost:active { transform: scale(0.98); }
    a:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 3px; }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>
    <div class="nav-wrap">
      <a class="brand" href="/">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M5 10V6.5C5 5.67 5.67 5 6.5 5H13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M27 22V25.5C27 26.33 26.33 27 25.5 27H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.5 23.5L23.5 8.5M15.5 8.5H23.5V16.5" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>ZeroLink</span>
      </a>
      <nav aria-label="Primary navigation">
        <a class="nav-link" href="/">Shorten</a>
        <a class="nav-link" href="/report">Report</a>
      </nav>
    </div>
  </header>
  <main id="main" tabindex="-1">
    <div class="plate">
      <div class="sightline">
        <span class="coord">/${safeSlug}</span>
        <span class="state">unavailable</span>
      </div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <div class="actions">
        <a class="btn btn-primary" href="/">Back to home</a>
        <a class="btn btn-ghost" href="/${encodedSlug}+">Preview link</a>
      </div>
    </div>
  </main>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  // Fallback if reached directly with '+' or ?preview=true
  if (
    (slug.endsWith("+") && slug.length > 1) ||
    request.nextUrl.searchParams.get("preview") === "true"
  ) {
    const clean = slug.endsWith("+") ? slug.slice(0, -1) : slug;
    return new Response(null, {
      status: 307,
      headers: {
        Location: `/inspect/${encodeURIComponent(clean)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  const link = getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);

  if (!availability.available) {
    const map = {
      not_found: {
        status: 404,
        title: "Link not found",
        message: `We couldn't find a short link for "/${slug}".`,
      },
      disabled: {
        status: 403,
        title: "Link paused",
        message: "This link has been paused by the site owner.",
      },
      flagged: {
        status: 403,
        title: "Link under review",
        message:
          "This public link is temporarily paused while it's being reviewed for safety.",
      },
      expired: {
        status: 410,
        title: "Link expired",
        message: "This short link has expired and is no longer active.",
      },
      max_clicks: {
        status: 410,
        title: "Visit limit reached",
        message: "This short link has reached the maximum number of visits.",
      },
    }[availability.reason];

    return new Response(buildUnavailableHtml(map.title, map.message, slug), {
      status: map.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  const activeLink = availability.link;

  // Password-protected links redirect to the unlock gate
  if (activeLink.passwordHash) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/unlock/${encodeURIComponent(activeLink.slug)}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  await incrementAnonymousClick(activeLink.id);

  const statusCode = resolveSafeRedirectCode(
    activeLink.redirectCode,
    activeLink.expiresAt,
    activeLink.maxClicks
  );

  // Set Location verbatim to preserve query parameters, encoding, and #fragments
  return new Response(null, {
    status: statusCode,
    headers: {
      Location: activeLink.destinationUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Referrer-Policy": "no-referrer",
    },
  });
}
