"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "./icons";

function subscribeToTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean | null {
  return null;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerSnapshot
  );

  function toggleTheme() {
    const root = document.documentElement;
    root.classList.add("theme-switching");

    const nextDark = !dark;
    if (nextDark) {
      root.classList.add("dark");
      try {
        localStorage.setItem("zerolink_theme", "dark");
      } catch {}
    } else {
      root.classList.remove("dark");
      try {
        localStorage.setItem("zerolink_theme", "light");
      } catch {}
    }

    // Flush style synchronously so all theme tokens commit without transition smear
    void root.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove("theme-switching");
      });
    });
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="zl-btn-ghost inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)]"
    >
      {dark === null ? (
        <span className="h-3.5 w-3.5 rounded-full bg-current opacity-25" />
      ) : dark ? (
        <IconSun size={15} />
      ) : (
        <IconMoon size={15} />
      )}
    </button>
  );
}
