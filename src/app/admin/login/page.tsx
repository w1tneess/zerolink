import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AdminLoginForm } from "@/components/admin-login-form";
import { Reveal } from "@/components/reveal";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader active="admin" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 md:py-24 sm:px-6">
        <Reveal>
          <AdminLoginForm />
        </Reveal>
      </main>
    </div>
  );
}
