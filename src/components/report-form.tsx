"use client";

import { useState, type FormEvent } from "react";
import { fetchAndSolvePow } from "@/lib/client-pow";
import { DoubleBezel } from "./double-bezel";
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
    <DoubleBezel innerClassName="p-6 sm:p-8">
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
            Short link or slug
          </label>
          <input
            id="slug-or-url"
            type="text"
            required
            placeholder="aB3x9Kq"
            value={slugOrUrl}
            onChange={(e) => setSlugOrUrl(e.target.value)}
            className="h-11 w-full rounded-xl bg-[var(--surface-elevated)] px-4 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="abuse-reason"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Category
          </label>
          <select
            id="abuse-reason"
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
            className="h-11 w-full rounded-xl bg-[var(--surface-elevated)] px-4 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
          >
            <option value="phishing">Phishing or credential theft</option>
            <option value="malware">Malware or harmful download</option>
            <option value="spam">Spam or unsolicited bulk links</option>
            <option value="illegal">Illegal content</option>
            <option value="other">Other abuse</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="abuse-details"
            className="block text-sm font-medium text-[var(--text)]"
          >
            Context
          </label>
          <textarea
            id="abuse-details"
            rows={3}
            maxLength={500}
            placeholder="Optional notes (max 500 chars)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-xl bg-[var(--surface-elevated)] p-4 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-[var(--negative-soft)] px-4 py-3 text-xs text-[var(--negative)] ring-1 ring-[var(--negative)]/20"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-[var(--positive-soft)] px-4 py-3 text-xs text-[var(--positive)] ring-1 ring-[var(--positive)]/20">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:opacity-50"
        >
          <span>{loading ? "Submitting..." : "Submit anonymous report"}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
            {loading ? <IconSpinner size={16} /> : <IconArrowRight size={16} />}
          </span>
        </button>
      </form>
    </DoubleBezel>
  );
}
