import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DoubleBezel } from "@/components/double-bezel";
import { Reveal } from "@/components/reveal";
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
  resolveSafeRedirectCode,
} from "@/lib/links/service";

export const dynamic = "force-dynamic";

export default async function InspectLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).replace(/\+$/, "");
  const link = getLinkBySlug(slug);
  const availability = checkLinkAvailability(link);

  const safeCode = link
    ? resolveSafeRedirectCode(
        link.redirectCode,
        link.expiresAt,
        link.maxClicks
      )
    : 302;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:py-24 sm:px-6">
        <Reveal>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 font-mono text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
              Inspection slip · /{slug}+
            </span>
            <Link
              href="/"
              className="text-xs font-medium text-[var(--text-secondary)] underline decoration-[var(--bezel-ring)] underline-offset-4 transition-colors duration-150 hover:text-[var(--text)]"
            >
              Shorten another URL
            </Link>
          </div>

          {!link ? (
            <DoubleBezel innerClassName="p-8">
              <h1 className="text-2xl font-medium tracking-[-0.02em] text-[var(--text)]">
                Short link not found
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                No active or archived link exists for{" "}
                <code className="font-mono text-[var(--text)]">/{slug}</code>.
              </p>
            </DoubleBezel>
          ) : (
            <DoubleBezel innerClassName="p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {link.ownerType === "admin" ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-ink)]">
                      <IconShield size={16} />
                      <span>Verified personal link</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
                      <IconGlobe size={16} />
                      <span>Public visitor link</span>
                    </span>
                  )}

                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      availability.available
                        ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                        : "bg-[var(--negative-soft)] text-[var(--negative)]"
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
                        : `Unavailable (${availability.reason.replace("_", " ")})`}
                    </span>
                  </span>

                  {link.passwordHash && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--text-secondary)] dark:bg-white/10">
                      <IconLock size={16} />
                      <span>Password required</span>
                    </span>
                  )}
                </div>

                <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                  HTTP {safeCode}
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="font-mono text-3xl font-medium tracking-[-0.02em] text-[var(--text)]">
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
                  Full destination URL
                </div>
                <p className="break-all rounded-xl bg-[var(--surface-elevated)] p-4 font-mono text-sm leading-6 text-[var(--text)] ring-1 ring-[var(--bezel-ring)]">
                  {link.destinationUrl}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--bezel-ring)]">
                  <dt className="text-xs text-[var(--text-muted)]">Created</dt>
                  <dd className="mt-2 font-mono text-sm tabular-nums text-[var(--text)]">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="rounded-xl bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--bezel-ring)]">
                  <dt className="text-xs text-[var(--text-muted)]">Expires</dt>
                  <dd className="mt-2 font-mono text-sm tabular-nums text-[var(--text)]">
                    {link.expiresAt
                      ? new Date(link.expiresAt).toLocaleDateString()
                      : "Never"}
                  </dd>
                </div>
                <div className="rounded-xl bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--bezel-ring)]">
                  <dt className="text-xs text-[var(--text-muted)]">Clicks</dt>
                  <dd className="mt-2 font-mono text-sm tabular-nums text-[var(--text)]">
                    {link.clicks}
                    {link.maxClicks ? ` / ${link.maxClicks}` : ""}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                {availability.available ? (
                  link.passwordHash ? (
                    <Link
                      href={`/unlock/${encodeURIComponent(link.slug)}`}
                      className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                    >
                      <span>Unlock destination</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
                        <IconArrowRight size={16} />
                      </span>
                    </Link>
                  ) : (
                    <a
                      href={link.destinationUrl}
                      rel="noopener noreferrer"
                      className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                    >
                      <span>Continue to destination</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
                        <IconArrowRight size={16} />
                      </span>
                    </a>
                  )
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">
                    Redirect paused ({availability.reason.replace("_", " ")})
                  </span>
                )}

                <Link
                  href={`/report?slug=${encodeURIComponent(link.slug)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-black/5 px-4 text-xs font-medium text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/10 hover:text-[var(--text)] active:scale-[0.97] dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <IconFlag size={16} />
                  <span>Report destination</span>
                </Link>
              </div>
            </DoubleBezel>
          )}
        </Reveal>
      </main>
    </div>
  );
}
