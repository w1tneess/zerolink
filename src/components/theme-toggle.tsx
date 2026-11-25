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
    const nextDark = !dark;
    if (nextDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("zerolink_theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("zerolink_theme", "light");
      } catch {}
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/10 hover:text-[var(--text)] active:scale-[0.96] dark:bg-white/10 dark:hover:bg-white/15"
    >
      {dark === null ? (
        <span className="h-3.5 w-3.5 rounded-full bg-current opacity-20" />
      ) : dark ? (
        <IconSun size={16} />
      ) : (
        <IconMoon size={16} />
      )}
    </button>
  );
}
