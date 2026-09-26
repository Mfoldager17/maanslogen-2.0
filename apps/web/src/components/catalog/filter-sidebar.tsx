"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { AttributeDefinition, BeverageFacets } from "@maanslogen/contracts";
import { toggleInList, withParams } from "@/lib/query-state";
import { cn } from "@/lib/cn";
import { formatCountry } from "@/lib/format";
import { dynamicRoute } from "@/lib/routes";

/**
 * Facetterne kommer fra API'et sammen med tællingerne, og attributfiltrene
 * bygges af de attributdefinitioner der er markeret `filterable` for den
 * valgte type. Sidebaren har altså ingen hårdkodet viden om øl eller vin —
 * tilføjer man en ny attribut i admin, dukker filteret op her af sig selv.
 */
export function FilterSidebar({
  facets,
  filterable,
  className,
}: {
  facets: BeverageFacets;
  filterable: AttributeDefinition[];
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(changes: Record<string, string | null>) {
    startTransition(() =>
      router.push(dynamicRoute(`/katalog${withParams(params, changes)}`), { scroll: false }),
    );
  }

  // Facetterne svarer med slugs, så filteret skal sendes som slugs. Det er
  // `typeSlugs`, ikke `typeIds` — sidstnævnte valideres som UUID'er.
  const selectedTypes = (params.get("typeSlugs") ?? "").split(",").filter(Boolean);
  const selectedCountries = (params.get("countryCodes") ?? "").split(",").filter(Boolean);

  function toggleCsv(key: string, value: string) {
    const current = (params.get(key) ?? "").split(",").filter(Boolean);
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    apply({ [key]: next.length ? next.join(",") : null });
  }

  return (
    <aside
      className={cn("flex flex-col gap-7", pending && "opacity-60 transition-opacity", className)}
      aria-busy={pending}
    >
      <FacetGroup title="Kategori">
        {facets.categories.map((bucket) => (
          <FacetCheckbox
            key={bucket.value}
            label={bucket.label}
            count={bucket.count}
            checked={params.get("categorySlug") === bucket.value}
            onChange={(checked) => apply({ categorySlug: checked ? bucket.value : null })}
          />
        ))}
      </FacetGroup>

      {facets.types.length > 0 ? (
        <FacetGroup title="Type">
          {facets.types.map((bucket) => (
            <FacetCheckbox
              key={bucket.value}
              label={bucket.label}
              count={bucket.count}
              checked={selectedTypes.includes(bucket.value)}
              onChange={() => toggleCsv("typeSlugs", bucket.value)}
            />
          ))}
        </FacetGroup>
      ) : null}

      {facets.countries.length > 0 ? (
        <FacetGroup title="Land">
          {facets.countries.map((bucket) => (
            <FacetCheckbox
              key={bucket.value}
              label={formatCountry(bucket.value) ?? bucket.value}
              count={bucket.count}
              checked={selectedCountries.includes(bucket.value)}
              onChange={() => toggleCsv("countryCodes", bucket.value)}
            />
          ))}
        </FacetGroup>
      ) : null}

      {filterable.length > 0 ? (
        <>
          <div className="h-px bg-line" />
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                Egenskaber
              </h2>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
                dynamisk
              </span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-ink-muted">
              Filtrene kommer fra de attributter der er markeret filtrerbare i admin.
            </p>

            <div className="flex flex-col gap-6">
              {filterable.map((definition) => (
                <AttributeFilter
                  key={definition.id}
                  definition={definition}
                  value={params.get(`attr[${definition.key}]`) ?? undefined}
                  onChange={(next) => apply({ [`attr[${definition.key}]`]: next })}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
        {title}
      </h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function FacetCheckbox({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="tabular text-xs text-ink-muted">{count}</span> : null}
    </label>
  );
}

function AttributeFilter({
  definition,
  value,
  onChange,
}: {
  definition: AttributeDefinition;
  value: string | undefined;
  onChange: (next: string | null) => void;
}) {
  if (definition.dataType === "BOOLEAN") {
    return (
      <FacetCheckbox
        label={`Kun ${definition.displayName.toLowerCase()}`}
        checked={value === "true"}
        onChange={(checked) => onChange(checked ? "true" : null)}
      />
    );
  }

  if (definition.dataType === "ENUM" || definition.dataType === "MULTI_ENUM") {
    const selected = (value ?? "").split("|").filter(Boolean);
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{definition.displayName}</legend>
        <div className="flex flex-col gap-2.5">
          {(definition.options ?? []).map((option) => (
            <FacetCheckbox
              key={option.value}
              label={option.label}
              checked={selected.includes(option.value)}
              onChange={() => onChange(toggleInList(value, option.value))}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (definition.dataType === "NUMBER") {
    const [min = "", max = ""] = (value ?? "").split("..");
    const commit = (nextMin: string, nextMax: string) => {
      const range = `${nextMin.trim()}..${nextMax.trim()}`;
      onChange(range === ".." ? null : range);
    };

    return (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {definition.displayName}
          {definition.unit ? (
            <span className="ml-1 font-normal text-ink-muted">({definition.unit})</span>
          ) : null}
        </legend>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            defaultValue={min}
            placeholder="Fra"
            aria-label={`${definition.displayName}, mindste værdi`}
            onBlur={(event) => commit(event.target.value, max)}
            className="h-9 w-1/2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm"
          />
          <input
            type="number"
            inputMode="decimal"
            defaultValue={max}
            placeholder="Til"
            aria-label={`${definition.displayName}, største værdi`}
            onBlur={(event) => commit(min, event.target.value)}
            className="h-9 w-1/2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm"
          />
        </div>
      </fieldset>
    );
  }

  return null;
}
