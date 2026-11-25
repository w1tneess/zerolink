import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { IconArrowRight } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col justify-center px-[var(--gutter)] py-20"
      >
        <div className="max-w-xl space-y-6">
          <div className="text-xs font-medium text-[var(--text-muted)]">
            Page not found
          </div>
          <h1 className="zl-display text-[var(--text)]">
            We couldn&apos;t find that link
          </h1>
          <p className="text-base leading-relaxed text-[var(--text-secondary)]">
            This short link may have expired, reached its visit limit, or never
            existed. Head back home or add{" "}
            <span className="font-medium text-[var(--accent-ink)]">+</span> to
            the end of another short link to preview where it goes.
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="zl-btn-primary inline-flex h-11 items-center gap-3 rounded-lg px-5 text-sm font-medium"
            >
              <span>Back to home</span>
              <span className="zl-btn-arrow inline-flex items-center">
                <IconArrowRight size={15} />
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
