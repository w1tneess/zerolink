"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { fetchAndSolvePow } from "@/lib/client-pow";
import { validateCustomSlug } from "@/lib/security/slug-validator";
import { DoubleBezel } from "./double-bezel";
import { Reveal } from "./reveal";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconDownload,
  IconLock,
  IconSliders,
  IconSpinner,
} from "./icons";

interface PublicShortenerProps {
  publicCreationEnabled: boolean;
  defaultPublicExpiryHours: number;
  allowPublicCustomSlugs: boolean;
}

interface ShortenResponse {
  slug: string;
  shortUrl: string;
  previewUrl: string;
  destinationUrl: string;
  expiresAt: number | null;
  passwordProtected: boolean;
  qrSvg: string;
}

function inspectDraftUrl(raw: string) {
  const sample = "https://docs.example.org/spec?ref=audit&v=2#routing";
  const target = raw.trim() || sample;
  const isSample = raw.trim().length === 0;
  try {
    const u = new URL(target);
    return {
      isSample,
      host: u.host,
      query: u.search || "None",
      fragment: u.hash || "None",
      valid: u.protocol === "http:" || u.protocol === "https:",
    };
  } catch {
    return {
      isSample,
      host: "Awaiting valid http(s) URL",
      query: "—",
      fragment: "—",
      valid: false,
    };
  }
}

