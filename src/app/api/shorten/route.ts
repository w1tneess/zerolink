import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { verifyPowSolution } from "@/lib/pow";
import { validateDestinationUrl } from "@/lib/security/url-validator";
import { validateCustomSlug } from "@/lib/security/slug-validator";
import {
  createLinkRecord,
  getAppSettings,
  getBlockedDomainsList,
  getLinkBySlug,
  SlugTakenError,
} from "@/lib/links/service";
import { generateQrSvg } from "@/lib/qr";
import { getEnv } from "@/lib/env";

const shortenSchema = z.object({
  url: z.string().min(1).max(4096),
  expiresInHours: z
    .union([z.literal(24), z.literal(168), z.literal(720), z.literal("default")])
    .optional()
    .default("default"),
  password: z.string().max(128).optional().nullable(),
  customSlug: z.string().max(64).optional().nullable(),
  website: z.string().optional().default(""), // honeypot
  pow: z.object({
    challengeId: z.string(),
    prefix: z.string(),
    difficulty: z.number().int(),
    expiresAt: z.number(),
    sig: z.string(),
    nonce: z.string(),
  }),
});

function resolveShortBaseUrl(request: NextRequest): string {
  const fallback = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin || rawOrigin === "null") {
    return fallback;
  }
  try {
    const originUrl = new URL(rawOrigin);
    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") {
      return fallback;
    }
    const reqHost = request.headers.get("host")?.trim().toLowerCase();
    const fallbackHost = new URL(fallback).host.toLowerCase();
    const originHost = originUrl.host.toLowerCase();
    if (originHost === fallbackHost || (reqHost && originHost === reqHost)) {
      return originUrl.origin;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request);
  const rate = await checkRateLimit("public_shorten", ip, 20, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Too many requests right now. Please wait ${rate.retryAfterSeconds}s and try again.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Something looked off in that request. Please try again." },
      { status: 400 }
    );
  }

  const parsed = shortenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your link and try again." },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Reject automated bots filling the hidden honeypot field
  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json(
      { error: "Request blocked by spam protection." },
      { status: 400 }
    );
  }

  const powCheck = await verifyPowSolution(data.pow);
  if (!powCheck.valid) {
    return NextResponse.json(
      { error: powCheck.reason ?? "Security check failed. Please try again." },
      { status: 403 }
    );
  }

  const appSettings = await getAppSettings();
  if (!appSettings.publicCreationEnabled) {
    return NextResponse.json(
      { error: "Creating new public links is paused by the site owner right now." },
      { status: 403 }
    );
  }

  let customSlug: string | undefined;
  if (data.customSlug && data.customSlug.trim().length > 0) {
    if (!appSettings.allowPublicCustomSlugs) {
      return NextResponse.json(
        {
          error:
            "Custom endings are reserved for the site owner right now. Leave it blank for an automatic short link.",
        },
        { status: 403 }
      );
    }
    const slugCheck = validateCustomSlug(data.customSlug);
    if (!slugCheck.valid || !slugCheck.slug) {
      return NextResponse.json({ error: slugCheck.error }, { status: 400 });
    }
    if (await getLinkBySlug(slugCheck.slug)) {
      return NextResponse.json(
        { error: "That custom ending is already taken. Try another one." },
        { status: 409 }
      );
    }
    customSlug = slugCheck.slug;
  }

  const blockedDomains = await getBlockedDomainsList();
  const urlCheck = validateDestinationUrl(data.url, {
    requestHost: request.headers.get("host"),
    blockedDomains,
  });

  if (!urlCheck.valid || !urlCheck.url) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  const hours =
    data.expiresInHours === "default"
      ? appSettings.defaultPublicExpiryHours
      : data.expiresInHours;
  const expiresAt = Date.now() + hours * 60 * 60 * 1000;

  let created;
  try {
    created = await createLinkRecord({
      slug: customSlug,
      destinationUrl: urlCheck.url,
      ownerType: "public",
      redirectCode: 302,
      password: data.password?.trim() || null,
      expiresAt,
    });
  } catch (err) {
    if (err instanceof SlugTakenError) {
      return NextResponse.json(
        { error: "That custom ending is already taken. Try another one." },
        { status: 409 }
      );
    }
    throw err;
  }

  const baseUrl = resolveShortBaseUrl(request);
  const shortUrl = `${baseUrl}/${created.slug}`;
  const previewUrl = `${baseUrl}/${created.slug}+`;
  const qrSvg = await generateQrSvg(shortUrl);

  return NextResponse.json(
    {
      slug: created.slug,
      shortUrl,
      previewUrl,
      destinationUrl: created.destinationUrl,
      expiresAt: created.expiresAt,
      passwordProtected: Boolean(created.passwordHash),
      qrSvg,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
