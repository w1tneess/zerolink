"use client";

import { useRef, useState, type FormEvent } from "react";
import { fetchAndSolvePow } from "@/lib/client-pow";
import { IconArrowRight, IconSpinner } from "./icons";

export function ReportForm({ initialSlug = "" }: { initialSlug?: string }) {
  const [slugOrUrl, setSlugOrUrl] = useState(initialSlug);
  const [reason, setReason] = useState<
    "phishing" | "malware" | "spam" | "illegal" | "other"
  >("phishing");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const pow = await fetchAndSolvePow();
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugOrUrl: slugOrUrl.trim(),
          reason,
          details: details.trim() || undefined,
          website,
          pow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit report");
        slugInputRef.current?.focus();
        return;
      }
      setSuccess(data.message);
      setSlugOrUrl("");
      setDetails("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4 text-xs">
        <span className="truncate font-mono text-[var(--text)]">
          /{slugOrUrl.trim().replace(/^\/+/, "") || "short-link"}
        </span>
        <span className="shrink-0 text-[var(--accent-ink)]">
          Private review
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="report-website-hp">Website</label>
          <input
            id="report-website-hp"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="slug-or-url"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Short link or ending
          </label>
          <input
            ref={slugInputRef}
            id="slug-or-url"
            name="slugOrUrl"
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "report-error" : undefined}
            placeholder="e.g. a8kP2m or full short link"
            value={slugOrUrl}
            onChange={(e) => {
              setSlugOrUrl(e.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-4 font-mono text-base text-[var(--text)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent-ink)] sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="abuse-reason"
            className="block text-sm font-medium text-[var(--text)]"
          >
            What&apos;s the issue?
          </label>
          <select
            id="abuse-reason"
            name="reason"
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value as
                  | "phishing"
                  | "malware"
                  | "spam"
                  | "illegal"
                  | "other"
              )
            }
            className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-4 text-base text-[var(--text)] focus:border-[var(--accent-ink)] sm:text-sm"
          >
            <option value="phishing">Scam or fake login page</option>
            <option value="malware">Harmful download or virus</option>
            <option value="spam">Spam or unwanted messages</option>
            <option value="illegal">Illegal or harmful content</option>
            <option value="other">Something else</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="abuse-details"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Extra details (optional)
          </label>
          <textarea
            id="abuse-details"
            name="details"
            rows={3}
            maxLength={500}
            placeholder="Share any helpful context (up to 500 characters)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] p-4 text-base text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-ink)] sm:text-sm"
          />
        </div>

        {error && (
          <div
            id="report-error"
            role="alert"
            className="rounded-lg border border-[var(--negative)]/40 bg-[var(--negative-soft)] px-4 py-3 text-xs text-[var(--negative)]"
          >
            {error}
          </div>
        )}

        <div role="status" className={success ? "rounded-lg border border-[var(--positive)]/40 bg-[var(--positive-soft)] px-4 py-3 text-xs text-[var(--positive)]" : "sr-only"}>
          {success ?? ""}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <button
            type="submit"
            aria-disabled={loading}
            className="zl-btn-primary inline-flex h-11 items-center gap-3 rounded-lg px-5 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            <span>{loading ? "Sending..." : "Send anonymous report"}</span>
            <span className="zl-btn-arrow inline-flex items-center">
              {loading ? <IconSpinner size={15} /> : <IconArrowRight size={15} />}
            </span>
          </button>

          <span className="text-xs text-[var(--text-muted)]">
            No personal details saved
          </span>
        </div>
      </form>
    </div>
  );
}
