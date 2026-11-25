"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fetchAndSolvePow } from "@/lib/client-pow";
import { validateCustomSlug } from "@/lib/security/slug-validator";
import { prefersReducedMotion } from "@/engine";
import { usePage } from "@/engine/next";
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

gsap.registerPlugin(ScrollTrigger);

interface PublicShortenerProps {
  heroHeader: ReactNode;
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

function normalizeUserUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  if (/^[^\s/]+\.[^\s/]+/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function safeDecodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function parsePreviewUrl(raw: string) {
  const sample = "https://example.com/recipes/sourdough-bread";
  const isSample = raw.trim().length === 0;
  const target = isSample ? sample : normalizeUserUrl(raw);
  try {
    const u = new URL(target);
    const valid = u.protocol === "http:" || u.protocol === "https:";
    if (!valid) {
      return {
        isSample,
        valid: false,
        website: "Only web links (https://) are supported",
        page: "—",
      };
    }
    const decodedPath = safeDecodePath(u.pathname || "/");
    const fullPage =
      decodedPath === "/" && !u.search && !u.hash
        ? "Home page"
        : `${decodedPath}${u.search}${u.hash}`;
    return {
      isSample,
      valid: true,
      website: u.hostname,
      page: fullPage,
    };
  } catch {
    return {
      isSample,
      valid: false,
      website: "Waiting for a valid web link",
      page: "—",
    };
  }
}

export function PublicShortener({
  heroHeader,
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
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortenResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const sightlineRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<SVGGElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const customSlugInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Quiet idle state: optical pulse glides along the routing sightline,
  // pauses when offscreen, and remains static under reduced motion.
  usePage(() => {
    const stage = sightlineRef.current;
    const pulse = pulseRef.current;
    if (!stage || !pulse || prefersReducedMotion()) return;

    const tick = (time: number) => {
      const progress = (time * 0.28) % 1;
      const x = 18 + progress * 284;
      const opacity = Math.sin(progress * Math.PI);
      pulse.setAttribute("transform", `translate(${x.toFixed(1)} 16)`);
      pulse.setAttribute("opacity", (0.25 + opacity * 0.75).toFixed(2));
    };

    const st = ScrollTrigger.create({
      trigger: stage,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => {
        if (self.isActive) gsap.ticker.add(tick);
        else gsap.ticker.remove(tick);
      },
    });

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      st.kill();
    };
  });

  const draft = useMemo(() => parsePreviewUrl(url), [url]);
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
  const defaultDays = Math.round(defaultPublicExpiryHours / 24);
  const defaultExpiryText =
    defaultPublicExpiryHours % 24 === 0
      ? `${defaultDays} ${defaultDays === 1 ? "day" : "days"}`
      : `${defaultPublicExpiryHours} hours`;
  const liveExpiryText =
    expiresInHours === "24"
      ? "In 24 hours"
      : expiresInHours === "168"
        ? "In 7 days"
        : expiresInHours === "720"
          ? "In 30 days"
          : `In ${defaultExpiryText}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!publicCreationEnabled || loading) return;

    if (customSlugInvalid) {
      setError(customSlugValidation?.error ?? "Please check your custom ending.");
      customSlugInputRef.current?.focus();
      return;
    }

    const normalizedUrl = normalizeUserUrl(url);
    if (!normalizedUrl) {
      setError("Please paste a web link to shorten.");
      urlInputRef.current?.focus();
      return;
    }

    setError(null);
    setResult(null);
    setCopied(false);
    setCopyFailed(false);
    setLoading(true);
    setStatusMsg("Running quick spam check");
    setAnnouncement("Running quick spam check");

    try {
      const pow = await fetchAndSolvePow();
      setStatusMsg("Creating your short link");

      const expiryPayload =
        expiresInHours === "default"
          ? "default"
          : (Number(expiresInHours) as 24 | 168 | 720);

      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: normalizedUrl,
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
        setError(data.error || "Could not shorten that link");
        urlInputRef.current?.focus();
        return;
      }

      const issued = data as ShortenResponse;
      setResult(issued);
      setAnnouncement(`Short link ready at /${issued.slug}`);
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
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
      setAnnouncement("Short URL copied to clipboard");
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      setAnnouncement("Clipboard access unavailable");
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

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
      {/* Left 7 Columns: Display Typography + Architectural Form */}
      <div className="space-y-9 lg:col-span-7">
        {heroHeader}

        <div data-reveal="up" data-delay="0.18" data-intro>
          {!publicCreationEnabled ? (
            <div className="border-y border-[var(--line)] py-6 text-sm text-[var(--text-secondary)]">
              Creating new public links is paused by the site owner right now.
              Existing short links and previews still work.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <div className="space-y-2.5">
                <label
                  htmlFor="destination-url"
                  className="block text-sm font-medium text-[var(--text)]"
                >
                  Paste a long link
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    ref={urlInputRef}
                    id="destination-url"
                    name="url"
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(error && !customSlugInvalid)}
                    aria-describedby={error ? "shorten-error" : undefined}
                    placeholder="https://example.com/your-long-page"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    className="h-12 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-4 font-mono text-base text-[var(--text)] placeholder:font-sans placeholder:text-[var(--text-muted)] transition-colors duration-150 sm:flex-1 sm:text-sm"
                  />
                  <button
                    type="submit"
                    aria-disabled={loading}
                    className="zl-btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-3 rounded-lg px-6 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  >
                    <span>{loading ? "Shortening..." : "Shorten link"}</span>
                    <span className="zl-btn-arrow inline-flex items-center">
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
                      Custom ending
                    </label>
                    <span className="text-xs text-[var(--text-muted)]">
                      Optional — letters, numbers, - or _
                    </span>
                  </div>
                  <div
                    className={`flex h-11 items-center rounded-lg border bg-[var(--surface)] transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent-ink)] ${
                      customSlugInvalid
                        ? "border-[var(--negative)]"
                        : "border-[var(--line-strong)] focus-within:border-[var(--accent-ink)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="select-none pl-4 pr-1 font-mono text-sm text-[var(--text-muted)]"
                    >
                      /
                    </span>
                    <input
                      ref={customSlugInputRef}
                      id="custom-slug"
                      name="customSlug"
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
                      className="h-full min-w-0 flex-1 rounded-r-lg bg-transparent pr-4 font-mono text-base text-[var(--text)] placeholder:font-sans placeholder:text-[var(--text-muted)] focus-visible:outline-none sm:text-sm"
                    />
                    {customSlug.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomSlug("")}
                        aria-label="Clear custom ending"
                        className="mr-1.5 inline-flex min-h-8 items-center rounded px-2.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--text)]"
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
                        ? `Your short link will end with /${trimmedCustomSlug}`
                        : "Leave blank and we'll pick a short random ending for you"}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  aria-expanded={showOptions}
                  aria-controls="public-link-options"
                  onClick={() => setShowOptions((v) => !v)}
                  className="zl-btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  <IconSliders size={15} />
                  <span>
                    {showOptions ? "Hide options" : "Expiration & password"}
                  </span>
                </button>

