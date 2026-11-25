import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="admin" />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 md:py-12 sm:px-6">
        <AdminDashboard />
      </main>
    </div>
  );
}
