import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ZeroLinkMark } from "@/components/brand-logo";
import { PublicShortener } from "@/components/public-shortener";
import { QuickInspect } from "@/components/quick-inspect";
import { getAppSettings } from "@/lib/links/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getAppSettings();

  const promiseRows = [
    {
      topic: "Full link kept exact",
      badge: "Nothing stripped",
      detail:
        "Everything in your web address stays intact — page sections, search filters, and special details arrive just as you pasted them.",
    },
    {
      topic: "Automatic expiration",
      badge: "Your choice",
      detail:
        "Choose whether a public link lasts 24 hours, 7 days, or 30 days. Once time is up, the link stops working cleanly.",
    },
    {
      topic: "Simple visit counts",
      badge: settings.anonymousClickCounting
        ? "Numbers only"
        : "Counting paused",
      detail: settings.anonymousClickCounting
        ? "Each visit adds one to a plain total count — we never record IP addresses, device info, location, or where visitors came from."
        : "Visit counting is currently turned off by the site owner, so even total click numbers aren't tracked.",
    },
    {
      topic: "Quiet spam protection",
      badge: "Built in",
      detail:
        "Keeps automated bots out automatically in the background, without annoying picture puzzles or outside trackers.",
    },
    {
      topic: "QR codes & previews",
      badge: "Ready to share",
      detail:
        "Every short link comes with a downloadable QR code and a safe preview page so anyone can verify where it leads first.",
    },
  ];

  const heroHeader = (
    <div className="space-y-6">
      <h1
        data-split="lines"
        data-intro
        className="zl-display ml-[-0.02em] text-[var(--text)]"
      >
        Shorten any link. Check where it goes.
      </h1>
      <p
        data-split="lines"
        data-delay="0.08"
        data-intro
        className="max-w-[54ch] text-base leading-[1.65] text-[var(--text-secondary)] sm:text-[17px]"
      >
        Turn long, messy web addresses into clean short links in seconds. No
        account needed, no tracking cookies, and anyone can add{" "}
        <span className="inline-flex items-center rounded bg-[var(--accent-soft)] px-1.5 py-0.5 font-medium text-[var(--accent-ink)]">
          +
        </span>{" "}
        to the end of a link to preview where it leads first.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="home" />

      <main id="main" tabIndex={-1} className="flex-1">
        {/* Section 1: Hero Shortener + Live Link Preview */}
        <section className="mx-auto max-w-[1360px] px-[var(--gutter)] pt-12 pb-20 md:pt-20 md:pb-28">
          <PublicShortener
            heroHeader={heroHeader}
            publicCreationEnabled={settings.publicCreationEnabled}
            defaultPublicExpiryHours={settings.defaultPublicExpiryHours}
            allowPublicCustomSlugs={settings.allowPublicCustomSlugs}
          />
        </section>

        {/* Section 2: Statement + Simple Facts Strip */}
        <section
          aria-labelledby="statement-heading"
          className="border-t border-[var(--line)] bg-[var(--surface)]/45"
        >
          <div className="mx-auto max-w-[1360px] px-[var(--gutter)] py-20 md:py-28">
            <h2
              id="statement-heading"
              data-reveal="up"
              className="max-w-3xl text-3xl font-medium tracking-[-0.025em] leading-[1.12] text-[var(--text)] sm:text-4xl lg:text-[2.6rem]"
            >
              Short links shouldn&apos;t spy on the people who click them.
            </h2>

            <dl
              data-reveal="up"
              data-delay="0.1"
              className="mt-12 grid grid-cols-2 gap-y-8 border-t border-[var(--line)] pt-8 md:grid-cols-4 md:gap-x-8"
            >
              <div>
                <dd className="text-3xl font-medium tabular-nums tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
                  0
                </dd>
                <dt className="mt-2 text-sm text-[var(--text-secondary)]">
                  Tracking cookies
                </dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
                  0
                </dd>
                <dt className="mt-2 text-sm text-[var(--text-secondary)]">
                  Visitor details saved
                </dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums tracking-[-0.03em] text-[var(--text)] sm:text-4xl">
                  0
                </dd>
                <dt className="mt-2 text-sm text-[var(--text-secondary)]">
                  Sign-ups or pop-up puzzles
                </dt>
              </div>
              <div>
                <dd className="text-3xl font-medium tabular-nums tracking-[-0.03em] text-[var(--accent-ink)] sm:text-4xl">
                  100%
                </dd>
                <dt className="mt-2 text-sm text-[var(--text-secondary)]">
                  Original link kept intact
                </dt>
              </div>
            </dl>
          </div>
        </section>

        {/* Section 3: How Your Links Work */}
        <section
          aria-labelledby="ledger-heading"
          className="border-t border-[var(--line)]"
        >
          <div className="mx-auto max-w-[1360px] px-[var(--gutter)] py-20 md:py-28">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <h2
                id="ledger-heading"
                data-reveal="up"
                className="text-2xl font-medium tracking-[-0.025em] text-[var(--text)] sm:text-3xl"
              >
                How your links work
              </h2>
              <p className="max-w-md text-sm text-[var(--text-secondary)]">
                Clear, honest defaults for every link you shorten or visit — with
                no hidden trackers or outside services.
              </p>
            </div>

            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {promiseRows.map((row) => (
                <li
                  key={row.topic}
                  className="zl-index-row grid grid-cols-1 gap-2 py-5 md:grid-cols-12 md:items-baseline md:gap-6"
                >
                  <div className="text-sm font-medium text-[var(--text)] md:col-span-3">
                    {row.topic}
                  </div>
                  <div className="text-xs font-medium text-[var(--accent-ink)] md:col-span-3">
                    {row.badge}
                  </div>
                  <div className="text-sm leading-relaxed text-[var(--text-secondary)] md:col-span-6">
                    {row.detail}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section 4: Direct Preview Strip */}
        <section
          aria-labelledby="inspect-strip-heading"
          className="border-t border-[var(--line)] bg-[var(--surface)]/45"
        >
          <div className="mx-auto grid max-w-[1360px] grid-cols-1 gap-8 px-[var(--gutter)] py-16 md:grid-cols-12 md:items-center md:py-20">
            <div className="space-y-2 md:col-span-6">
              <h2
                id="inspect-strip-heading"
                className="text-xl font-medium tracking-[-0.02em] text-[var(--text)] sm:text-2xl"
              >
                Check any short link before opening it
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                See the full destination, who created it, and when it expires
                without actually visiting the page.
              </p>
            </div>
            <div className="md:col-span-6">
              <QuickInspect />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1360px] flex-col justify-between gap-6 px-[var(--gutter)] py-10 sm:flex-row sm:items-end">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2.5 text-lg font-medium tracking-[-0.025em] text-[var(--text)]">
              <ZeroLinkMark size={20} />
              <span>ZeroLink</span>
            </span>
            <p className="text-xs text-[var(--text-muted)]">
              Simple, private link sharing — open-source and free of trackers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[var(--text-secondary)]">
            <Link
              href="/report"
              className="zl-nav-draw inline-flex min-h-9 items-center py-1 hover:text-[var(--text)]"
            >
              Report a link
            </Link>
            <Link
              href="/admin"
              className="zl-nav-draw inline-flex min-h-9 items-center py-1 hover:text-[var(--text)]"
            >
              Owner sign in
            </Link>
            <span className="text-[var(--text-muted)]">
              Tip: add + to any short link to preview it
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
