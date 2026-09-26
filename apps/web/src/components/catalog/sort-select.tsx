"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import { withParams } from "@/lib/query-state";
import { dynamicRoute } from "@/lib/routes";

const OPTIONS = [
  { value: "rating:desc", label: "Højest bedømt" },
  { value: "reviewCount:desc", label: "Flest anmeldelser" },
  { value: "createdAt:desc", label: "Nyeste" },
  { value: "name:asc", label: "Navn A–Å" },
] as const;

export function SortSelect() {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = `${params.get("sort") ?? "rating"}:${params.get("order") ?? "desc"}`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-ink-muted">
        Sortér
      </label>
      <select
        id={id}
        value={OPTIONS.some((option) => option.value === current) ? current : "rating:desc"}
        disabled={pending}
        onChange={(event) => {
          const [sort, order] = event.target.value.split(":");
          startTransition(() =>
            router.push(
              dynamicRoute(
                `/katalog${withParams(params, { sort: sort ?? null, order: order ?? null })}`,
              ),
              { scroll: false },
            ),
          );
        }}
        className="h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
