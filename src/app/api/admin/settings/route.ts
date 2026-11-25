import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAppSettings, updateAppSettings } from "@/lib/links/service";

const updateSettingsSchema = z.object({
  publicCreationEnabled: z.boolean().optional(),
  anonymousClickCounting: z.boolean().optional(),
  defaultPublicExpiryHours: z.number().int().min(1).max(8760).optional(),
  allowPublicCustomSlugs: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const current = await getAppSettings();
  return NextResponse.json(
    { settings: current },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings payload." },
      { status: 400 }
    );
  }

  const updated = await updateAppSettings(parsed.data);
  return NextResponse.json(
    { settings: updated },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
