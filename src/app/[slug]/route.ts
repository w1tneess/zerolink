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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --bg: #f5f7fa; --card: #ffffff; --border: rgba(17,24,39,0.08); --text: #111827; --muted: #4b5565; --btn: #eceff4; --btn-hover: #e2e6ee; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0b0d14; --card: #11141c; --border: rgba(238,240,245,0.08); --text: #eef0f5; --muted: #a3a9b8; --btn: #1a1e28; --btn-hover: #252b38; }
    }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { max-width: 440px; width: 100%; border: 1px solid var(--border); border-radius: 16px; background: var(--card); padding: 24px; }
    h1 { font-size: 18px; font-weight: 500; margin: 0 0 8px; }
    p { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    a { color: var(--text); background: var(--btn); padding: 8px 14px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; }
    a:hover { background: var(--btn-hover); }
  </style>
</head>
<body>
  <main class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="actions">
      <a href="/">Go home</a>
      <a href="/${encodeURIComponent(slug)}+">Inspect link details</a>
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
        message: `No shortened link exists for "/${slug}".`,
      },
      disabled: {
        status: 403,
        title: "Link disabled",
        message: "This link has been disabled by the administrator.",
      },
      flagged: {
        status: 403,
        title: "Link under review",
        message:
          "This public link was flagged for safety review and is temporarily paused.",
      },
      expired: {
        status: 410,
        title: "Link expired",
        message: "This short link has passed its expiration window.",
      },
      max_clicks: {
        status: 410,
        title: "Click limit reached",
        message: "This short link has reached its maximum allowed clicks.",
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
