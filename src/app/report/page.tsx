import { SiteHeader } from "@/components/site-header";
import { ReportForm } from "@/components/report-form";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="report" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:py-24 sm:px-6">
        <Reveal>
          <div className="mb-8 space-y-4">
            <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
              Community safety
            </span>
            <h1 className="text-3xl font-medium tracking-[-0.025em] text-[var(--text)] sm:text-5xl">
              Report an abusive link
            </h1>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Flag phishing, malware, or spam links for administrator review. No
              account is required, and no IP address or identity is stored.
            </p>
          </div>

          <ReportForm initialSlug={slug ?? ""} />
        </Reveal>
      </main>
    </div>
  );
}
