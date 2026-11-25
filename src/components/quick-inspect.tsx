"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "./icons";

export function QuickInspect() {
  const router = useRouter();
  const [slugInput, setSlugInput] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let cleaned = slugInput
      .trim()
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^[a-z0-9.-]+\.[a-z]{2,}\//i, "")
      .replace(/^\/+/, "");
    cleaned = cleaned.replace(/^(?:inspect|unlock)\//i, "").replace(/\+$/, "");
    cleaned = cleaned.split(/[?#]/)[0] ?? "";
    if (!cleaned) return;
    router.push(`/${encodeURIComponent(cleaned)}+`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div className="flex h-11 flex-1 items-center rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 transition-colors focus-within:border-[var(--accent-ink)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent-ink)]">
        <span
          aria-hidden="true"
          className="select-none pr-1 font-mono text-sm text-[var(--text-muted)]"
        >
          /
        </span>
        <label htmlFor="quick-inspect-slug" className="sr-only">
          Short link or ending to preview
        </label>
        <input
          id="quick-inspect-slug"
          name="slug"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="my-short-link"
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-base text-[var(--text)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus-visible:outline-none sm:text-sm"
        />
        <span
          aria-hidden="true"
          className="select-none pl-1 font-mono text-sm text-[var(--accent-ink)]"
        >
          +
        </span>
      </div>

      <button
        type="submit"
        className="zl-btn-ghost inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium"
      >
        <span>Preview link</span>
        <IconArrowRight size={15} />
      </button>
    </form>
  );
}
