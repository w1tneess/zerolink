import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/crypto";
import {
  checkLinkAvailability,
  getLinkBySlug,
  incrementAnonymousClick,
} from "@/lib/links/service";

const unlockSchema = z.object({
  password: z.string().min(1).max(128),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = extractClientIp(request);
  const rate = await checkRateLimit("link_unlock", ip, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many password attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const { slug } = await context.params;
  const link = await getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);

  if (!availability.available) {
    const status =
      availability.reason === "not_found"
        ? 404
        : availability.reason === "disabled" || availability.reason === "flagged"
          ? 403
          : 410;
    return NextResponse.json(
      { error: "This link is unavailable or has expired." },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const activeLink = availability.link;
  if (!activeLink.passwordHash) {
    const allowed = await incrementAnonymousClick(activeLink.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "This short link has reached its visit limit." },
        { status: 410, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { destinationUrl: activeLink.destinationUrl },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Something looked off in that request. Please try again." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter the password." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const valid = verifyPassword(parsed.data.password, activeLink.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect password for this link." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const allowed = await incrementAnonymousClick(activeLink.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "This short link has reached its visit limit." },
      { status: 410, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { destinationUrl: activeLink.destinationUrl },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
