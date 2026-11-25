import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ReportForm } from "@/components/report-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report a link",
  description:
    "Let the site owner know about unsafe, scam, or spam short links privately with no tracking.",
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="report" />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-[var(--gutter)] py-12 md:py-20"
      >
        <div className="mb-8 space-y-3">
          <h1
            data-split="lines"
            data-intro
            className="text-3xl font-medium tracking-[-0.03em] text-[var(--text)] sm:text-5xl"
          >
            Report an unsafe link
          </h1>
          <p className="max-w-[54ch] text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Let the site owner know about scams, harmful downloads, or spam. No
            account is needed, and none of your personal details are saved.
          </p>
        </div>

        <ReportForm initialSlug={slug ?? ""} />
      </main>
    </div>
  );
}
