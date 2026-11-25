"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModalDialog } from "./modal-dialog";
import { DoubleBezel } from "./double-bezel";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconCommand,
  IconCopy,
  IconDownload,
  IconEdit,
  IconLink,
  IconLock,
  IconLogOut,
  IconPlus,
  IconSettings,
  IconShield,
  IconTrash,
  IconUpload,
} from "./icons";

interface PersonalLink {
  id: number;
  slug: string;
  destinationUrl: string;
  ownerType: "admin" | "public";
  status: "active" | "disabled" | "flagged";
  redirectCode: 301 | 302 | 307;
  passwordProtected: boolean;
  clicks: number;
  maxClicks: number | null;
  expiresAt: number | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

interface PublicLinkItem {
  id: number;
  slug: string;
  destinationUrl: string;
  status: "active" | "disabled" | "flagged";
  clicks: number;
  expiresAt: number | null;
  passwordProtected: boolean;
  createdAt: number;
}

interface AbuseReportItem {
  reportId: number;
  linkId: number;
  reason: string;
  details: string | null;
  reportStatus: "open" | "resolved" | "dismissed";
  reportCreatedAt: number;
  slug: string;
  destinationUrl: string;
  ownerType: "admin" | "public";
  linkStatus: "active" | "disabled" | "flagged";
}

interface BlockedDomainItem {
  id: number;
  domain: string;
  reason: string | null;
  createdAt: number;
}

interface AppSettingsState {
  publicCreationEnabled: boolean;
  anonymousClickCounting: boolean;
  defaultPublicExpiryHours: number;
  allowPublicCustomSlugs: boolean;
}

export function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<"personal" | "moderation" | "settings">(
    "personal"
  );

