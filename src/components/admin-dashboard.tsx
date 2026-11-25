"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModalDialog } from "./modal-dialog";
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

  const [slug, setSlug] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [redirectCode, setRedirectCode] = useState<301 | 302 | 307>(302);
  const [password, setPassword] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [expiresHours, setExpiresHours] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSlug, setQuickSlug] = useState("");
  const [quickUrl, setQuickUrl] = useState("");

  const [editing, setEditing] = useState<PersonalLink | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCode, setEditCode] = useState<301 | 302 | 307>(302);
  const [editNote, setEditNote] = useState("");
  const [editMaxClicks, setEditMaxClicks] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editClearPassword, setEditClearPassword] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importContent, setImportContent] = useState("");
  const [importing, setImporting] = useState(false);

  const [newDomain, setNewDomain] = useState("");
  const [newDomainReason, setNewDomainReason] = useState("");
  const [expiryHoursDraft, setExpiryHoursDraft] = useState("720");

  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "personal" | "moderation";
    id: number;
    slug: string;
    reportId?: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      if (data.settings) {
        setExpiryHoursDraft(String(data.settings.defaultPublicExpiryHours));
      }
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
        if (data.settings) {
          setExpiryHoursDraft(String(data.settings.defaultPublicExpiryHours));
        }
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
    if (creating) return;
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
    } catch {
      setBanner({ type: "err", text: "Network error while creating link" });
    } finally {
      setCreating(false);
    }
  }

  async function handleQuickCreate(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    try {
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
    } catch {
      setBanner({ type: "err", text: "Network error during quick create" });
    }
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

    try {
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
    } catch {
      setBanner({ type: "err", text: "Network error while updating link" });
    }
  }

  async function handleToggleStatus(item: PersonalLink) {
    setBanner(null);
    const nextStatus = item.status === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/admin/links/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || "Status update failed" });
        return;
      }
      setBanner({
        type: "ok",
        text: `/${item.slug} ${nextStatus === "active" ? "enabled" : "disabled"}`,
      });
      await loadAll();
    } catch {
      setBanner({ type: "err", text: "Network error while updating status" });
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete || deleting) return;
    setBanner(null);
    setDeleting(true);
    try {
      if (confirmDelete.kind === "personal") {
        const res = await fetch(`/api/admin/links/${confirmDelete.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner({ type: "err", text: data.error || "Delete failed" });
          return;
        }
        setBanner({ type: "ok", text: `Deleted /${confirmDelete.slug}` });
      } else {
        const res = await fetch(`/api/admin/moderation/${confirmDelete.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_link",
            reportId: confirmDelete.reportId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBanner({ type: "err", text: data.error || "Delete failed" });
          return;
        }
        setBanner({ type: "ok", text: `Deleted /${confirmDelete.slug}` });
      }
      setConfirmDelete(null);
      await loadAll();
    } catch {
      setBanner({ type: "err", text: "Network error while deleting link" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (importing) return;
    setBanner(null);
    setImporting(true);
    try {
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
    } catch {
      setBanner({ type: "err", text: "Network error during import" });
    } finally {
      setImporting(false);
    }
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
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/moderation/${linkId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reportId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || "Moderation failed" });
        return;
      }
      const actionLabels: Record<typeof action, string> = {
        disable_link: "Link paused",
        restore_link: "Link restored",
        delete_link: "Link deleted",
        dismiss_report: "Report dismissed and link restored",
        block_domain: "Website blocked",
      };
      setBanner({
        type: "ok",
        text: actionLabels[action],
      });
      await loadAll();
    } catch {
      setBanner({ type: "err", text: "Network error during moderation" });
    }
  }

  async function handleAddDomain(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    try {
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
      setBanner({
        type: "ok",
        text: `Blocked domain ${data.domain?.domain ?? ""}`.trim(),
      });
      await loadAll();
    } catch {
      setBanner({ type: "err", text: "Network error adding domain" });
    }
  }

  async function handleRemoveDomain(id: number, domain: string) {
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/blocklist?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || "Could not remove domain" });
        return;
      }
      setBanner({ type: "ok", text: `Removed ${domain} from blocklist` });
      await loadAll();
    } catch {
      setBanner({ type: "err", text: "Network error removing domain" });
    }
  }

  async function handleUpdateSettings(patch: Partial<AppSettingsState>) {
    setBanner(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "err", text: data.error || "Could not save settings" });
        return;
      }
      setSettings(data.settings);
      setExpiryHoursDraft(String(data.settings.defaultPublicExpiryHours));
      setBanner({ type: "ok", text: "Settings saved" });
    } catch {
      setBanner({ type: "err", text: "Network error saving settings" });
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

  const inputClass =
    "h-10 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3.5 text-base text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-ink)] sm:text-sm";
  const monoInputClass = `${inputClass} font-mono`;

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start">
      {/* Left Navigation Rail */}
      <aside className="w-full shrink-0 md:sticky md:top-24 md:w-64">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-4 px-2">
            <div className="text-sm font-medium text-[var(--text)]">
              Owner workspace
            </div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              Manage links &amp; site settings
            </div>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Admin sections">
            <button
              type="button"
              aria-current={tab === "personal" ? "page" : undefined}
              onClick={() => setTab("personal")}
              className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 ${
                tab === "personal"
                  ? "bg-[var(--surface-elevated)] font-medium text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]"
              }`}
            >
              <IconLink size={16} className="shrink-0" />
              <span className="flex-1 text-left">Personal links</span>
              <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                {personalLinks.length}
              </span>
            </button>

            <button
              type="button"
              aria-current={tab === "moderation" ? "page" : undefined}
              onClick={() => setTab("moderation")}
              className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 ${
                tab === "moderation"
                  ? "bg-[var(--surface-elevated)] font-medium text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]"
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
              className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 ${
                tab === "settings"
                  ? "bg-[var(--surface-elevated)] font-medium text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]"
              }`}
            >
              <IconSettings size={16} className="shrink-0" />
              <span className="flex-1 text-left">Blocked websites &amp; settings</span>
            </button>
          </nav>

          <div className="mt-4 space-y-1 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]"
            >
              <IconCommand size={16} className="shrink-0" />
              <span className="flex-1 text-left">Quick create</span>
              <kbd className="rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-elevated)]/60 hover:text-[var(--text)]"
            >
              <IconLogOut size={16} className="shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-medium tracking-[-0.025em] text-[var(--text)] sm:text-3xl">
              {tab === "personal"
                ? "Personal links"
                : tab === "moderation"
                  ? "Public moderation"
                  : "Blocked websites & settings"}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {tab === "personal"
                ? "Create permanent custom links with optional visit limits and passwords"
                : tab === "moderation"
                  ? "Review reported public links and pause unsafe destinations"
                  : "Control public link creation, visit counting, and blocked websites"}
            </p>
          </div>

          {tab === "personal" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="zl-btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium"
              >
                <IconDownload size={14} />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="zl-btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium"
              >
                <IconDownload size={14} />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                className="zl-btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium"
              >
                <IconUpload size={14} />
                <span>{showImport ? "Close import" : "Import"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Summary Metrics Bar */}
        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)] sm:grid-cols-4 sm:divide-y-0">
          <div className="p-4 sm:p-5">
            <dt className="text-xs text-[var(--text-muted)]">Personal links</dt>
            <dd className="mt-2 font-mono text-2xl font-medium tabular-nums text-[var(--text)]">
              {personalLinks.length}
            </dd>
            <dd className="mt-1 text-xs tabular-nums text-[var(--text-secondary)]">
              {activePersonalCount} active
            </dd>
          </div>

          <div className="p-4 sm:p-5">
            <dt className="text-xs text-[var(--text-muted)]">Public links</dt>
            <dd className="mt-2 font-mono text-2xl font-medium tabular-nums text-[var(--text)]">
              {publicLinks.length}
            </dd>
            <dd className="mt-1 text-xs tabular-nums text-[var(--text-secondary)]">
              {flaggedPublicCount} flagged
            </dd>
          </div>

          <div className="p-4 sm:p-5">
            <dt className="text-xs text-[var(--text-muted)]">Open reports</dt>
            <dd className="mt-2 font-mono text-2xl font-medium tabular-nums text-[var(--text)]">
              {openReportsCount}
            </dd>
            <dd className="mt-1 text-xs tabular-nums text-[var(--text-secondary)]">
              {reports.length} total
            </dd>
          </div>

          <div className="p-4 sm:p-5">
            <dt className="text-xs text-[var(--text-muted)]">Blocked</dt>
            <dd className="mt-2 font-mono text-2xl font-medium tabular-nums text-[var(--text)]">
              {blocklist.length}
            </dd>
            <dd className="mt-1 text-xs text-[var(--text-secondary)]">
              Websites
            </dd>
          </div>
        </dl>

        {banner && (
          <div
            role={banner.type === "err" ? "alert" : "status"}
            className={`rounded-lg border px-4 py-3 text-xs ${
              banner.type === "ok"
                ? "border-[var(--positive)]/35 bg-[var(--positive-soft)] text-[var(--positive)]"
                : "border-[var(--negative)]/35 bg-[var(--negative-soft)] text-[var(--negative)]"
            }`}
          >
            {banner.text}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--text-muted)]">
            Loading workspace
          </div>
        ) : tab === "personal" ? (
          <div className="space-y-8">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
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
                      Short ending
                    </label>
                    <input
                      id="admin-new-slug"
                      type="text"
                      placeholder="github"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className={monoInputClass}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label
                      htmlFor="admin-new-url"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Long link
                    </label>
                    <input
                      id="admin-new-url"
                      type="url"
                      required
                      placeholder="https://github.com/username"
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      className={monoInputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-redirect"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Link behavior
                    </label>
                    <select
                      id="admin-new-redirect"
                      value={redirectCode}
                      onChange={(e) =>
                        setRedirectCode(
                          Number(e.target.value) as 301 | 302 | 307
                        )
                      }
                      className={inputClass}
                    >
                      <option value={302}>Standard (flexible)</option>
                      <option value={307}>Temporary (strict)</option>
                      <option value={301}>Permanent (cached)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-expiry"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Expire after (hours)
                    </label>
                    <input
                      id="admin-new-expiry"
                      type="number"
                      min={1}
                      placeholder="Never"
                      value={expiresHours}
                      onChange={(e) => setExpiresHours(e.target.value)}
                      className={monoInputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-new-max-clicks"
                      className="block text-xs text-[var(--text-secondary)]"
                    >
                      Max visits
                    </label>
                    <input
                      id="admin-new-max-clicks"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxClicks}
                      onChange={(e) => setMaxClicks(e.target.value)}
                      className={monoInputClass}
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
                      className={inputClass}
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
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="submit"
                    aria-disabled={creating}
                    className="zl-btn-primary inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  >
                    <span>{creating ? "Creating" : "Create link"}</span>
                    <IconPlus size={15} />
                  </button>
                </div>
              </form>
            </div>

            {showImport && (
              <div className="animate-modal rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-6">
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
                      className="h-9 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text)]"
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
                    className="w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] p-4 font-mono text-base text-[var(--text)] focus:border-[var(--accent-ink)] sm:text-xs"
                  />
                  <button
                    type="submit"
                    aria-disabled={importing}
                    className="zl-btn-primary inline-flex h-10 items-center rounded-lg px-5 text-xs font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  >
                    {importing ? "Importing" : "Run import"}
                  </button>
                </form>
              </div>
            )}

            {/* Personal Links List */}
            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {personalLinks.length === 0 ? (
                <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                  No saved links yet. Create one above or press Ctrl+K.
                </div>
              ) : (
                <div className="divide-y divide-[var(--line)]">
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
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              item.status === "active"
                                ? "border-[var(--positive)]/30 bg-[var(--positive-soft)] text-[var(--positive)]"
                                : "border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--text-muted)]"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.status === "active"
                                  ? "bg-[var(--positive)]"
                                  : "bg-[var(--text-muted)]"
                              }`}
                            />
                            <span>
                              {item.status === "disabled" ? "paused" : item.status}
                            </span>
                          </span>
                          {item.redirectCode === 301 && (
                            <span className="text-xs text-[var(--text-muted)]">
                              Permanent
                            </span>
                          )}
                          <span className="text-xs tabular-nums text-[var(--text-muted)]">
                            {item.clicks}
                            {item.maxClicks ? ` / ${item.maxClicks}` : ""}{" "}
                            {item.clicks === 1 && !item.maxClicks
                              ? "visit"
                              : "visits"}
                          </span>
                          {item.passwordProtected && (
                            <span
                              title="Password protected"
                              className="inline-flex items-center text-[var(--text-muted)]"
                            >
                              <IconLock size={14} />
                              <span className="sr-only">Password protected</span>
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
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors duration-150 ${
                            copiedId === item.id
                              ? "border-[var(--positive)]/35 bg-[var(--positive-soft)] font-medium text-[var(--positive)]"
                              : "border-[var(--line-strong)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)]"
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
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                        >
                          <span>Preview</span>
                          <IconArrowUpRight size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                        >
                          <IconEdit size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className="inline-flex h-8 items-center rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                        >
                          {item.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              kind: "personal",
                              id: item.id,
                              slug: item.slug,
                            })
                          }
                          aria-label={`Delete /${item.slug}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-opacity hover:opacity-85"
                        >
                          <IconTrash size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : tab === "moderation" ? (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Reported links
              </h2>
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                {reports.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No reports to review right now.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
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
                            <span className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--warning)]">
                              {rep.reason}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              Report: {rep.reportStatus} · Link:{" "}
                              {rep.linkStatus === "disabled" ? "paused" : rep.linkStatus}
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
                            className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
                          >
                            Pause link
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
                            className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                          >
                            Block website
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
                            className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                          >
                            Dismiss &amp; restore
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                kind: "moderation",
                                id: rep.linkId,
                                slug: rep.slug,
                                reportId: rep.reportId,
                              })
                            }
                            aria-label={`Delete /${rep.slug}`}
                            className="h-8 rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-opacity hover:opacity-85"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Public links
              </h2>
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                {publicLinks.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                    No public links have been created yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
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
                              className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                                pl.status === "active"
                                  ? "border-[var(--positive)]/30 bg-[var(--positive-soft)] text-[var(--positive)]"
                                  : pl.status === "flagged"
                                    ? "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]"
                                    : "border-[var(--negative)]/30 bg-[var(--negative-soft)] text-[var(--negative)]"
                              }`}
                            >
                              {pl.status === "disabled" ? "paused" : pl.status}
                            </span>
                            <span className="text-xs tabular-nums text-[var(--text-muted)]">
                              {pl.clicks} {pl.clicks === 1 ? "visit" : "visits"}
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
                              className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate(pl.id, "restore_link")
                              }
                              className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleModerate(pl.id, "block_domain")}
                            className="h-8 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                          >
                            Block website
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                kind: "moderation",
                                id: pl.id,
                                slug: pl.slug,
                              })
                            }
                            aria-label={`Delete /${pl.slug}`}
                            className="h-8 rounded-lg border border-[var(--negative)]/30 bg-[var(--negative-soft)] px-3 text-xs text-[var(--negative)] transition-opacity hover:opacity-85"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Site settings
              </h2>

              {settings && (
                <div className="divide-y divide-[var(--line)]">
                  <label className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">
                        Allow public link creation
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Visitors on the home page can create temporary short links
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
                        Count total visits
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Simple visit counter only — never saves IP addresses or browser info
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
                        Allow custom endings for visitors
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        When off, only you can pick custom link endings
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
                      Default public link expiration (hours)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="default-expiry-hours"
                        type="number"
                        min={1}
                        max={8760}
                        value={expiryHoursDraft}
                        onChange={(e) => setExpiryHoursDraft(e.target.value)}
                        className="h-10 w-28 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-elevated)] px-3.5 font-mono text-base tabular-nums text-[var(--text)] sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = Number.parseInt(expiryHoursDraft, 10);
                          if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8760) {
                            setBanner({
                              type: "err",
                              text: "Default expiration hours must be between 1 and 8760.",
                            });
                            return;
                          }
                          void handleUpdateSettings({
                            defaultPublicExpiryHours: parsed,
                          });
                        }}
                        className="zl-btn-ghost h-10 rounded-lg px-4 text-xs font-medium"
                      >
                        Save hours
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <h2 className="text-sm font-medium text-[var(--text)]">
                Blocked websites
              </h2>
              <form onSubmit={handleAddDomain} className="space-y-3">
                <div className="flex gap-2">
                  <label htmlFor="blocklist-domain" className="sr-only">
                    Website domain to block
                  </label>
                  <input
                    id="blocklist-domain"
                    type="text"
                    required
                    placeholder="spam.example"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className={`${monoInputClass} flex-1`}
                  />
                  <button
                    type="submit"
                    className="zl-btn-primary h-10 rounded-lg px-5 text-xs font-medium"
                  >
                    Block
                  </button>
                </div>
                <label htmlFor="blocklist-reason" className="sr-only">
                  Reason
                </label>
                <input
                  id="blocklist-reason"
                  type="text"
                  placeholder="Reason (optional)"
                  value={newDomainReason}
                  onChange={(e) => setNewDomainReason(e.target.value)}
                  className={inputClass}
                />
              </form>

              <div className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)]">
                {blocklist.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[var(--text-muted)]">
                    No websites blocked yet
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
                        onClick={() => handleRemoveDomain(b.id, b.domain)}
                        aria-label={`Remove ${b.domain} from blocklist`}
                        className="rounded px-2.5 py-1 text-xs text-[var(--negative)] hover:bg-[var(--negative-soft)]"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Create Modal */}
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
              Quick-create link
            </h2>
            <button
              type="button"
              onClick={() => setQuickOpen(false)}
              aria-label="Close quick-create dialog"
              className="rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Esc
            </button>
          </div>
          <label htmlFor="quick-slug-input" className="sr-only">
            Short ending
          </label>
          <input
            id="quick-slug-input"
            type="text"
            autoFocus
            placeholder="Short ending (optional)"
            value={quickSlug}
            onChange={(e) => setQuickSlug(e.target.value)}
            className={monoInputClass}
          />
          <label htmlFor="quick-url-input" className="sr-only">
            Long link
          </label>
          <input
            id="quick-url-input"
            type="url"
            required
            placeholder="https://example.com"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            className={monoInputClass}
          />
          <button
            type="submit"
            className="zl-btn-primary inline-flex h-11 w-full items-center justify-between rounded-lg px-5 text-sm font-medium"
          >
            <span>Create link</span>
            <span className="zl-btn-arrow inline-flex items-center">
              <IconArrowRight size={15} />
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
                className="rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-slug-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                Short ending
              </label>
              <input
                id="edit-slug-input"
                type="text"
                required
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                className={monoInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-url-input"
                className="block text-xs text-[var(--text-secondary)]"
              >
                Long link
              </label>
              <input
                id="edit-url-input"
                type="url"
                required
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className={monoInputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-redirect-select"
                  className="block text-xs text-[var(--text-secondary)]"
                >
                  Link behavior
                </label>
                <select
                  id="edit-redirect-select"
                  value={editCode}
                  onChange={(e) =>
                    setEditCode(Number(e.target.value) as 301 | 302 | 307)
                  }
                  className={inputClass}
                >
                  <option value={302}>Standard</option>
                  <option value={307}>Temporary</option>
                  <option value={301}>Permanent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-max-clicks-input"
                  className="block text-xs text-[var(--text-secondary)]"
                >
                  Max visits
                </label>
                <input
                  id="edit-max-clicks-input"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={editMaxClicks}
                  onChange={(e) => setEditMaxClicks(e.target.value)}
                  className={monoInputClass}
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
                className={inputClass}
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
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="zl-btn-ghost h-10 rounded-lg px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="zl-btn-primary h-10 rounded-lg px-5 text-xs font-medium"
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* Delete Confirmation Modal */}
      <ModalDialog
        open={confirmDelete !== null}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        ariaLabelledBy="confirm-delete-title"
        maxWidthClass="max-w-sm"
      >
        {confirmDelete && (
          <div className="space-y-4">
            <h2
              id="confirm-delete-title"
              className="font-mono text-base font-medium text-[var(--text)]"
            >
              Delete /{confirmDelete.slug}?
            </h2>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              This permanently removes the short link, its visit count, and any
              related reports. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                data-initial-focus
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="zl-btn-ghost h-10 rounded-lg px-4 text-xs font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                aria-disabled={deleting}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--negative)]/40 bg-[var(--negative)] px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                {deleting ? "Deleting" : "Delete link"}
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
