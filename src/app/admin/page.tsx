import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner workspace",
  description: "Manage personal custom links, reported links, and site settings.",
};

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="admin" />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1360px] flex-1 px-[var(--gutter)] py-8 md:py-12"
      >
        <AdminDashboard />
      </main>
    </div>
  );
}
