import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  IconArrowRight,
  IconFlag,
  IconGlobe,
  IconLock,
  IconShield,
} from "@/components/icons";
import {
  checkLinkAvailability,
  getLinkBySlug,
} from "@/lib/links/service";
import { safeDecodeURIComponent } from "@/lib/security/slug-validator";

export const dynamic = "force-dynamic";

const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = safeDecodeURIComponent(rawSlug).replace(/\+$/, "");
  return {
    title: `Preview /${slug}`,
    description: `Check where /${slug} goes, who created it, and when it expires before opening it.`,
  };
}

const REASON_LABELS: Record<string, string> = {
  not_found: "not found",
  disabled: "paused by owner",
  flagged: "under safety review",
  expired: "expired",
  max_clicks: "visit limit reached",
};

export default async function InspectLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = safeDecodeURIComponent(rawSlug).replace(/\+$/, "");
  const link = getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);
  const reasonLabel = !availability.available
    ? (REASON_LABELS[availability.reason] ?? availability.reason.replace("_", " "))
    : "";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-[var(--gutter)] py-12 md:py-20"
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Safe link preview
          </span>
          <Link
            href="/"
            className="zl-inline-link inline-flex min-h-9 items-center text-xs font-medium text-[var(--text-secondary)]"
          >
            Shorten another link
          </Link>
        </div>

        {!link ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8">
            <h1 className="text-2xl font-medium tracking-[-0.025em] text-[var(--text)]">
              Link not found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              We couldn&apos;t find a short link for{" "}
              <span className="font-mono text-[var(--text)]">/{slug}</span>. It
              may have expired or been removed.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {link.ownerType === "admin" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-ink)]/30 bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-ink)]">
                    <IconShield size={14} />
                    <span>Verified owner link</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    <IconGlobe size={14} />
                    <span>Public link</span>
                  </span>
                )}

                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                    availability.available
                      ? "border-[var(--positive)]/30 bg-[var(--positive-soft)] text-[var(--positive)]"
                      : "border-[var(--negative)]/30 bg-[var(--negative-soft)] text-[var(--negative)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      availability.available
                        ? "bg-[var(--positive)]"
                        : "bg-[var(--negative)]"
                    }`}
                  />
                  <span>
                    {availability.available
                      ? "Active"
                      : `Unavailable (${reasonLabel})`}
                  </span>
                </span>

                {link.passwordHash && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                    <IconLock size={14} />
                    <span>Password required</span>
                  </span>
                )}
              </div>

              <span className="text-xs text-[var(--text-muted)]">
                No visit counted yet
              </span>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="space-y-2">
                <h1 className="break-all font-mono text-2xl font-medium tracking-[-0.02em] text-[var(--text)] sm:text-3xl">
                  /{link.slug}
                </h1>
                {link.note && link.ownerType === "admin" && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    {link.note}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Takes you to
                </div>
                <p className="break-all rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-4 font-mono text-sm leading-6 text-[var(--text)]">
                  {link.destinationUrl}
                </p>
              </div>

              <dl className="grid grid-cols-1 divide-y divide-[var(--line)] border-y border-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="py-4 sm:pr-4">
                  <dt className="text-xs text-[var(--text-muted)]">Created</dt>
                  <dd className="mt-1.5 text-sm font-medium tabular-nums text-[var(--text)]">
                    {utcDateFormatter.format(link.createdAt)}
                  </dd>
                </div>
                <div className="py-4 sm:px-6">
                  <dt className="text-xs text-[var(--text-muted)]">Expires</dt>
                  <dd className="mt-1.5 text-sm font-medium tabular-nums text-[var(--text)]">
                    {link.expiresAt
                      ? utcDateFormatter.format(link.expiresAt)
                      : "Never"}
                  </dd>
                </div>
                <div className="py-4 sm:pl-6">
                  <dt className="text-xs text-[var(--text-muted)]">Visits</dt>
                  <dd className="mt-1.5 text-sm font-medium tabular-nums text-[var(--text)]">
                    {link.clicks}
                    {link.maxClicks ? ` / ${link.maxClicks}` : ""}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                {availability.available ? (
                  link.passwordHash ? (
                    <Link
                      href={`/unlock/${encodeURIComponent(link.slug)}`}
                      className="zl-btn-primary inline-flex h-11 items-center gap-3 rounded-lg px-5 text-sm font-medium"
                    >
                      <span>Unlock link</span>
                      <span className="zl-btn-arrow inline-flex items-center">
                        <IconArrowRight size={15} />
                      </span>
                    </Link>
                  ) : (
                    <a
                      href={link.destinationUrl}
                      rel="noopener noreferrer"
                      className="zl-btn-primary inline-flex h-11 items-center gap-3 rounded-lg px-5 text-sm font-medium"
                    >
                      <span>Open destination</span>
                      <span className="zl-btn-arrow inline-flex items-center">
                        <IconArrowRight size={15} />
                      </span>
                    </a>
                  )
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">
                    This link is currently unavailable ({reasonLabel}).
                  </span>
                )}

                <Link
                  href={`/report?slug=${encodeURIComponent(link.slug)}`}
                  className="zl-btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  <IconFlag size={15} />
                  <span>Report this link</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
