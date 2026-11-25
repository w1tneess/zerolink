"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconKey,
  IconSpinner,
} from "./icons";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed");
        passwordInputRef.current?.focus();
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
            <IconKey size={14} />
            <span>Owner workspace</span>
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.025em] text-[var(--text)]">
            Sign in
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Enter your owner password to manage saved links, review reports, and
            update site settings.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="admin-password"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Owner password
          </label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "admin-password-error" : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
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
              id="admin-password-error"
              role="alert"
              className="pt-1 text-xs text-[var(--negative)]"
            >
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          aria-disabled={loading}
          className="zl-btn-primary inline-flex h-11 w-full items-center justify-between rounded-lg px-5 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          <span>{loading ? "Signing in" : "Sign in"}</span>
          <span className="zl-btn-arrow inline-flex items-center">
            {loading ? <IconSpinner size={15} /> : <IconArrowRight size={15} />}
          </span>
        </button>

        <details className="pt-1 text-xs text-[var(--text-muted)]">
          <summary className="inline-flex min-h-8 cursor-pointer items-center text-[var(--text-secondary)] hover:text-[var(--text)]">
            Forgot your password?
          </summary>
          <p className="mt-2 leading-5">
            Your owner password is stored on the server hosting this site. Ask
            your server administrator or update the saved password in your
            server configuration and restart the app.
          </p>
        </details>

        <div className="border-t border-[var(--line)] pt-4 text-xs leading-relaxed text-[var(--text-muted)]">
          Links created inside your workspace stay permanent, won&apos;t be
          paused by public reports, and can be exported anytime.
        </div>
      </form>
    </div>
  );
}
