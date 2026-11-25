import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resetDbForTesting } from "@/db";
import { hashPassword } from "@/lib/crypto";
import {
  issuePowChallenge,
  resetPowReplayCacheForTesting,
  solvePowChallenge,
} from "@/lib/pow";
import { resetRateLimiterForTesting } from "@/lib/rate-limit";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/auth";
import { exportLinksToCsv, parseLinksImport } from "@/lib/links/import-export";
import { proxy } from "@/proxy";
import { POST as shortenPost } from "@/app/api/shorten/route";
import { POST as reportPost } from "@/app/api/report/route";
import { GET as adminLinksGet, POST as adminLinksPost } from "@/app/api/admin/links/route";
import { PATCH as adminLinkPatch } from "@/app/api/admin/links/[id]/route";
import { GET as adminModGet } from "@/app/api/admin/moderation/route";
import { POST as adminModActionPost } from "@/app/api/admin/moderation/[id]/route";
import { GET as adminExportGet } from "@/app/api/admin/links/export/route";
import { GET as redirectGet } from "@/app/[slug]/route";
import InspectLinkPage from "@/app/inspect/[slug]/page";
import { getLinkBySlug } from "@/lib/links/service";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zerolink-test-"));
const testDbPath = path.join(tmpDir, "test.db");

beforeAll(() => {
  process.env.DATABASE_DRIVER = "sqlite";
  process.env.DATABASE_URL = testDbPath;
  process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
  process.env.POW_DIFFICULTY = "8";
  process.env.ADMIN_PASSWORD_HASH = hashPassword("super-secret-owner-pass");
  process.env.APP_BASE_URL = "https://short.test";
});

beforeEach(() => {
  resetPowReplayCacheForTesting();
  resetRateLimiterForTesting();
});

