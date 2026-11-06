"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

interface FieldShell {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Felter bygges altid som label + kontrol + fejl, med `aria-describedby` og
 * `aria-invalid` sat op. Så kan et felt ikke ende med en fejl som kun ses
 * visuelt — en almindelig udeladelse når hver formular laver sin egen markup.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShell & { children: (props: FieldControlProps) => React.ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

const CONTROL_BASE =
  // `text-base` på telefon, ikke `text-sm`: Safari på iOS zoomer ind på siden
  // når man rører et felt med skrift under 16px, og zoomer ikke ud igen. Det
  // er især slemt midt i en smagning, hvor man taster med én hånd. På større
  // skærme er 14px stadig det rigtige, deraf `sm:text-sm`.
  "w-full min-w-0 rounded-[var(--radius-control)] border bg-canvas px-3 text-base sm:text-sm text-ink " +
  "placeholder:text-ink-muted transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_BASE, "h-11 border-line-strong", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(CONTROL_BASE, "min-h-24 resize-y border-line-strong py-2.5", className)}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL_BASE, "h-11 border-line-strong", className)} {...props} />;
}