export function PublicShortener({
  publicCreationEnabled,
  defaultPublicExpiryHours,
  allowPublicCustomSlugs,
}: PublicShortenerProps) {
  const [url, setUrl] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<
    "default" | "24" | "168" | "720"
  >("default");
  const [password, setPassword] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [showOptions, setShowOptions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortenResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const draft = useMemo(() => inspectDraftUrl(url), [url]);
  const trimmedCustomSlug = customSlug.trim();
  const customSlugValidation = useMemo(
    () => (trimmedCustomSlug ? validateCustomSlug(trimmedCustomSlug) : null),
    [trimmedCustomSlug]
  );
  const customSlugInvalid = Boolean(
    allowPublicCustomSlugs &&
      customSlugValidation &&
      !customSlugValidation.valid
  );
  const previewSlug =
    allowPublicCustomSlugs && trimmedCustomSlug ? trimmedCustomSlug : "a8kP2m";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!publicCreationEnabled) return;

    if (customSlugInvalid) {
      setError(customSlugValidation?.error ?? "Invalid custom slug.");
      return;
    }

    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);
    setStatusMsg("Solving local SHA-256 check");

    try {
      const pow = await fetchAndSolvePow();
      setStatusMsg("Saving link");

      const expiryPayload =
        expiresInHours === "default"
          ? "default"
          : (Number(expiresInHours) as 24 | 168 | 720);

      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          expiresInHours: expiryPayload,
          password: password || undefined,
          customSlug:
            allowPublicCustomSlugs && trimmedCustomSlug
              ? trimmedCustomSlug
              : undefined,
          website,
          pow,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to shorten URL");
        return;
      }

      setResult(data as ShortenResponse);
      setUrl("");
      setPassword("");
      setCustomSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      setStatusMsg(null);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleDownloadQr() {
    if (!result) return;
    const blob = new Blob([result.qrSvg], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${result.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  const defaultDays = Math.round(defaultPublicExpiryHours / 24);

  return (
    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12 md:gap-12">
      {/* Editorial Split Left: Massive Display Type + Double-Bezel Shortener */}
      <Reveal className="space-y-8 md:col-span-7">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span>Zero-telemetry routing</span>
          </span>

          <h1 className="text-4xl font-medium tracking-[-0.03em] leading-[1.02] text-[var(--text)] sm:text-5xl lg:text-[3.5rem]">
            Inspect every link before you click
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            Anonymous short URLs with zero tracking cookies and zero third-party
            requests. Query parameters and{" "}
            <code className="font-mono text-[0.9em] text-[var(--text)]">
              #fragments
            </code>{" "}
            stay verbatim, and appending{" "}
            <code className="font-mono text-[0.9em] text-[var(--accent-ink)]">
              +
            </code>{" "}
            reveals the destination.
          </p>
        </div>

        <DoubleBezel innerClassName="p-6">
          {!publicCreationEnabled ? (
            <div className="rounded-xl bg-[var(--surface-elevated)] p-5 text-sm text-[var(--text-secondary)]">
              Public link creation is paused by the owner. Existing links and{" "}
              <code className="font-mono text-xs text-[var(--text)]">
                /slug+
              </code>{" "}
              inspection slips remain active.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Honeypot */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="website-hp">Website</label>
                <input
                  id="website-hp"
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
                  htmlFor="destination-url"
                  className="block text-sm font-medium text-[var(--text)]"
                >
                  Destination URL
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id="destination-url"
                    type="url"
                    required
                    placeholder="https://example.com/docs?a=1#section"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 flex-1 rounded-xl bg-[var(--surface-elevated)] px-4 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] transition-[box-shadow] duration-150 ease-[var(--ease-agency)] focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex h-12 shrink-0 items-center justify-between gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{loading ? "Shortening..." : "Shorten URL"}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
                      {loading ? (
                        <IconSpinner size={16} />
                      ) : (
                        <IconArrowRight size={16} />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {allowPublicCustomSlugs && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="custom-slug"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      Custom link
                    </label>
                    <span className="text-xs text-[var(--text-muted)]">
                      Optional · letters, numbers, - or _
                    </span>
                  </div>
                  <div
                    className={`flex h-11 items-center rounded-xl bg-[var(--surface-elevated)] ring-1 transition-[box-shadow] duration-150 ease-[var(--ease-agency)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] ${
                      customSlugInvalid
                        ? "ring-[var(--negative)]/60 focus-within:ring-[var(--negative)]"
                        : "ring-[var(--bezel-ring)] focus-within:ring-[var(--accent)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="select-none pl-4 pr-1 font-mono text-sm text-[var(--text-muted)]"
                    >
                      /
                    </span>
                    <input
                      id="custom-slug"
                      type="text"
                      maxLength={64}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="my-custom-link"
                      value={customSlug}
                      aria-invalid={customSlugInvalid}
                      aria-describedby="custom-slug-hint"
                      onChange={(e) => {
                        setCustomSlug(e.target.value.replace(/^\/+/, ""));
                        if (error) setError(null);
                      }}
                      className="h-full min-w-0 flex-1 rounded-r-xl bg-transparent pr-4 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline-none"
                    />
                    {customSlug.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomSlug("")}
                        className="mr-2 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-black/5 hover:text-[var(--text)] active:scale-[0.97] dark:hover:bg-white/10"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p
                    id="custom-slug-hint"
                    aria-live="polite"
                    className={`text-xs ${
                      customSlugInvalid
                        ? "text-[var(--negative)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {customSlugInvalid
                      ? customSlugValidation?.error
                      : trimmedCustomSlug
                        ? `Short link will resolve at /${trimmedCustomSlug}`
                        : "Leave blank for a random 7-character link"}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  aria-expanded={showOptions}
                  aria-controls="public-link-options"
                  onClick={() => setShowOptions((v) => !v)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-black/5 px-3 text-xs font-medium text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/10 hover:text-[var(--text)] active:scale-[0.97] dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <IconSliders size={16} />
                  <span>
                    {showOptions ? "Hide options" : "Expiry & password"}
                  </span>
                </button>

                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="font-mono tabular-nums">
                    {statusMsg ?? `Default expiry ${defaultDays}d`}
                  </span>
                  <Link
                    href="/report"
                    className="text-[var(--text-secondary)] underline decoration-[var(--bezel-ring)] underline-offset-4 transition-colors duration-150 hover:text-[var(--text)]"
                  >
                    Report a link
                  </Link>
                </div>
              </div>

              {showOptions && (
                <div
                  id="public-link-options"
                  className="animate-modal grid gap-4 rounded-xl bg-[var(--surface-elevated)] p-4 ring-1 ring-[var(--bezel-ring)] sm:grid-cols-2"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="expiry-select"
                      className="block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Expiration
                    </label>
                    <select
                      id="expiry-select"
                      value={expiresInHours}
                      onChange={(e) =>
                        setExpiresInHours(
                          e.target.value as "default" | "24" | "168" | "720"
                        )
                      }
                      className="h-10 w-full rounded-xl bg-[var(--surface)] px-3 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
                    >
                      <option value="default">
                        Default ({defaultPublicExpiryHours}h)
                      </option>
                      <option value="24">24 hours</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="link-password"
                      className="block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Password
                    </label>
                    <input
                      id="link-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Optional"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface)] px-3 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl bg-[var(--negative-soft)] px-4 py-3 text-xs text-[var(--negative)] ring-1 ring-[var(--negative)]/20"
                >
                  {error}
                </div>
              )}
            </form>
          )}
        </DoubleBezel>
      </Reveal>

      {/* Editorial Split Right: Double-Bezel Hardware Routing Slip */}
      <Reveal delayMs={80} className="md:col-span-5 md:pt-8">
        {result ? (
          <DoubleBezel innerClassName="p-6 animate-modal">
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--positive)]" />
                <span className="text-sm font-medium text-[var(--text)]">
                  Short link ready
                </span>
              </div>
              <span className="rounded-full bg-black/5 px-3 py-1 font-mono text-xs tabular-nums text-[var(--text-secondary)] dark:bg-white/10">
                HTTP 302 · Public
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-elevated)] p-3 ring-1 ring-[var(--bezel-ring)]">
                <a
                  href={`/${result.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate pl-1 font-mono text-sm font-medium text-[var(--accent-ink)] hover:underline"
                >
                  {result.shortUrl}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(result.shortUrl)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium ring-1 transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.97] ${
                    copied
                      ? "bg-[var(--positive-soft)] text-[var(--positive)] ring-[var(--positive)]/20"
                      : "bg-[var(--surface)] text-[var(--text)] ring-[var(--bezel-ring)] hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Verbatim destination
                </div>
                <p className="break-all rounded-xl bg-[var(--surface-elevated)] p-4 font-mono text-xs leading-5 text-[var(--text)] ring-1 ring-[var(--bezel-ring)]">
                  {result.destinationUrl}
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
                <div className="w-fit shrink-0 rounded-xl bg-white p-3 ring-1 ring-black/10">
                  <div
                    className="h-28 w-28 [&>svg]:h-full [&>svg]:w-full"
                    aria-label={`QR code for ${result.shortUrl}`}
                    dangerouslySetInnerHTML={{ __html: result.qrSvg }}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-3 text-xs">
                  {result.passwordProtected && (
                    <div className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                      <IconLock size={16} />
                      <span>Password protected</span>
                    </div>
                  )}
                  {result.expiresAt && (
                    <div className="font-mono tabular-nums text-[var(--text-muted)]">
                      Expires {new Date(result.expiresAt).toLocaleDateString()}
                    </div>
                  )}

                  <Link
                    href={`/${result.slug}+`}
                    className="group inline-flex h-10 w-fit items-center gap-2 rounded-full bg-black/5 pl-4 pr-2 text-xs font-medium text-[var(--text)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/10 active:scale-[0.97] dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    <span>Inspect /{result.slug}+</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
                      <IconArrowUpRight size={16} />
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex w-fit items-center gap-2 text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text)] active:scale-[0.98]"
                  >
                    <IconDownload size={16} />
                    <span>Download SVG QR</span>
                  </button>
                </div>
              </div>
            </div>
          </DoubleBezel>
        ) : (
          <DoubleBezel innerClassName="p-6">
            <div className="flex items-center justify-between pb-4">
              <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-[var(--text)]">
                <span className="truncate text-[var(--text-muted)]">
                  /{previewSlug}
                </span>
                <span className="shrink-0 text-[var(--text-muted)]">→</span>
                <span className="truncate rounded-full bg-[var(--accent-soft)] px-3 py-1 font-medium text-[var(--accent-ink)]">
                  /{previewSlug}+
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                HTTP 302
              </span>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                {draft.isSample
                  ? "Sample routing slip"
                  : "Live destination check"}
              </div>

              <dl className="space-y-2 rounded-xl bg-[var(--surface-elevated)] p-4 text-xs ring-1 ring-[var(--bezel-ring)]">
                <div className="flex items-center justify-between gap-4 py-1">
                  <dt className="text-[var(--text-muted)]">Host</dt>
                  <dd className="truncate font-mono text-[var(--text)]">
                    {draft.host}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <dt className="text-[var(--text-muted)]">Query params</dt>
                  <dd className="truncate font-mono text-[var(--text)]">
                    {draft.query}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <dt className="text-[var(--text-muted)]">Fragment</dt>
                  <dd className="truncate font-mono text-[var(--text)]">
                    {draft.fragment}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <dt className="text-[var(--text-muted)]">Telemetry</dt>
                  <dd className="font-mono tabular-nums text-[var(--text-secondary)]">
                    0 cookies · 0 IPs
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                Every shortened link exposes a public inspection slip at{" "}
                <code className="font-mono text-[var(--text-secondary)]">
                  /&lt;slug&gt;+
                </code>{" "}
                so visitors verify ownership and destination before redirecting.
              </p>
            </div>
          </DoubleBezel>
        )}
      </Reveal>
    </div>
  );
}
