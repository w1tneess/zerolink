"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
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
        passwordInputRef.current?.focus();
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
    <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8">
      <form onSubmit={handleUnlock} className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-muted)]">
            <IconLock size={14} />
            <span>/{slug}</span>
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.025em] text-[var(--text)]">
            Password required
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            This link is protected. Enter the password to open it.
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
              ref={passwordInputRef}
              id="unlock-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="off"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "unlock-password-error" : undefined}
              placeholder="Link password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] pl-4 pr-12 text-base text-[var(--text)] placeholder:text-[var(--text-muted)] sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-[var(--text-muted)] transition-[color,background-color,transform] duration-150 hover:scale-105 hover:bg-[var(--surface-hover)]/70 hover:text-[var(--text)]"
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

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <button
            type="submit"
            aria-disabled={loading}
            className="zl-btn-primary inline-flex h-11 items-center gap-3 rounded-lg px-5 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            <span>{loading ? "Verifying" : "Continue"}</span>
            <span className="zl-btn-arrow inline-flex items-center">
              {loading ? <IconSpinner size={15} /> : <IconArrowRight size={15} />}
            </span>
          </button>

          <Link
            href={`/${encodeURIComponent(slug)}+`}
            className="zl-inline-link inline-flex min-h-9 items-center text-xs text-[var(--text-secondary)]"
          >
            Preview link
          </Link>
        </div>
      </form>
    </div>
  );
}
