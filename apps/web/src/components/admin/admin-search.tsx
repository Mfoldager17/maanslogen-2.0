"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { withParams } from "@/lib/query-state";
import { dynamicRoute } from "@/lib/routes";

export function AdminSearch({
  basePath,
  placeholder = "Søg",
}: {
  basePath: string;
  placeholder?: string;
}) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <form
      role="search"
      className="relative max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        startTransition(() =>
          router.push(dynamicRoute(`${basePath}${withParams(params, { q: trimmed || null })}`)),
        );
      }}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pl-9 pr-3 text-sm"
      />
    </form>
  );
}
