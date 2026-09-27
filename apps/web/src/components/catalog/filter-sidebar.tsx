"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { AttributeDefinition, BeverageFacets, FacetBucket } from "@maanslogen/contracts";
import { toggleInList, withParams } from "@/lib/query-state";
import { cn } from "@/lib/cn";
import { formatCountry } from "@/lib/format";
import { dynamicRoute } from "@/lib/routes";
import { StarRating } from "@/components/ui/star-rating";

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
  const selectedBrands = (params.get("brandSlugs") ?? "").split(",").filter(Boolean);
  const selectedCountries = (params.get("countryCodes") ?? "").split(",").filter(Boolean);
  const minRating = params.get("minRating");

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
      {facets.categories.length > 0 ? (
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
      ) : null}

      {facets.types.length > 0 ? (
        <FacetGroup title="Type">
          <FacetList
            buckets={facets.types}
            selected={selectedTypes}
            onToggle={(value) => toggleCsv("typeSlugs", value)}
            søgeetiket="Søg i typer"
          />
        </FacetGroup>
      ) : null}

      {/*
       * Mærkerne kom fra API'et hele tiden — 60 facetter med tællinger — men
       * blev aldrig vist, så man kunne kun nå dem ved at klikke mærket på en
       * drikkevare. De er for mange til en ren afkrydsningsliste, deraf
       * søgefeltet og klipningen i `FacetList`.
       */}
      {facets.brands.length > 0 ? (
        <FacetGroup title="Mærke">
          <FacetList
            buckets={facets.brands}
            selected={selectedBrands}
            onToggle={(value) => toggleCsv("brandSlugs", value)}
            søgeetiket="Søg i mærker"
          />
        </FacetGroup>
      ) : null}

      <FacetGroup title="Bedømmelse">
        {[4, 3, 2].map((grænse) => (
          <label
            key={grænse}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
            title={`Mindst ${grænse} stjerner`}
          >
            <input
              type="radio"
              name="minRating"
              checked={minRating === String(grænse)}
              // Et klik på den valgte rydder filteret igen. Uden dette kunne
              // man kun skifte mellem grænser, aldrig komme tilbage til alle.
              onClick={() =>
                apply({ minRating: minRating === String(grænse) ? null : String(grænse) })
              }
              onChange={() => undefined}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <StarRating value={grænse} size="sm" showValue={false} />
            <span className="text-ink-muted">og op</span>
          </label>
        ))}
      </FacetGroup>

      {facets.countries.length > 0 ? (
        <FacetGroup title="Land">
          <FacetList
            buckets={facets.countries.map((bucket) => ({
              ...bucket,
              label: formatCountry(bucket.value) ?? bucket.value,
            }))}
            selected={selectedCountries}
            onToggle={(value) => toggleCsv("countryCodes", value)}
            søgeetiket="Søg i lande"
          />
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

/**
 * Søgning uden hensyn til accenter og versaler. Uden foldningen fandt "moe"
 * ikke "Moët & Chandon", og "oster" ikke "Øster Bryggeri" — på en dansk side
 * med franske og danske mærker er det de fleste af de interessante opslag.
 */
function fold(tekst: string): string {
  return tekst
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a");
}

/**
 * Afkrydsningsliste der kan tåle at være lang. Over `GRÆNSE` poster klippes
 * listen, og over `SØGEGRÆNSE` kommer der et søgefelt — mærkefacetten er 60
 * poster, og den er ubrugelig som én lang række felter.
 *
 * Valgte poster vises altid, også når de ligger uden for klipningen: ellers
 * kunne man slå et filter til, rulle videre, og ikke finde det igen.
 */
function FacetList({
  buckets,
  selected,
  onToggle,
  søgeetiket,
}: {
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
  søgeetiket: string;
}) {
  const GRÆNSE = 8;
  const SØGEGRÆNSE = 12;
  const [søg, setSøg] = useState("");
  const [udvidet, setUdvidet] = useState(false);

  /*
   * Et valgt filter uden træffere i sin egen dimension — fx et mærke der ikke
   * har nogen drikkevare med mindst fire stjerner — findes ikke i facetterne.
   * Uden denne linje forsvandt afkrydsningsfeltet, og så kunne man ikke slå
   * filteret fra igen uden at rydde alt.
   */
  const alle: FacetBucket[] = [
    ...buckets,
    ...selected
      .filter((value) => !buckets.some((bucket) => bucket.value === value))
      .map((value) => ({ value, label: value, count: 0 })),
  ];

  const nål = fold(søg);
  const fundet = nål ? alle.filter((b) => fold(b.label).includes(nål)) : alle;

  const synlige =
    udvidet || nål
      ? fundet
      : [
          ...fundet.slice(0, GRÆNSE),
          ...fundet.slice(GRÆNSE).filter((b) => selected.includes(b.value)),
        ];

  const skjulte = fundet.length - synlige.length;

  return (
    <>
      {alle.length > SØGEGRÆNSE ? (
        <input
          type="search"
          value={søg}
          onChange={(event) => setSøg(event.target.value)}
          placeholder={søgeetiket}
          aria-label={søgeetiket}
          className="mb-0.5 h-8 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 text-sm"
        />
      ) : null}

      {synlige.map((bucket) => (
        <FacetCheckbox
          key={bucket.value}
          label={bucket.label}
          count={bucket.count}
          checked={selected.includes(bucket.value)}
          onChange={() => onToggle(bucket.value)}
        />
      ))}

      {nål && fundet.length === 0 ? (
        <p className="text-xs text-ink-muted">Ingen træffere.</p>
      ) : null}

      {!nål && (skjulte > 0 || udvidet) ? (
        <button
          type="button"
          onClick={() => setUdvidet((forrige) => !forrige)}
          className="self-start text-xs font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          {udvidet ? "Vis færre" : `Vis alle (${fundet.length})`}
        </button>
      ) : null}
    </>
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
