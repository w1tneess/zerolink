import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { RESERVED_SLUGS } from "@/lib/security/slug-validator";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Match single-segment short link paths: /<slug>+ or /<slug>?preview=true
  if (pathname.length > 1) {
    const trimmed = pathname.slice(1);
    const isSingleSegment = !trimmed.includes("/");

    if (isSingleSegment) {
      const endsWithPlus = trimmed.endsWith("+") && trimmed.length > 1;
      const isPreviewQuery = searchParams.get("preview") === "true";

      if (endsWithPlus || isPreviewQuery) {
        const cleanSlug = endsWithPlus ? trimmed.slice(0, -1) : trimmed;
        if (cleanSlug && !RESERVED_SLUGS.has(cleanSlug.toLowerCase())) {
          const rewriteUrl = new URL(
            `/inspect/${encodeURIComponent(cleanSlug)}`,
            request.url
          );
          const response = NextResponse.rewrite(rewriteUrl);
          return applySecurityHeaders(response);
        }
      }
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
