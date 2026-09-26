"use client";

import type { Category } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { SimpleResourcePanel } from "./simple-resource-panel";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

interface Draft {
  name: string;
  icon: string;
  description: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY: Draft = { name: "", icon: "", description: "", sortOrder: "0", active: true };

function toPayload(draft: Draft) {
  return {
    name: draft.name.trim(),
    icon: draft.icon.trim() || undefined,
    description: draft.description.trim() || undefined,
    sortOrder: Number(draft.sortOrder) || 0,
    active: draft.active,
  };
}

export function CategoryPanel({ categories }: { categories: Category[] }) {
  return (
    <SimpleResourcePanel
      items={categories.map((category) => ({
        ...category,
        title: `${category.icon ?? ""} ${category.name}`.trim(),
        subtitle: `/${category.slug}`,
        meta: category.active ? null : <Badge tone="warning">Skjult</Badge>,
      }))}
      emptyDraft={EMPTY}
      toDraft={(category) => ({
        name: category.name,
        icon: category.icon ?? "",
        description: category.description ?? "",
        sortOrder: String(category.sortOrder),
        active: category.active,
      })}
      onCreate={(draft) => api.categories.create(toPayload(draft))}
      onUpdate={(id, draft) => api.categories.update(id, toPayload(draft))}
      onDelete={(id) => api.categories.remove(id)}
      labels={{
        singular: "Kategori",
        plural: "Kategorier",
        emptyTitle: "Ingen kategorier endnu",
        emptyDescription: "Øl, vin, whisky … de øverste niveauer i kataloget.",
      }}
      renderForm={({ draft, setDraft, errors }) => (
        <>
          <Field label="Navn" error={errors.name} required>
            {(props) => (
              <Input
                {...props}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Øl"
              />
            )}
          </Field>

          <Field label="Ikon" hint="En emoji. Vises på kort og i menuer." error={errors.icon}>
            {(props) => (
              <Input
                {...props}
                value={draft.icon}
                onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
                placeholder="🍺"
                className="w-20 text-center text-xl"
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

          <Field label="Sortering" hint="Lavest vises først">
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
