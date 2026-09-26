import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/session";
import { first, type SearchParams } from "@/lib/query-state";
import { dynamicRoute } from "@/lib/routes";

export const metadata: Metadata = { title: "Log ind" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const returnTo = safeReturn(first(params, "retur"));

  if (await getCurrentUser()) redirect(dynamicRoute(returnTo));

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Log ind</h1>
        <p className="mt-1 text-sm text-ink-muted">Så kan du anmelde og gemme dine favoritter.</p>
      </div>
      <AuthForm mode="login" returnTo={returnTo} />
    </div>
  );
}

/** Kun interne stier — ellers ville `?retur=` være en åben viderestilling. */
function safeReturn(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
