"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { dynamicRoute } from "@/lib/routes";

export function SearchField({ className }: { className?: string }) {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        router.push(
          trimmed ? dynamicRoute(`/katalog?q=${encodeURIComponent(trimmed)}`) : "/katalog",
        );
      }}
    >
      <label htmlFor={id} className="sr-only">
        Søg efter drikkevarer
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Søg i kataloget"
        className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted"
      />
    </form>
  );
}
