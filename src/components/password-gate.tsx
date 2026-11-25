"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { DoubleBezel } from "./double-bezel";
import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconLock,
  IconSpinner,
} from "./icons";

export function PasswordGate({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/links/${encodeURIComponent(slug)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect password");
        return;
      }
      window.location.assign(data.destinationUrl);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DoubleBezel innerClassName="p-6 sm:p-8">
      <form onSubmit={handleUnlock} className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 font-mono text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
            <IconLock size={16} />
            <span>/{slug}</span>
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-[var(--text)]">
            Password required
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Enter the link password to continue to the destination.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="unlock-password"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="unlock-password"
              type={showPassword ? "text" : "password"}
              required
              autoFocus
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "unlock-password-error" : undefined}
              placeholder="Link password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="h-11 w-full rounded-xl bg-[var(--surface-elevated)] pl-4 pr-12 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]"
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>

          {error && (
            <p
              id="unlock-password-error"
              role="alert"
              className="pt-1 text-xs text-[var(--negative)]"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:opacity-50"
          >
            <span>{loading ? "Verifying..." : "Continue"}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
              {loading ? <IconSpinner size={16} /> : <IconArrowRight size={16} />}
            </span>
          </button>

          <Link
            href={`/${encodeURIComponent(slug)}+`}
            className="inline-flex min-h-11 items-center text-xs text-[var(--text-secondary)] underline decoration-[var(--bezel-ring)] underline-offset-4 transition-colors duration-150 hover:text-[var(--text)]"
          >
            Inspect /{slug}+
          </Link>
        </div>
      </form>
    </DoubleBezel>
  );
}
