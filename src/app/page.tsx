import { SiteHeader } from "@/components/site-header";
import { ZeroLinkMark } from "@/components/brand-logo";
import { PublicShortener } from "@/components/public-shortener";
import { DoubleBezel } from "@/components/double-bezel";
import { Reveal } from "@/components/reveal";
import {
  IconClock,
  IconCookie,
  IconGlobe,
  IconHash,
  IconLink,
  IconShieldOff,
} from "@/components/icons";
import { getAppSettings } from "@/lib/links/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getAppSettings();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="home" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="py-12 md:py-24">
          <PublicShortener
            publicCreationEnabled={settings.publicCreationEnabled}
            defaultPublicExpiryHours={settings.defaultPublicExpiryHours}
            allowPublicCustomSlugs={settings.allowPublicCustomSlugs}
          />
        </section>

        {/* Asymmetrical Bento Privacy Architecture */}
        <section aria-labelledby="ledger-heading" className="py-24">
          <Reveal className="mb-10 space-y-3">
            <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
              Auditable storage
            </span>
            <h2
              id="ledger-heading"
              className="text-3xl font-medium tracking-[-0.025em] text-[var(--text)] sm:text-4xl"
            >
              Zero-telemetry ledger
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Every column stored in SQLite is visible below. Abuse rate limits
              run purely in RAM behind a 24-hour rotating HMAC key.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <Reveal delayMs={60} className="md:col-span-7">
              <DoubleBezel innerClassName="p-6 sm:p-8 h-full">
                <h3 className="mb-5 text-base font-medium text-[var(--text)]">
                  Stored per link
                </h3>
                <ul className="space-y-4 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconLink size={16} />
                    </span>
                    <span>
                      Exact destination URL stored verbatim, including query
                      strings and{" "}
                      <code className="font-mono text-xs text-[var(--text)]">
                        #fragments
                      </code>
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconClock size={16} />
                    </span>
                    <span>Creation and optional expiration timestamps</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconHash size={16} />
                    </span>
                    <span className="tabular-nums">
                      Anonymous integer click count (
                      {settings.anonymousClickCounting ? "enabled" : "disabled"})
                    </span>
                  </li>
                </ul>
              </DoubleBezel>
            </Reveal>

            <Reveal delayMs={140} className="md:col-span-5">
              <DoubleBezel innerClassName="p-6 sm:p-8 h-full">
                <h3 className="mb-5 text-base font-medium text-[var(--text)]">
                  Never collected
                </h3>
                <ul className="space-y-4 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconGlobe size={16} />
                    </span>
                    <span>Visitor IPs, User-Agents, or referrers</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconCookie size={16} />
                    </span>
                    <span>Tracking cookies or fingerprinters</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                      <IconShieldOff size={16} />
                    </span>
                    <span>Third-party analytics, ads, or external QR APIs</span>
                  </li>
                </ul>
              </DoubleBezel>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-[var(--text-muted)] sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ZeroLinkMark size={16} />
            <span>ZeroLink · MIT License</span>
          </span>
          <span className="font-mono">/&lt;slug&gt;+ to inspect any link</span>
        </div>
      </footer>
    </div>
  );
}