  const [personalLinks, setPersonalLinks] = useState<PersonalLink[]>([]);
  const [publicLinks, setPublicLinks] = useState<PublicLinkItem[]>([]);
  const [reports, setReports] = useState<AbuseReportItem[]>([]);
  const [blocklist, setBlocklist] = useState<BlockedDomainItem[]>([]);
  const [settings, setSettings] = useState<AppSettingsState | null>(null);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Create form state
  const [slug, setSlug] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [redirectCode, setRedirectCode] = useState<301 | 302 | 307>(302);
  const [password, setPassword] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  // Quick-Create Cmd/Ctrl+K modal
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSlug, setQuickSlug] = useState("");
  const [quickUrl, setQuickUrl] = useState("");

  // Edit modal
  const [editing, setEditing] = useState<PersonalLink | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCode, setEditCode] = useState<301 | 302 | 307>(302);
  const [editNote, setEditNote] = useState("");
  const [editMaxClicks, setEditMaxClicks] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editClearPassword, setEditClearPassword] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importContent, setImportContent] = useState("");

  // Blocklist form
  const [newDomain, setNewDomain] = useState("");
  const [newDomainReason, setNewDomainReason] = useState("");

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchWorkspaceData = useCallback(async () => {
    const [linksRes, modRes, blockRes, setRes] = await Promise.all([
      fetch("/api/admin/links", { cache: "no-store" }),
      fetch("/api/admin/moderation", { cache: "no-store" }),
      fetch("/api/admin/blocklist", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);

    if (linksRes.status === 401) {
      router.push("/admin/login");
      return null;
    }

    const [linksData, modData, blockData, setData] = await Promise.all([
      linksRes.json(),
      modRes.json(),
      blockRes.json(),
      setRes.json(),
    ]);

    return {
      links: linksData.links ?? [],
      publicLinks: modData.publicLinks ?? [],
      reports: modData.reports ?? [],
      domains: blockData.domains ?? [],
      settings: setData.settings ?? null,
    };
  }, [router]);

  const loadAll = useCallback(async () => {
    try {
      const data = await fetchWorkspaceData();
      if (!data) return;
      setPersonalLinks(data.links);
      setPublicLinks(data.publicLinks);
      setReports(data.reports);
      setBlocklist(data.domains);
      setSettings(data.settings);
    } catch {
      setBanner({ type: "err", text: "Failed to load workspace data" });
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaceData]);

  useEffect(() => {
    let active = true;
    fetchWorkspaceData()
      .then((data) => {
        if (!active || !data) return;
        setPersonalLinks(data.links);
        setPublicLinks(data.publicLinks);
        setReports(data.reports);
        setBlocklist(data.domains);
        setSettings(data.settings);
      })
      .catch(() => {
        if (active) {
          setBanner({ type: "err", text: "Failed to load workspace data" });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchWorkspaceData]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickOpen((v) => !v);
      } else if (e.key === "Escape") {
        setQuickOpen(false);
        setEditing(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleCreateLink(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    setCreating(true);

    const parsedMax = maxClicks.trim() ? Number.parseInt(maxClicks, 10) : null;
    const parsedExpHours = expiresHours.trim()
      ? Number.parseFloat(expiresHours)
      : null;
    const expiresAt =
      parsedExpHours && Number.isFinite(parsedExpHours) && parsedExpHours > 0
        ? Date.now() + Math.round(parsedExpHours * 3600 * 1000)
        : null;

    try {
      const res = await fetch("/api/admin/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim() || undefined,
          destinationUrl: destinationUrl.trim(),
          redirectCode,
          password: password || undefined,
          maxClicks: parsedMax,
          expiresAt,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || "Could not create link" });
        return;
      }
      setSlug("");
      setDestinationUrl("");
      setPassword("");
      setMaxClicks("");
      setExpiresHours("");
      setNote("");
      setBanner({
        type: "ok",
        text: `Created personal link /${data.link.slug}`,
      });
      await loadAll();
    } finally {
      setCreating(false);
    }
  }

  async function handleQuickCreate(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: quickSlug.trim() || undefined,
        destinationUrl: quickUrl.trim(),
        redirectCode: 302,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: "err", text: data.error || "Quick create failed" });
      return;
    }
    setQuickSlug("");
    setQuickUrl("");
    setQuickOpen(false);
    setBanner({ type: "ok", text: `Created /${data.link.slug}` });
    await loadAll();
  }

  function openEditModal(item: PersonalLink) {
    setEditing(item);
    setEditSlug(item.slug);
    setEditUrl(item.destinationUrl);
    setEditCode(item.redirectCode);
    setEditNote(item.note ?? "");
    setEditMaxClicks(item.maxClicks ? String(item.maxClicks) : "");
    setEditPassword("");
    setEditClearPassword(false);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBanner(null);

    const parsedMax = editMaxClicks.trim()
      ? Number.parseInt(editMaxClicks, 10)
      : null;

    const res = await fetch(`/api/admin/links/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: editSlug.trim(),
        destinationUrl: editUrl.trim(),
        redirectCode: editCode,
        note: editNote.trim() || null,
        maxClicks: parsedMax,
        password: editPassword.trim() || undefined,
        clearPassword: editClearPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: "err", text: data.error || "Update failed" });
      return;
    }
    setEditing(null);
    setBanner({ type: "ok", text: `Updated /${data.link.slug}` });
    await loadAll();
  }

  async function handleToggleStatus(item: PersonalLink) {
    const nextStatus = item.status === "active" ? "disabled" : "active";
    const res = await fetch(`/api/admin/links/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleDeleteLink(id: number) {
    const res = await fetch(`/api/admin/links/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBanner({ type: "ok", text: "Link deleted" });
      await loadAll();
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/admin/links/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: importFormat, content: importContent }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: "err", text: data.error || "Import failed" });
      return;
    }
    setImportContent("");
    setShowImport(false);
    setBanner({
      type: "ok",
      text: `Imported ${data.inserted} links (${data.skipped} skipped)`,
    });
    await loadAll();
  }

  async function handleModerate(
    linkId: number,
    action:
      | "disable_link"
      | "restore_link"
      | "delete_link"
      | "dismiss_report"
      | "block_domain",
    reportId?: number
  ) {
    const res = await fetch(`/api/admin/moderation/${linkId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reportId }),
    });
    if (res.ok) {
      setBanner({
        type: "ok",
        text: `Moderation action applied: ${action.replace("_", " ")}`,
      });
      await loadAll();
    }
  }

  async function handleAddDomain(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: newDomain,
        reason: newDomainReason || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: "err", text: data.error || "Could not add domain" });
      return;
    }
    setNewDomain("");
    setNewDomainReason("");
    await loadAll();
  }

  async function handleRemoveDomain(id: number) {
    const res = await fetch(`/api/admin/blocklist?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleUpdateSettings(patch: Partial<AppSettingsState>) {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) {
      setSettings(data.settings);
      setBanner({ type: "ok", text: "Settings saved" });
    }
  }

  async function handleExport(format: "json" | "csv") {
    const res = await fetch(`/api/admin/links/export?format=${format}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setBanner({ type: "err", text: "Export failed" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personal-links.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySlugUrl(itemSlug: string, id: number) {
    const full = `${window.location.origin}/${itemSlug}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  const openReportsCount = reports.filter(
    (r) => r.reportStatus === "open"
  ).length;
  const activePersonalCount = personalLinks.filter(
    (l) => l.status === "active"
  ).length;
  const flaggedPublicCount = publicLinks.filter(
    (l) => l.status === "flagged"
  ).length;

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start">
      {/* Left Navigation Rail in Double-Bezel Enclosure */}
      <aside className="w-full shrink-0 md:sticky md:top-24 md:w-64">
        <DoubleBezel innerClassName="p-4">
          <div className="mb-4 px-2">
            <span className="inline-flex items-center rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)] dark:bg-white/10">
              Owner console
            </span>
            <div className="mt-2 text-xs text-[var(--text-secondary)]">
              Personal &amp; public controls
            </div>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Admin sections">
            <button
              type="button"
              aria-current={tab === "personal" ? "page" : undefined}
              onClick={() => setTab("personal")}
              className={`flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.98] ${
                tab === "personal"
                  ? "bg-[var(--text)] font-medium text-[var(--bg)]"
                  : "text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              }`}
            >
              <IconLink size={16} className="shrink-0" />
              <span className="flex-1 text-left">Personal links</span>
              <span className="font-mono text-xs tabular-nums opacity-70">
                {personalLinks.length}
              </span>
            </button>

            <button
              type="button"
              aria-current={tab === "moderation" ? "page" : undefined}
              onClick={() => setTab("moderation")}
              className={`flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.98] ${
                tab === "moderation"
                  ? "bg-[var(--text)] font-medium text-[var(--bg)]"
                  : "text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              }`}
            >
              <IconShield size={16} className="shrink-0" />
              <span className="flex-1 text-left">Public moderation</span>
              {openReportsCount > 0 && (
                <span className="font-mono text-xs tabular-nums text-[var(--warning)]">
                  {openReportsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-current={tab === "settings" ? "page" : undefined}
              onClick={() => setTab("settings")}
              className={`flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.98] ${
                tab === "settings"
                  ? "bg-[var(--text)] font-medium text-[var(--bg)]"
                  : "text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10"
              }`}
            >
              <IconSettings size={16} className="shrink-0" />
              <span className="flex-1 text-left">Blocklist &amp; settings</span>
            </button>
          </nav>

          <div className="mt-4 space-y-1 border-t border-[var(--bezel-ring)] pt-4">
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 hover:text-[var(--text)] active:scale-[0.98] dark:hover:bg-white/10"
            >
              <IconCommand size={16} className="shrink-0" />
              <span className="flex-1 text-left">Quick create</span>
              <kbd className="rounded-md bg-black/5 px-2 py-0.5 font-mono text-xs text-[var(--text-muted)] ring-1 ring-[var(--bezel-ring)] dark:bg-white/10">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm text-[var(--text-secondary)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 hover:text-[var(--text)] active:scale-[0.98] dark:hover:bg-white/10"
            >
              <IconLogOut size={16} className="shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </DoubleBezel>
      </aside>

      {/* Main Fluid Content */}
      <div className="min-w-0 flex-1 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-medium tracking-[-0.025em] text-[var(--text)]">
              {tab === "personal"
                ? "Personal links"
                : tab === "moderation"
                ? "Public moderation"
                : "Blocklist and settings"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {tab === "personal"
                ? "Permanent custom vanity links with optional caps and passwords"
                : tab === "moderation"
                ? "Review reported public links and pause abusive destinations"
                : "Control public link creation, anonymous counting, and blocked domains"}
            </p>
          </div>

          {tab === "personal" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 active:scale-[0.97] dark:hover:bg-white/10"
              >
                <IconDownload size={16} />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 active:scale-[0.97] dark:hover:bg-white/10"
              >
                <IconDownload size={16} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 active:scale-[0.97] dark:hover:bg-white/10"
              >
                <IconUpload size={16} />
                <span>{showImport ? "Close import" : "Import"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Asymmetrical Bento Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <DoubleBezel innerClassName="p-5 h-full">
              <div className="text-xs text-[var(--text-muted)]">
                Personal links
              </div>
              <div className="mt-2 font-mono text-3xl font-medium leading-none tabular-nums text-[var(--text)]">
                {personalLinks.length}
              </div>
              <div className="mt-2 text-xs tabular-nums text-[var(--text-secondary)]">
                {activePersonalCount} active
              </div>
            </DoubleBezel>
          </div>

          <div className="xl:col-span-3">
            <DoubleBezel innerClassName="p-5 h-full">
              <div className="text-xs text-[var(--text-muted)]">
                Public links
              </div>
              <div className="mt-2 font-mono text-3xl font-medium leading-none tabular-nums text-[var(--text)]">
                {publicLinks.length}
              </div>
              <div className="mt-2 text-xs tabular-nums text-[var(--text-secondary)]">
                {flaggedPublicCount} flagged
              </div>
            </DoubleBezel>
          </div>

          <div className="xl:col-span-3">
            <DoubleBezel innerClassName="p-5 h-full">
              <div className="text-xs text-[var(--text-muted)]">
                Open reports
              </div>
              <div className="mt-2 font-mono text-3xl font-medium leading-none tabular-nums text-[var(--text)]">
                {openReportsCount}
              </div>
              <div className="mt-2 text-xs tabular-nums text-[var(--text-secondary)]">
                {reports.length} total
              </div>
            </DoubleBezel>
          </div>

          <div className="xl:col-span-2">
            <DoubleBezel innerClassName="p-5 h-full">
              <div className="text-xs text-[var(--text-muted)]">Blocked</div>
              <div className="mt-2 font-mono text-3xl font-medium leading-none tabular-nums text-[var(--text)]">
                {blocklist.length}
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                Domains
              </div>
            </DoubleBezel>
          </div>
        </div>

        {banner && (
          <div
            role="status"
            className={`rounded-2xl px-4 py-3 text-xs ring-1 ${
              banner.type === "ok"
                ? "bg-[var(--positive-soft)] text-[var(--positive)] ring-[var(--positive)]/20"
                : "bg-[var(--negative-soft)] text-[var(--negative)] ring-[var(--negative)]/20"
            }`}
          >
            {banner.text}
          </div>
        )}

        {loading ? (
          <DoubleBezel innerClassName="p-10 text-center text-sm text-[var(--text-muted)]">
            Loading workspace
          </DoubleBezel>
        ) : tab === "personal" ? (
          <div className="space-y-8">
            <DoubleBezel innerClassName="p-6">
              <form onSubmit={handleCreateLink} className="space-y-4">
                <h2 className="text-sm font-medium text-[var(--text)]">
                  New personal link
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-slug"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Vanity slug
                    </label>
                    <input
                      id="admin-new-slug"
                      type="text"
                      placeholder="github"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label
                      htmlFor="admin-new-url"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Destination URL
                    </label>
                    <input
                      id="admin-new-url"
                      type="url"
                      required
                      placeholder="https://github.com/username?tab=repositories"
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-redirect"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Redirect status
                    </label>
                    <select
                      id="admin-new-redirect"
                      value={redirectCode}
                      onChange={(e) =>
                        setRedirectCode(
                          Number(e.target.value) as 301 | 302 | 307
                        )
                      }
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
                    >
                      <option value={302}>302 Found</option>
                      <option value={307}>307 Temporary</option>
                      <option value={301}>301 Permanent</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-expiry"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Expiry hours
                    </label>
                    <input
                      id="admin-new-expiry"
                      type="number"
                      min={1}
                      placeholder="Never"
                      value={expiresHours}
                      onChange={(e) => setExpiresHours(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-max-clicks"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Click limit
                    </label>
                    <input
                      id="admin-new-max-clicks"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxClicks}
                      onChange={(e) => setMaxClicks(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-password"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Password
                    </label>
                    <input
                      id="admin-new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Optional"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label htmlFor="admin-new-note" className="sr-only">
                    Note
                  </label>
                  <input
                    id="admin-new-note"
                    type="text"
                    placeholder="Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="h-11 flex-1 rounded-xl bg-[var(--surface-elevated)] px-4 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    disabled={creating}
                    className="group inline-flex h-11 shrink-0 items-center justify-between gap-3 rounded-full bg-[var(--accent)] pl-5 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97] disabled:opacity-50"
                  >
                    <span>{creating ? "Creating..." : "Create link"}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
                      <IconPlus size={16} />
                    </span>
                  </button>
                </div>
              </form>
            </DoubleBezel>

            {showImport && (
              <DoubleBezel innerClassName="p-6 animate-modal">
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[var(--text)]">
                      Import personal links
                    </h3>
                    <select
                      aria-label="Import format"
                      value={importFormat}
                      onChange={(e) =>
                        setImportFormat(e.target.value as "json" | "csv")
                      }
                      className="h-9 rounded-full bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
                    >
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                    </select>
                  </div>
                  <textarea
                    rows={5}
                    required
                    aria-label="Import payload"
                    placeholder={
                      importFormat === "json"
                        ? '[{"slug":"github","destinationUrl":"https://github.com/you"}]'
                        : "slug,destination_url,redirect_code,status,note\ngithub,https://github.com/you,302,active,My GitHub"
                    }
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    className="w-full rounded-2xl bg-[var(--surface-elevated)] p-4 font-mono text-xs text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-xs font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                  >
                    Run import
                  </button>
                </form>
              </DoubleBezel>
            )}

            {/* Personal Links Ledger */}
            <DoubleBezel innerClassName="overflow-hidden">
              {personalLinks.length === 0 ? (
                <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                  No personal links yet. Create one above or press Ctrl+K
                </div>
              ) : (
                <div className="divide-y divide-[var(--bezel-ring)]">
                  {personalLinks.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={`/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm font-medium text-[var(--text)] hover:text-[var(--accent-ink)]"
                          >
                            /{item.slug}
                          </a>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                              item.status === "active"
                                ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                                : "bg-black/5 text-[var(--text-muted)] dark:bg-white/10"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.status === "active"
                                  ? "bg-[var(--positive)]"
                                  : "bg-[var(--text-muted)]"
                              }`}
                            />
                            <span>{item.status}</span>
                          </span>
                          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                            HTTP {item.redirectCode}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                            {item.clicks}
                            {item.maxClicks ? `/${item.maxClicks}` : ""} clicks
                          </span>
                          {item.passwordProtected && (
                            <span
                              title="Password protected"
                              className="text-[var(--text-muted)]"
                            >
                              <IconLock size={14} />
                            </span>
                          )}
                        </div>
                        <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                          {item.destinationUrl}
                        </p>
                        {item.note && (
                          <p className="text-xs text-[var(--text-muted)]">
                            {item.note}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copySlugUrl(item.slug, item.id)}
                          className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs ring-1 transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] active:scale-[0.97] ${
                            copiedId === item.id
                              ? "bg-[var(--positive-soft)] font-medium text-[var(--positive)] ring-[var(--positive)]/20"
                              : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] ring-[var(--bezel-ring)] hover:text-[var(--text)]"
                          }`}
                        >
                          {copiedId === item.id ? (
                            <IconCheck size={14} />
                          ) : (
                            <IconCopy size={14} />
                          )}
                          <span>
                            {copiedId === item.id ? "Copied" : "Copy"}
                          </span>
                        </button>
                        <Link
                          href={`/${item.slug}+`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                        >
                          <span>Inspect</span>
                          <IconArrowUpRight size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                        >
                          <IconEdit size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className="inline-flex h-8 items-center rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                        >
                          {item.status === "active" ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(item.id)}
                          aria-label={`Delete /${item.slug}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-[opacity,transform] duration-150 ease-[var(--ease-agency)] hover:opacity-85 active:scale-[0.97]"
                        >
                          <IconTrash size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DoubleBezel>
          </div>
        ) : tab === "moderation" ? (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Flagged and abuse reports queue
              </h2>
              <DoubleBezel innerClassName="overflow-hidden">
                {reports.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No abuse reports submitted
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--bezel-ring)]">
                    {reports.map((rep) => (
                      <div
                        key={rep.reportId}
                        className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-sm font-medium text-[var(--text)]">
                              /{rep.slug}
                            </span>
                            <span className="rounded-full bg-[var(--warning-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--warning)]">
                              {rep.reason}
                            </span>
                            <span className="font-mono text-xs text-[var(--text-muted)]">
                              report: {rep.reportStatus} · link: {rep.linkStatus}
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                            {rep.destinationUrl}
                          </p>
                          {rep.details && (
                            <p className="text-xs text-[var(--text)]">
                              {rep.details}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleModerate(
                                rep.linkId,
                                "disable_link",
                                rep.reportId
                              )
                            }
                            className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-black/5 active:scale-[0.97] dark:hover:bg-white/10"
                          >
                            Disable link
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleModerate(
                                rep.linkId,
                                "block_domain",
                                rep.reportId
                              )
                            }
                            className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                          >
                            Block domain
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleModerate(
                                rep.linkId,
                                "dismiss_report",
                                rep.reportId
                              )
                            }
                            className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                          >
                            Dismiss &amp; restore
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleModerate(
                                rep.linkId,
                                "delete_link",
                                rep.reportId
                              )
                            }
                            className="h-8 rounded-lg bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-[opacity,transform] duration-150 ease-[var(--ease-agency)] hover:opacity-85 active:scale-[0.97]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DoubleBezel>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[var(--text)]">
                All public visitor links
              </h2>
              <DoubleBezel innerClassName="overflow-hidden">
                {publicLinks.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No public links created yet
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--bezel-ring)]">
                    {publicLinks.map((pl) => (
                      <div
                        key={pl.id}
                        className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/${pl.slug}+`}
                              className="font-mono text-sm font-medium text-[var(--text)] hover:text-[var(--accent-ink)]"
                            >
                              /{pl.slug}
                            </Link>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                pl.status === "active"
                                  ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                                  : pl.status === "flagged"
                                  ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                                  : "bg-[var(--negative-soft)] text-[var(--negative)]"
                              }`}
                            >
                              {pl.status}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                              {pl.clicks} clicks
                            </span>
                          </div>
                          <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                            {pl.destinationUrl}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {pl.status === "active" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate(pl.id, "disable_link")
                              }
                              className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate(pl.id, "restore_link")
                              }
                              className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleModerate(pl.id, "block_domain")}
                            className="h-8 rounded-lg bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--bezel-ring)] transition-[background-color,color,transform] duration-150 ease-[var(--ease-agency)] hover:text-[var(--text)] active:scale-[0.97]"
                          >
                            Block domain
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerate(pl.id, "delete_link")}
                            className="h-8 rounded-lg bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-[opacity,transform] duration-150 ease-[var(--ease-agency)] hover:opacity-85 active:scale-[0.97]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DoubleBezel>
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DoubleBezel innerClassName="p-6 space-y-4">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Global instance controls
              </h2>

              {settings && (
                <div className="divide-y divide-[var(--bezel-ring)]">
                  <label className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">
                        Allow public link creation
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Visitors on / can create temporary Base62 links
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.publicCreationEnabled}
                      onChange={(e) =>
                        handleUpdateSettings({
                          publicCreationEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">
                        Anonymous click counter
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Integer increment only, zero IP or UA logging
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.anonymousClickCounting}
                      onChange={(e) =>
                        handleUpdateSettings({
                          anonymousClickCounting: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">
                        Allow public custom slugs
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Reserves vanity paths for the owner when off
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowPublicCustomSlugs}
                      onChange={(e) =>
                        handleUpdateSettings({
                          allowPublicCustomSlugs: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>

                  <div className="pt-4">
                    <label
                      htmlFor="default-expiry-hours"
                      className="mb-2 block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Default public link expiry (hours)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="default-expiry-hours"
                        type="number"
                        min={1}
                        max={8760}
                        value={settings.defaultPublicExpiryHours}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            defaultPublicExpiryHours:
                              Number.parseInt(e.target.value, 10) || 720,
                          })
                        }
                        className="h-10 w-28 rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm tabular-nums text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSettings({
                            defaultPublicExpiryHours:
                              settings.defaultPublicExpiryHours,
                          })
                        }
                        className="h-10 rounded-full bg-[var(--surface-elevated)] px-4 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--bezel-ring)] hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        Save hours
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </DoubleBezel>

            <DoubleBezel innerClassName="p-6 space-y-4">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Domain blocklist
              </h2>
              <form onSubmit={handleAddDomain} className="space-y-3">
                <div className="flex gap-2">
                  <label htmlFor="blocklist-domain" className="sr-only">
                    Domain to block
                  </label>
                  <input
                    id="blocklist-domain"
                    type="text"
                    required
                    placeholder="spam.example"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="h-10 flex-1 rounded-xl bg-[var(--surface-elevated)] px-3 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-full bg-[var(--accent)] px-5 text-xs font-medium text-[var(--accent-fg)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                  >
                    Block
                  </button>
                </div>
                <label htmlFor="blocklist-reason" className="sr-only">
                  Block reason
                </label>
                <input
                  id="blocklist-reason"
                  type="text"
                  placeholder="Reason"
                  value={newDomainReason}
                  onChange={(e) => setNewDomainReason(e.target.value)}
                  className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
                />
              </form>

              <div className="divide-y divide-[var(--bezel-ring)] rounded-2xl bg-[var(--surface-elevated)] ring-1 ring-[var(--bezel-ring)]">
                {blocklist.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[var(--text-muted)]">
                    No domains blocked
                  </div>
                ) : (
                  blocklist.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-4 py-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-medium text-[var(--text)]">
                          {b.domain}
                        </div>
                        {b.reason && (
                          <div className="text-[var(--text-muted)]">
                            {b.reason}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDomain(b.id)}
                        className="rounded-full px-2.5 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </DoubleBezel>
          </div>
        )}
      </div>

      {/* Quick Create Modal (Ctrl+K / Cmd+K) */}
      <ModalDialog
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        ariaLabelledBy="quick-create-title"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleQuickCreate} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="quick-create-title"
              className="text-base font-medium text-[var(--text)]"
            >
              Quick-create personal link
            </h2>
            <button
              type="button"
              onClick={() => setQuickOpen(false)}
              className="rounded-full bg-black/5 px-2.5 py-1 font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] dark:bg-white/10"
            >
              Esc
            </button>
          </div>
          <label htmlFor="quick-slug-input" className="sr-only">
            Vanity slug
          </label>
          <input
            id="quick-slug-input"
            type="text"
            autoFocus
            placeholder="Vanity slug"
            value={quickSlug}
            onChange={(e) => setQuickSlug(e.target.value)}
            className="h-11 w-full rounded-xl bg-[var(--surface-elevated)] px-4 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
          />
          <label htmlFor="quick-url-input" className="sr-only">
            Destination URL
          </label>
          <input
            id="quick-url-input"
            type="url"
            required
            placeholder="https://example.com"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            className="h-11 w-full rounded-xl bg-[var(--surface-elevated)] px-4 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)] focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            className="group inline-flex h-12 w-full items-center justify-between rounded-full bg-[var(--accent)] pl-6 pr-2 text-sm font-medium text-[var(--accent-fg)] transition-[background-color,transform] duration-150 ease-[var(--ease-agency)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
          >
            <span>Create link</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-150 ease-[var(--ease-agency)] group-hover:translate-x-0.5">
              <IconArrowRight size={16} />
            </span>
          </button>
        </form>
      </ModalDialog>

      {/* Edit Link Modal */}
      <ModalDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        ariaLabelledBy="edit-link-title"
        maxWidthClass="max-w-lg"
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="edit-link-title"
                className="font-mono text-base font-medium text-[var(--text)]"
              >
                Edit /{editing.slug}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] dark:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-slug-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                Slug
              </label>
              <input
                id="edit-slug-input"
                type="text"
                required
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-url-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                Destination URL
              </label>
              <input
                id="edit-url-input"
                type="url"
                required
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-redirect-select"
                  className="block text-xs text-[var(--text-secondary)]"
                >
                  Redirect status
                </label>
                <select
                  id="edit-redirect-select"
                  value={editCode}
                  onChange={(e) =>
                    setEditCode(Number(e.target.value) as 301 | 302 | 307)
                  }
                  className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
                >
                  <option value={302}>302</option>
                  <option value={307}>307</option>
                  <option value={301}>301</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-max-clicks-input"
                  className="block text-xs text-[var(--text-secondary)]"
                >
                  Click limit
                </label>
                <input
                  id="edit-max-clicks-input"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={editMaxClicks}
                  onChange={(e) => setEditMaxClicks(e.target.value)}
                  className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 font-mono text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-password-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                New password
              </label>
              <input
                id="edit-password-input"
                type="password"
                autoComplete="new-password"
                placeholder="Keep existing"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
              />
              {editing.passwordProtected && (
                <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={editClearPassword}
                    onChange={(e) => setEditClearPassword(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Remove existing password
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-note-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                Note
              </label>
              <input
                id="edit-note-input"
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="h-10 w-full rounded-xl bg-[var(--surface-elevated)] px-3.5 text-sm text-[var(--text)] ring-1 ring-[var(--bezel-ring)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 rounded-full bg-black/5 px-4 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] dark:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 rounded-full bg-[var(--accent)] px-5 text-xs font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
}
