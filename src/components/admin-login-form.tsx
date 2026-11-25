"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DoubleBezel } from "./double-bezel";
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
    <DoubleBezel innerClassName="p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
            <IconKey size={16} />
            <span>Owner workspace</span>
          </div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-[var(--text)]">
            Sign in
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Verified against{" "}
            <code className="font-mono text-xs text-[var(--text)]">
              ADMIN_PASSWORD_HASH
            </code>{" "}
            using a signed{" "}
            <code className="font-mono text-xs text-[var(--text)]">
              HttpOnly
            </code>{" "}
            cookie.
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
              id="admin-password"
              type={showPassword ? "text" : "password"}
              required
              autoFocus
              autoComplete="current-password"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "admin-password-error" : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
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
          disabled={loading}
          className="group inline-flex h-12 w-full items-center justify-between rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:opacity-50"
        >
          <span>{loading ? "Signing in..." : "Sign in"}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
            {loading ? <IconSpinner size={16} /> : <IconArrowRight size={16} />}
          </span>
        </button>

        <details className="pt-1 text-xs text-[var(--text-muted)]">
          <summary className="inline-flex min-h-8 cursor-pointer items-center text-[var(--text-secondary)] hover:text-[var(--text)]">
            Forgot owner password?
          </summary>
          <p className="mt-2 leading-5">
            Run{" "}
            <code className="font-mono text-[var(--text)]">
              npm run hash-password -- &quot;new-password&quot;
            </code>{" "}
            on the host, update{" "}
            <code className="font-mono text-[var(--text)]">
              ADMIN_PASSWORD_HASH
            </code>{" "}
            in <code className="font-mono text-[var(--text)]">.env</code>, and
            restart the server.
          </p>
        </details>
      </form>
    </DoubleBezel>
  );
}
