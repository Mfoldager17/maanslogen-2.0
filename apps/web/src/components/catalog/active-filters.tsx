"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { AttributeDefinition } from "@maanslogen/contracts";
import { withParams } from "@/lib/query-state";
import { formatCountry } from "@/lib/format";
import { dynamicRoute } from "@/lib/routes";

interface ActiveFilter {
  key: string;
  label: string;
}

/** Viser hvad der faktisk er slået til, så ingen undrer sig over et tomt resultat. */
export function ActiveFilters({
  filterable,
  categoryLabel,
  typeLabels,
}: {
  filterable: AttributeDefinition[];
  categoryLabel?: string;
  /** Slug → navn, så chippen viser "Single malt" og ikke slug'en. */
  typeLabels?: Record<string, string>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const chips: ActiveFilter[] = [];

  const q = params.get("q");
  if (q) chips.push({ key: "q", label: `Søgning: "${q}"` });

  if (params.get("categorySlug")) {
    chips.push({
      key: "categorySlug",
      label: categoryLabel ?? (params.get("categorySlug") as string),
    });
  }

  // Uden denne kunne man filtrere på type og hverken se hvad der var slået
  // til eller fjerne det igen — hele pointen med rækken her.
  const types = (params.get("typeSlugs") ?? "").split(",").filter(Boolean);
  if (types.length) {
    chips.push({
      key: "typeSlugs",
      label: types.map((slug) => typeLabels?.[slug] ?? slug).join(", "),
    });
  }

  const countries = (params.get("countryCodes") ?? "").split(",").filter(Boolean);
  if (countries.length) {
    chips.push({
      key: "countryCodes",
      label: countries.map((code) => formatCountry(code) ?? code).join(", "),
    });
  }

  const minRating = params.get("minRating");
  if (minRating) chips.push({ key: "minRating", label: `Mindst ${minRating} stjerner` });

  for (const definition of filterable) {
    const raw = params.get(`attr[${definition.key}]`);
    if (!raw) continue;

    let label: string;
    if (definition.dataType === "BOOLEAN") {
      label = definition.displayName;
    } else if (raw.includes("..")) {
      const [min, max] = raw.split("..");
      const unit = definition.unit ? ` ${definition.unit}` : "";
      label =
        min && max
          ? `${definition.displayName} ${min}–${max}${unit}`
          : min
            ? `${definition.displayName} fra ${min}${unit}`
            : `${definition.displayName} op til ${max}${unit}`;
    } else {
      const labels = raw
        .split("|")
        .map(
          (value) => definition.options?.find((option) => option.value === value)?.label ?? value,
        );
      label = `${definition.displayName}: ${labels.join(", ")}`;
    }

    chips.push({ key: `attr[${definition.key}]`, label });
  }

  if (chips.length === 0) return null;

  function clear(key: string) {
    router.push(dynamicRoute(`/katalog${withParams(params, { [key]: null })}`), { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-muted">Aktive filtre:</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => clear(chip.key)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft pl-3 pr-2.5 text-xs font-medium text-accent-hover transition-colors hover:bg-accent-soft/70"
        >
          {chip.label}
          <X className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Fjern filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push("/katalog")}
        className="h-8 rounded-full px-2 text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink"
      >
        Ryd alle
      </button>
    </div>
  );
}
