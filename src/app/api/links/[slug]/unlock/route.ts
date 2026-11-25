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
  const rate = checkRateLimit("link_unlock", ip, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many password attempts. Retry in ${rate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const { slug } = await context.params;
  const link = getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);

  if (!availability.available) {
    return NextResponse.json(
      { error: "This link is unavailable or expired." },
      { status: availability.reason === "not_found" ? 404 : 410 }
    );
  }

  const activeLink = availability.link;
  if (!activeLink.passwordHash) {
    await incrementAnonymousClick(activeLink.id);
    return NextResponse.json(
      { destinationUrl: activeLink.destinationUrl },
      { status: 200 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  const valid = verifyPassword(parsed.data.password, activeLink.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect password for this link." },
      { status: 401 }
    );
  }

  await incrementAnonymousClick(activeLink.id);

  return NextResponse.json(
    { destinationUrl: activeLink.destinationUrl },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
