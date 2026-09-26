import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Opret konto" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Opret konto</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Du skal kun bruge en e-mail og et navn at skrive under.
        </p>
      </div>
      <AuthForm mode="register" returnTo="/" />
    </div>
  );
}
