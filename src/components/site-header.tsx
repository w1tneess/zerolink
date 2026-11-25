"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ZeroLinkMark } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({
  active,
}: {
  active?: "home" | "report" | "admin";
}) {
  const pathname = usePathname();
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const menuOpen = openAtPath === pathname;
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  const navItems: Array<{
    href: string;
    label: string;
    key: "home" | "report";
    prefetch: boolean;
  }> = [
    { href: "/", label: "Shorten", key: "home", prefetch: true },
    { href: "/report", label: "Report", key: "report", prefetch: true },
  ];

  useEffect(() => {
    const main = document.getElementById("main");
    const footer = document.querySelector("footer");

    if (!menuOpen) {
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      return;
    }

    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");
    firstMobileLinkRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenAtPath(null);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="zl-glass-header sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/88 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-6 px-[var(--gutter)]">
          <Link
            href="/"
            className="group inline-flex min-h-10 items-center gap-2.5 text-[15px] font-medium tracking-[-0.02em] text-[var(--text)] transition-opacity duration-150 hover:opacity-85"
          >
            <ZeroLinkMark
              size={22}
              className="transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-105"
            />
            <span>ZeroLink</span>
          </Link>

          <div className="flex items-center gap-6">
            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-6 md:flex"
            >
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch={item.prefetch}
                  aria-current={active === item.key ? "page" : undefined}
                  className={`zl-nav-draw inline-flex min-h-9 items-center py-1 text-sm ${
                    active === item.key
                      ? "font-medium text-[var(--text)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              <ThemeToggle />

              <button
                ref={toggleBtnRef}
                type="button"
                onClick={() =>
                  setOpenAtPath((prev) => (prev === pathname ? null : pathname))
                }
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav-overlay"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line-strong)] px-3 text-xs font-medium text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-elevated)] md:hidden"
              >
                <span>{menuOpen ? "Close" : "Menu"}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        id="mobile-nav-overlay"
        hidden={!menuOpen}
        className="fixed inset-x-0 top-16 bottom-0 z-30 flex flex-col justify-between overflow-y-auto overscroll-contain bg-[var(--bg)] px-[var(--gutter)] py-10 md:hidden"
      >
        <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
          {navItems.map((item, idx) => (
            <Link
              key={item.key}
              ref={idx === 0 ? firstMobileLinkRef : undefined}
              href={item.href}
              prefetch={item.prefetch}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => setOpenAtPath(null)}
              className={`border-b border-[var(--line)] pb-4 text-3xl font-medium tracking-[-0.03em] ${
                active === item.key
                  ? "text-[var(--accent-ink)]"
                  : "text-[var(--text)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-[var(--text-muted)]">
          No tracking cookies. Add + to any link to preview it first.
        </p>
      </div>
    </>
  );
}
