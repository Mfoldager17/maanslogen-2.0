"use client";

import type { Brand, Category } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { SimpleResourcePanel } from "./simple-resource-panel";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatCountry, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Draft {
  name: string;
  countryCode: string;
  websiteUrl: string;
  description: string;
  categoryIds: string[];
  active: boolean;
}

const EMPTY: Draft = {
  name: "",
  countryCode: "",
  websiteUrl: "",
  description: "",
  categoryIds: [],
  active: true,
};

function toPayload(draft: Draft) {
  return {
    name: draft.name.trim(),
    countryCode: draft.countryCode.trim() || undefined,
    websiteUrl: draft.websiteUrl.trim() || undefined,
    description: draft.description.trim() || undefined,
    categoryIds: draft.categoryIds,
    active: draft.active,
  };
}

export function BrandPanel({ brands, categories }: { brands: Brand[]; categories: Category[] }) {
  return (
    <SimpleResourcePanel
      items={brands.map((brand) => ({
        ...brand,
        title: brand.name,
        subtitle: [formatCountry(brand.countryCode), `/${brand.slug}`].filter(Boolean).join(" · "),
        meta:
          brand.beverageCount === undefined ? null : (
            <span className="tabular shrink-0 whitespace-nowrap text-xs text-ink-muted">
              {formatNumber(brand.beverageCount)}{" "}
              {brand.beverageCount === 1 ? "drikkevare" : "drikkevarer"}
            </span>
          ),
      }))}
      emptyDraft={EMPTY}
      toDraft={(brand) => ({
        name: brand.name,
        countryCode: brand.countryCode ?? "",
        websiteUrl: brand.websiteUrl ?? "",
        description: brand.description ?? "",
        categoryIds: brand.categoryIds,
        active: brand.active,
      })}
      onCreate={(draft) => api.brands.create(toPayload(draft))}
      onUpdate={(id, draft) => api.brands.update(id, toPayload(draft))}
      onDelete={(id) => api.brands.remove(id)}
      labels={{
        singular: "Mærke",
        plural: "Mærker",
        emptyTitle: "Ingen mærker endnu",
        emptyDescription: "Bryggerier, vinhuse og destillerier.",
      }}
      renderForm={({ draft, setDraft, errors }) => (
        <>
          <Field label="Navn" error={errors.name} required>
            {(props) => (
              <Input
                {...props}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Mikkeller"
              />
            )}
          </Field>

          <Field label="Landekode" hint="To bogstaver, fx DK" error={errors.countryCode}>
            {(props) => (
              <Input
                {...props}
                value={draft.countryCode}
                maxLength={2}
                onChange={(event) =>
                  setDraft({ ...draft, countryCode: event.target.value.toUpperCase() })
                }
                className="w-24 uppercase"
              />
            )}
          </Field>

          <Field label="Hjemmeside" error={errors.websiteUrl}>
            {(props) => (
              <Input
                {...props}
                type="url"
                value={draft.websiteUrl}
                onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })}
                placeholder="https://"
              />
            )}
          </Field>

          <Field label="Beskrivelse" error={errors.description}>
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            )}
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Kategorier</legend>
            <p className="mb-2 text-xs text-ink-muted">
              Begrænser hvilke kategorier mærket kan bruges i.
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = draft.categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        categoryIds: active
                          ? draft.categoryIds.filter((id) => id !== category.id)
                          : [...draft.categoryIds, category.id],
                      })
                    }
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line-strong bg-canvas text-ink-soft hover:bg-sunken",
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Synlig på sitet
          </label>
        </>
      )}
    />
  );
}
