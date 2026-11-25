import { SiteHeader } from "@/components/site-header";
import { PasswordGate } from "@/components/password-gate";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 md:py-24 sm:px-6">
        <Reveal>
          <PasswordGate slug={decodeURIComponent(slug)} />
        </Reveal>
      </main>
    </div>
  );
}
