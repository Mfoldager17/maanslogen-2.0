"use client";

import type { BeverageType, Category } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { SimpleResourcePanel } from "./simple-resource-panel";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

interface Draft {
  categoryId: string;
  name: string;
  description: string;
  sortOrder: string;
  active: boolean;
}

function toPayload(draft: Draft) {
  return {
    categoryId: draft.categoryId,
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    sortOrder: Number(draft.sortOrder) || 0,
    active: draft.active,
  };
}

export function TypePanel({
  types,
  categories,
}: {
  types: BeverageType[];
  categories: Category[];
}) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <SimpleResourcePanel
      items={types.map((type) => ({
        ...type,
        title: type.name,
        subtitle: `${categoryName.get(type.categoryId) ?? "?"} · /${type.slug}`,
        meta:
          type.beverageCount === undefined ? null : (
            <span className="tabular shrink-0 whitespace-nowrap text-xs text-ink-muted">
              {formatNumber(type.beverageCount)}{" "}
              {type.beverageCount === 1 ? "drikkevare" : "drikkevarer"}
            </span>
          ),
      }))}
      emptyDraft={{
        categoryId: categories[0]?.id ?? "",
        name: "",
        description: "",
        sortOrder: "0",
        active: true,
      }}
      toDraft={(type) => ({
        categoryId: type.categoryId,
        name: type.name,
        description: type.description ?? "",
        sortOrder: String(type.sortOrder),
        active: type.active,
      })}
      onCreate={(draft) => api.types.create(toPayload(draft))}
      onUpdate={(id, draft) => api.types.update(id, toPayload(draft))}
      onDelete={(id) => api.types.remove(id)}
      labels={{
        singular: "Type",
        plural: "Typer",
        emptyTitle: "Ingen typer endnu",
        emptyDescription: "IPA, stout, rødvin … niveauet under kategorierne.",
      }}
      renderForm={({ draft, setDraft, errors }) => (
        <>
          <Field label="Kategori" error={errors.categoryId} required>
            {(props) => (
              <NativeSelect
                {...props}
                value={draft.categoryId}
                onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field label="Navn" error={errors.name} required>
            {(props) => (
              <Input
                {...props}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Stout"
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

          <Field label="Sortering">
            {(props) => (
              <Input
                {...props}
                type="number"
                value={draft.sortOrder}
                onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
              />
            )}
          </Field>

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
