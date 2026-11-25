import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listAllPublicAndFlaggedLinks } from "@/lib/links/service";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { publicLinks, reports } = listAllPublicAndFlaggedLinks();

  return NextResponse.json(
    {
      publicLinks: publicLinks.map((l) => ({
        id: l.id,
        slug: l.slug,
        destinationUrl: l.destinationUrl,
        status: l.status,
        clicks: l.clicks,
        expiresAt: l.expiresAt,
        passwordProtected: Boolean(l.passwordHash),
        createdAt: l.createdAt,
      })),
      reports,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