                <div className="flex items-center gap-5 text-xs text-[var(--text-muted)]">
                  <span className="tabular-nums">
                    {statusMsg ?? `Expires in ${defaultExpiryText} by default`}
                  </span>
                  <Link
                    href="/report"
                    className="zl-inline-link inline-flex min-h-9 items-center text-[var(--text-secondary)]"
                  >
                    Report a link
                  </Link>
                </div>
              </div>

              {showOptions && (
                <div
                  id="public-link-options"
                  className="animate-modal grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="expiry-select"
                      className="block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Expires after
                    </label>
                    <select
                      id="expiry-select"
                      name="expiresInHours"
                      value={expiresInHours}
                      onChange={(e) =>
                        setExpiresInHours(
                          e.target.value as "default" | "24" | "168" | "720"
                        )
                      }
                      className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text)] sm:text-sm"
                    >
                      <option value="default">
                        Default ({defaultExpiryText})
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
                      Password protection
                    </label>
                    <input
                      id="link-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Optional password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-base text-[var(--text)] placeholder:text-[var(--text-muted)] sm:text-sm"
                    />
                  </div>
                </div>
              )}

              <div role="status" className="sr-only">
                {announcement}
              </div>

              {error && (
                <div
                  id="shorten-error"
                  role="alert"
                  className="rounded-lg border border-[var(--negative)]/40 bg-[var(--negative-soft)] px-4 py-3 text-xs text-[var(--negative)]"
                >
                  {error}
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Right 5 Columns: Live Link Preview Card */}
      <div
        ref={sightlineRef}
        data-reveal="up"
        data-delay="0.26"
        data-intro
        className="lg:col-span-5 lg:pt-2"
      >
        {result ? (
          <div className="animate-modal rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--positive)]" />
                <span className="text-sm font-medium text-[var(--text)]">
                  Your link is ready
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  urlInputRef.current?.focus();
                }}
                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                Shorten another
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
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
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
                    copied
                      ? "border-[var(--positive)]/40 bg-[var(--positive-soft)] text-[var(--positive)]"
                      : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  <span>
                    {copied ? "Copied!" : copyFailed ? "Select link" : "Copy"}
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  Goes to
                </div>
                <p className="break-all rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5 font-mono text-xs leading-5 text-[var(--text)]">
                  {result.destinationUrl}
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center">
                <div className="w-fit shrink-0 rounded-lg bg-white p-2.5">
                  <div
                    role="img"
                    className="h-24 w-24 [&>svg]:h-full [&>svg]:w-full"
                    aria-label={`QR code for ${result.shortUrl}`}
                    dangerouslySetInnerHTML={{ __html: result.qrSvg }}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-3 text-xs">
                  {result.passwordProtected && (
                    <div className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                      <IconLock size={15} />
                      <span>Password protected</span>
                    </div>
                  )}
                  {result.expiresAt && (
                    <div className="tabular-nums text-[var(--text-muted)]">
                      Expires{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                      }).format(result.expiresAt)}
                    </div>
                  )}

                  <Link
                    href={`/${result.slug}+`}
                    className="zl-btn-ghost inline-flex h-9 w-fit items-center gap-2 rounded-lg px-3.5 text-xs font-medium text-[var(--text)]"
                  >
                    <span>Preview link</span>
                    <IconArrowUpRight size={15} />
                  </Link>

                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="inline-flex min-h-9 w-fit items-center gap-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    <IconDownload size={15} />
                    <span>Download QR code</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="flex items-center justify-between gap-2 pb-4">
              <span className="text-xs font-medium text-[var(--text)]">
                {draft.isSample ? "Example link preview" : "Live link preview"}
              </span>
              <span className="font-mono text-xs text-[var(--accent-ink)]">
                /{previewSlug}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Long link</span>
              <span>Short link</span>
              <span>Safe preview</span>
            </div>

            {/* Quiet Link Connection Indicator */}
            <div className="pb-4 pt-1">
              <svg
                viewBox="0 0 320 32"
                fill="none"
                aria-hidden="true"
                className="h-8 w-full"
              >
                <line
                  x1="16"
                  y1="16"
                  x2="304"
                  y2="16"
                  stroke="var(--line-strong)"
                  strokeWidth="1"
                />
                <line
                  x1="16"
                  y1="16"
                  x2="160"
                  y2="16"
                  stroke="var(--accent-ink)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="4"
                  fill="var(--surface)"
                  stroke="var(--accent-ink)"
                  strokeWidth="1.5"
                />
                <rect
                  x="154"
                  y="10"
                  width="12"
                  height="12"
                  rx="2"
                  transform="rotate(45 160 16)"
                  fill="var(--surface)"
                  stroke="var(--accent-ink)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="304"
                  cy="16"
                  r="4"
                  fill={draft.valid ? "var(--positive)" : "var(--surface)"}
                  stroke={draft.valid ? "var(--positive)" : "var(--line-strong)"}
                  strokeWidth="1.5"
                />
                <g ref={pulseRef} transform="translate(18 16)" opacity="0.75">
                  <circle r="9" fill="var(--accent-ink)" opacity="0.18" />
                  <circle r="3.5" fill="var(--accent-ink)" />
                </g>
              </svg>
            </div>

            <dl className="divide-y divide-[var(--line)] border-y border-[var(--line)] text-xs">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="shrink-0 text-[var(--text-muted)]">Website</dt>
                <dd className="min-w-0 truncate font-medium text-[var(--text)]">
                  {draft.website}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="shrink-0 text-[var(--text-muted)]">Page</dt>
                <dd className="min-w-0 truncate font-mono text-[var(--text)]">
                  {draft.page}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="shrink-0 text-[var(--text-muted)]">Expires</dt>
                <dd className="min-w-0 truncate text-[var(--text)]">
                  {liveExpiryText}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="shrink-0 text-[var(--text-muted)]">Access</dt>
                <dd className="min-w-0 truncate text-[var(--text)]">
                  {password.trim() ? "Password protected" : "Anyone with link"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="shrink-0 text-[var(--text-muted)]">
                  Preview address
                </dt>
                <dd className="min-w-0 truncate font-mono text-[var(--accent-ink)]">
                  /{previewSlug}+
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Add a{" "}
              <span className="font-medium text-[var(--text-secondary)]">
                +
              </span>{" "}
              to the end of any short link to check where it goes before opening
              it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
