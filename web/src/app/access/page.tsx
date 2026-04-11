import { redirect } from "next/navigation";
import { AccessGateForm } from "@/components/access-gate-form";
import { accessGateConfigured } from "@/lib/access-gate";

type Props = {
  searchParams?: Promise<{ from?: string }>;
};

function safeRedirectTarget(from: string | undefined): string {
  if (typeof from !== "string" || !from.startsWith("/")) return "/";
  if (from.startsWith("//")) return "/";
  if (from.startsWith("/access")) return "/";
  return from;
}

export default async function AccessPage({ searchParams }: Props) {
  if (!accessGateConfigured()) {
    redirect("/");
  }

  const p = searchParams ? await searchParams : {};
  const redirectTo = safeRedirectTarget(p.from);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center px-4 py-16">
      <AccessGateForm redirectTo={redirectTo} />
    </main>
  );
}