afterAll(() => {
  resetDbForTesting();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("API Integration & Dual-Mode Security", () => {
  it("blocks unauthenticated access to /api/admin/* with 401", async () => {
    const res1 = await adminLinksGet(
      new NextRequest("https://short.test/api/admin/links")
    );
    expect(res1.status).toBe(401);

    const res2 = await adminModGet(
      new NextRequest("https://short.test/api/admin/moderation")
    );
    expect(res2.status).toBe(401);

    const req = new NextRequest("https://short.test/api/admin/links/export?format=json");
    const res3 = await adminExportGet(req);
    expect(res3.status).toBe(401);
  });

  it("allows public link creation without auth and preserves complex URLs verbatim on redirect", async () => {
    const complexDest =
      "https://example.com/path%20with%20spaces?alpha=1&beta=two%2Fthree&gamma=4#anchor-section";
    const pow = solvePowChallenge(issuePowChallenge(8));

    const req = new NextRequest("https://short.test/api/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "short.test",
        origin: "https://short.test",
      },
      body: JSON.stringify({
        url: complexDest,
        expiresInHours: 24,
        website: "",
        pow,
      }),
    });

    const createRes = await shortenPost(req);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.slug).toMatch(/^[0-9a-zA-Z]{7,8}$/);
    expect(created.destinationUrl).toBe(complexDest);
    expect(created.qrSvg).toContain("<svg");

    // Redirect check
    const redirectReq = new NextRequest(`https://short.test/${created.slug}`);
    const redirectRes = await redirectGet(redirectReq, {
      params: Promise.resolve({ slug: created.slug }),
    });
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("location")).toBe(complexDest);
    expect(redirectRes.headers.get("cache-control")).toContain("no-store");

    // Preview / Inspect mode does not increment clicks or trigger redirect
    const beforeInspect = getLinkBySlug(created.slug);
    expect(beforeInspect?.clicks).toBe(1);

    const proxyRes = proxy(new NextRequest(`https://short.test/${created.slug}+`));
    expect(proxyRes.headers.get("x-middleware-rewrite")).toContain(
      `/inspect/${created.slug}`
    );

    await InspectLinkPage({
      params: Promise.resolve({ slug: created.slug }),
    });
    const afterInspect = getLinkBySlug(created.slug);
    expect(afterInspect?.clicks).toBe(1);
  });

  it("rejects honeypot-filled spam requests on /api/shorten", async () => {
    const pow = solvePowChallenge(issuePowChallenge(8));
    const req = new NextRequest("https://short.test/api/shorten", {
      method: "POST",
      headers: { "content-type": "application/json", host: "short.test" },
      body: JSON.stringify({
        url: "https://example.org/ok",
        website: "http://bot-filled-me.example",
        pow,
      }),
    });

    const res = await shortenPost(req);
    expect(res.status).toBe(400);
  });

  it("protects admin vanity links from being auto-flagged by public abuse reports", async () => {
    // Seed an admin link directly via service/DB after simulating session cookie check
    const token = createAdminSessionToken();
    expect(token).toBeTruthy();

    // Test via service + report route: create admin link using createLinkRecord
    const { createLinkRecord } = await import("@/lib/links/service");
    const adminLink = createLinkRecord({
      slug: "my-github",
      destinationUrl: "https://github.com/example?tab=stars#top",
      ownerType: "admin",
      redirectCode: 301,
    });

    const publicLink = createLinkRecord({
      slug: "pub1234",
      destinationUrl: "https://untrusted.example/offer",
      ownerType: "public",
      redirectCode: 302,
      expiresAt: Date.now() + 86_400_000,
    });

    // Public report against admin link must NOT flag or disable it
    const pow1 = solvePowChallenge(issuePowChallenge(8));
    const repAdminRes = await reportPost(
      new NextRequest("https://short.test/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slugOrUrl: adminLink.slug,
          reason: "spam",
          website: "",
          pow: pow1,
        }),
      })
    );
    expect(repAdminRes.status).toBe(201);
    expect(getLinkBySlug(adminLink.slug)?.status).toBe("active");

    // Public report against public link SHOULD flag it
    const pow2 = solvePowChallenge(issuePowChallenge(8));
    const repPubRes = await reportPost(
      new NextRequest("https://short.test/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slugOrUrl: publicLink.slug,
          reason: "phishing",
          website: "",
          pow: pow2,
        }),
      })
    );
    expect(repPubRes.status).toBe(201);
    expect(getLinkBySlug(publicLink.slug)?.status).toBe("flagged");
  });

  it("enforces redirect caching safety (no 301 when expiresAt or maxClicks is set)", async () => {
    const { createLinkRecord } = await import("@/lib/links/service");
    const capped = createLinkRecord({
      slug: "capped-link",
      destinationUrl: "https://example.com/limited",
      ownerType: "admin",
      redirectCode: 301, // should be coerced to 302
      maxClicks: 5,
    });

    expect(capped.redirectCode).toBe(302);
    const redirectRes = await redirectGet(
      new NextRequest("https://short.test/capped-link"),
      { params: Promise.resolve({ slug: "capped-link" }) }
    );
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("cache-control")).toContain("no-store");
  });

  it("neutralizes CSV formula injection on export and preserves round-trip", () => {
    const csv = exportLinksToCsv([
      {
        id: 1,
        slug: "formula-test",
        destinationUrl: "https://example.com/safe",
        ownerType: "admin",
        status: "active",
        redirectCode: 302,
        passwordHash: null,
        clicks: 0,
        maxClicks: null,
        expiresAt: null,
        note: "=CMD('calc')",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
      {
        id: 2,
        slug: "plus-note",
        destinationUrl: "https://example.com/ok",
        ownerType: "admin",
        status: "active",
        redirectCode: 302,
        passwordHash: null,
        clicks: 0,
        maxClicks: null,
        expiresAt: null,
        note: "+SUM(A1:A2)",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    ]);

    expect(csv).toContain("'=CMD('calc')");
    expect(csv).toContain("'+SUM(A1:A2)");

    const imported = parseLinksImport("csv", csv);
    expect(imported.errors).toHaveLength(0);
    expect(imported.rows[0].note).toBe("=CMD('calc')");
    expect(imported.rows[1].note).toBe("+SUM(A1:A2)");
  });

  it("rejects unrecognized CSV status values like flagged instead of coercing to active", () => {
    const csv = [
      "slug,destination_url,redirect_code,status,note",
      "bad-row,https://example.com/a,302,flagged,test",
      "good-row,https://example.com/b,302,,ok",
    ].join("\n");

    const imported = parseLinksImport("csv", csv);
    expect(imported.errors).toHaveLength(1);
    expect(imported.rows).toHaveLength(1);
    expect(imported.rows[0].slug).toBe("good-row");
    expect(imported.rows[0].status).toBe("active");
  });

  it("requires dismissed reportId to belong to the target link and preserves concurrent caps on note-only PATCH", async () => {
    const { createLinkRecord } = await import("@/lib/links/service");
    const { getDb } = await import("@/db");
    const { abuseReports, links } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const pubA = createLinkRecord({
      slug: "mod-a",
      destinationUrl: "https://example.com/mod-a",
      ownerType: "public",
      redirectCode: 302,
    });
    const pubB = createLinkRecord({
      slug: "mod-b",
      destinationUrl: "https://example.com/mod-b",
      ownerType: "public",
      redirectCode: 302,
    });

    const db = getDb();
    db.update(links).set({ status: "flagged" }).where(eq(links.id, pubA.id)).run();
    const repB = db
      .insert(abuseReports)
      .values({
        linkId: pubB.id,
        reason: "spam",
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const token = createAdminSessionToken();
    const wrongDismissReq = new NextRequest(
      `https://short.test/api/admin/moderation/${pubA.id}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
        },
        body: JSON.stringify({ action: "dismiss_report", reportId: repB.id }),
      }
    );
    const wrongRes = await adminModActionPost(wrongDismissReq, {
      params: Promise.resolve({ id: String(pubA.id) }),
    });
    expect(wrongRes.status).toBe(404);
    expect(getLinkBySlug(pubA.slug)?.status).toBe("flagged");

    // Note-only PATCH must preserve existing maxClicks
    const personal = createLinkRecord({
      slug: "note-patch",
      destinationUrl: "https://example.com/note",
      ownerType: "admin",
      maxClicks: 25,
      redirectCode: 302,
    });

    const patchReq = new NextRequest(
      `https://short.test/api/admin/links/${personal.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
        },
        body: JSON.stringify({ note: "Updated note only" }),
      }
    );
    const patchRes = await adminLinkPatch(patchReq, {
      params: Promise.resolve({ id: String(personal.id) }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.link.maxClicks).toBe(25);
    expect(patchBody.link.note).toBe("Updated note only");
  });

  it("allows public custom slugs by default, enforces uniqueness & validation, and respects admin toggle", async () => {
    const { updateAppSettings } = await import("@/lib/links/service");

    const pow1 = solvePowChallenge(issuePowChallenge(8));
    const createRes = await shortenPost(
      new NextRequest("https://short.test/api/shorten", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "short.test",
          origin: "https://short.test",
        },
        body: JSON.stringify({
          url: "https://example.com/launch-notes?v=1#intro",
          customSlug: "launch-2026",
          website: "",
          pow: pow1,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.slug).toBe("launch-2026");
    expect(created.shortUrl).toBe("https://short.test/launch-2026");

    const redirectRes = await redirectGet(
      new NextRequest("https://short.test/launch-2026"),
      { params: Promise.resolve({ slug: "launch-2026" }) }
    );
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("location")).toBe(
      "https://example.com/launch-notes?v=1#intro"
    );

    // Duplicate custom slug returns 409
    const pow2 = solvePowChallenge(issuePowChallenge(8));
    const dupRes = await shortenPost(
      new NextRequest("https://short.test/api/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", host: "short.test" },
        body: JSON.stringify({
          url: "https://example.com/other",
          customSlug: "launch-2026",
          website: "",
          pow: pow2,
        }),
      })
    );
    expect(dupRes.status).toBe(409);

    // Invalid / reserved custom slug returns 400
    const pow3 = solvePowChallenge(issuePowChallenge(8));
    const badSlugRes = await shortenPost(
      new NextRequest("https://short.test/api/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", host: "short.test" },
        body: JSON.stringify({
          url: "https://example.com/other",
          customSlug: "admin",
          website: "",
          pow: pow3,
        }),
      })
    );
    expect(badSlugRes.status).toBe(400);

    // Turning off allowPublicCustomSlugs blocks public custom slugs with 403
    await updateAppSettings({ allowPublicCustomSlugs: false });
    const pow4 = solvePowChallenge(issuePowChallenge(8));
    const disabledRes = await shortenPost(
      new NextRequest("https://short.test/api/shorten", {
        method: "POST",
        headers: { "content-type": "application/json", host: "short.test" },
        body: JSON.stringify({
          url: "https://example.com/other",
          customSlug: "another-slug",
          website: "",
          pow: pow4,
        }),
      })
    );
    expect(disabledRes.status).toBe(403);

    await updateAppSettings({ allowPublicCustomSlugs: true });
  });

  it("keeps unused helper imports exercised cleanly", () => {
    expect(ADMIN_SESSION_COOKIE).toBe("ls_admin_session");
    expect(typeof adminLinksPost).toBe("function");
  });
});
