"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { loginSchema, registerSchema } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { dynamicRoute } from "@/lib/routes";

export function AuthForm({ mode, returnTo }: { mode: "login" | "register"; returnTo: string }) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [values, setValues] = useState({ email: "", displayName: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Samme skema som API'et validerer med — adgangskodekravene kan ikke
    // komme til at være forskellige de to steder.
    const parsed = isLogin
      ? loginSchema.safeParse({ email: values.email, password: values.password })
      : registerSchema.safeParse({
          email: values.email,
          displayName: values.displayName,
          password: values.password,
        });

    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        found[key] ??= issue.message;
      }
      setErrors(found);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      if (isLogin) {
        await api.auth.login(parsed.data as { email: string; password: string });
      } else {
        await api.auth.register(
          parsed.data as { email: string; displayName: string; password: string },
        );
      }
      router.push(dynamicRoute(returnTo));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.problem.detail ?? error.problem.title);
      } else {
        setFormError("Kunne ikke nå serveren. Prøv igen.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Field label="E-mail" error={errors.email} required>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
          />
        )}
      </Field>

      {!isLogin ? (
        <Field
          label="Visningsnavn"
          hint="Det navn der står på dine anmeldelser."
          error={errors.displayName}
          required
        >
          {(props) => (
            <Input
              {...props}
              autoComplete="nickname"
              value={values.displayName}
              onChange={(event) => set("displayName", event.target.value)}
            />
          )}
        </Field>
      ) : null}

      <Field
        label="Adgangskode"
        hint={isLogin ? undefined : "Mindst 12 tegn med store og små bogstaver samt et tal."}
        error={errors.password}
        required
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={values.password}
            onChange={(event) => set("password", event.target.value)}
          />
        )}
      </Field>

      <Button type="submit" size="lg" disabled={submitting} className="mt-1">
        {submitting ? "Et øjeblik …" : isLogin ? "Log ind" : "Opret konto"}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        {isLogin ? "Har du ikke en konto? " : "Har du allerede en konto? "}
        <Link
          href={isLogin ? "/opret" : "/log-ind"}
          className="font-semibold text-accent hover:underline"
        >
          {isLogin ? "Opret en" : "Log ind"}
        </Link>
      </p>
    </form>
  );
}
