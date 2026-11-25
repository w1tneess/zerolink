"use client";

import { useState } from "react";
import Link from "next/link";
import { ZeroLinkMark } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({
  active,
}: {
  active?: "home" | "report" | "admin";
  fullWidth?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Shorten", key: "home" as const, prefetch: true },
    { href: "/report", label: "Report", key: "report" as const, prefetch: true },
    { href: "/admin", label: "Owner", key: "admin" as const, prefetch: false },
  ];

  return (
    <>
      <div className="sticky top-4 z-40 mx-auto mt-4 flex w-full justify-center px-4">
        <header className="zl-glass-header flex items-center gap-2 rounded-full border border-[var(--bezel-ring)] p-2 shadow-[var(--shadow-ambient),inset_0_1px_0_var(--inner-highlight)]">
          <Link
            href="/"
            className="group inline-flex h-9 items-center gap-2 rounded-full pl-2.5 pr-3 text-sm font-semibold tracking-[-0.02em] text-[var(--text)] transition-transform duration-150 ease-[var(--ease-agency)] active:scale-[0.97]"
          >
            <ZeroLinkMark
              size={22}
              className="transition-transform duration-200 ease-[var(--ease-agency)] group-hover:scale-[1.06]"
            />
            <span>ZeroLink</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                prefetch={item.prefetch}
                aria-current={active === item.key ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-full px-4 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.97] ${
                  active === item.key
                    ? "bg-[var(--text)] font-medium text-[var(--bg)]"
                    : "text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Mobile Hamburger Morph */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-[var(--text)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.96] md:hidden dark:bg-white/10"
            >
              <span
                className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ease-[var(--ease-agency)] ${
                  menuOpen ? "translate-y-0 rotate-45" : "-translate-y-1"
                }`}
              />
              <span
                className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ease-[var(--ease-agency)] ${
                  menuOpen ? "translate-y-0 -rotate-45" : "translate-y-1"
                }`}
              />
            </button>
          </div>
        </header>
      </div>

      {/* Mobile Full-Screen Glass Overlay with Staggered Mask Reveal */}
      <div
        aria-hidden={!menuOpen}
        className={`zl-glass-header fixed inset-0 z-30 flex flex-col justify-center px-8 transition-opacity duration-200 ease-[var(--ease-agency)] md:hidden ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-6" aria-label="Mobile navigation">
          {navItems.map((item, idx) => (
            <div key={item.key} className="overflow-hidden">
              <Link
                href={item.href}
                prefetch={item.prefetch}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                style={{
                  transitionDelay: menuOpen ? `${40 + idx * 45}ms` : "0ms",
                }}
                className={`block text-3xl font-medium tracking-[-0.025em] transition-[transform,opacity] duration-300 ease-[var(--ease-agency)] ${
                  menuOpen
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                } ${
                  active === item.key
                    ? "text-[var(--accent-ink)]"
                    : "text-[var(--text)]"
                }`}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
