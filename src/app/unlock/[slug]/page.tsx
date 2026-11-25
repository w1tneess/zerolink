import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PasswordGate } from "@/components/password-gate";
import { IconArrowRight } from "@/components/icons";
import { checkLinkAvailability, getLinkBySlug } from "@/lib/links/service";
import { safeDecodeURIComponent } from "@/lib/security/slug-validator";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = safeDecodeURIComponent(rawSlug);
  return {
    title: `Unlock /${slug}`,
    description: "Enter the link password to continue to the destination.",
  };
}

const UNLOCK_REASON_TEXT: Record<string, string> = {
  not_found: "doesn't exist or was removed",
  disabled: "was paused by the site owner",
  flagged: "is paused while being reviewed for safety",
  expired: "has expired",
  max_clicks: "has reached its visit limit",
};

export default async function UnlockPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = safeDecodeURIComponent(rawSlug);
  const link = getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);
  const unavailableReason = !availability.available
    ? (UNLOCK_REASON_TEXT[availability.reason] ?? "is no longer available")
    : "";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-md flex-1 px-[var(--gutter)] py-12 md:py-24"
      >
        {!availability.available ? (
          <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8">
            <div className="font-mono text-xs text-[var(--text-muted)]">
              /{slug}
            </div>
            <h1 className="mt-2 text-2xl font-medium tracking-[-0.025em] text-[var(--text)]">
              Link unavailable
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              This short link can&apos;t be opened because it{" "}
              {unavailableReason}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="zl-btn-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-medium"
              >
                <span>Back to home</span>
                <span className="zl-btn-arrow inline-flex items-center">
                  <IconArrowRight size={14} />
                </span>
              </Link>
              <Link
                href={`/${encodeURIComponent(slug)}+`}
                className="zl-btn-ghost inline-flex h-10 items-center rounded-lg px-4 text-xs font-medium"
              >
                Preview link
              </Link>
            </div>
          </div>
        ) : (
          <PasswordGate slug={availability.link.slug} />
        )}
      </main>
    </div>
  );
}
