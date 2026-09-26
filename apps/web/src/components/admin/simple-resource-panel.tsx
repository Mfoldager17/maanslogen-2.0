"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDelete } from "./confirm-delete";
import { cn } from "@/lib/cn";

export interface ResourceItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
}

export interface ResourceFormProps<TDraft> {
  draft: TDraft;
  setDraft: (draft: TDraft) => void;
  errors: Record<string, string>;
}

/**
 * Listen til venstre, formularen til højre. Samme form for kategorier, typer
 * og mærker — de adskiller sig kun i hvilke felter formularen viser, som
 * kaldestedet leverer.
 */
export function SimpleResourcePanel<TDraft, TItem extends ResourceItem>({
  items,
  emptyDraft,
  toDraft,
  renderForm,
  onCreate,
  onUpdate,
  onDelete,
  labels,
}: {
  items: TItem[];
  emptyDraft: TDraft;
  toDraft: (item: TItem) => TDraft;
  renderForm: (props: ResourceFormProps<TDraft>) => React.ReactNode;
  onCreate: (draft: TDraft) => Promise<unknown>;
  onUpdate: (id: string, draft: TDraft) => Promise<unknown>;
  onDelete?: (id: string) => Promise<unknown>;
  labels: { singular: string; plural: string; emptyTitle: string; emptyDescription?: string };
}) {
  const mutation = useApiMutation();
  const [editing, setEditing] = useState<TItem | null>(null);
  const [draft, setDraft] = useState<TDraft>(emptyDraft);
  const [open, setOpen] = useState(false);

  function startCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  }

  function startEdit(item: TItem) {
    setEditing(item);
    setDraft(toDraft(item));
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await mutation.run(
      () => (editing ? onUpdate(editing.id, draft) : onCreate(draft)),
      { success: editing ? `${labels.singular} er opdateret` : `${labels.singular} er oprettet` },
    );
    if (result !== null) {
      setOpen(false);
      setEditing(null);
      setDraft(emptyDraft);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        {items.length === 0 ? (
          <EmptyState
            title={labels.emptyTitle}
            description={labels.emptyDescription}
            action={<Button onClick={startCreate}>Opret {labels.singular.toLowerCase()}</Button>}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-control)] border bg-surface px-4 py-3",
                  editing?.id === item.id ? "border-accent-line bg-accent-soft/40" : "border-line",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.title}</p>
                  {item.subtitle ? (
                    <p className="truncate text-xs text-ink-muted">{item.subtitle}</p>
                  ) : null}
                </div>
                {item.meta}
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  aria-label={`Redigér ${item.title}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-sunken hover:text-ink"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                {onDelete ? (
                  <ConfirmDelete
                    iconOnly
                    label={item.title}
                    onDelete={() => onDelete(item.id)}
                    description={`${labels.singular} arkiveres. API'et afviser det, hvis noget stadig peger på den.`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="h-fit lg:sticky lg:top-6">
        {open ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
            noValidate
          >
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-display text-lg font-semibold">
                {editing
                  ? `Redigér ${labels.singular.toLowerCase()}`
                  : `Ny ${labels.singular.toLowerCase()}`}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Luk formularen"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-sunken"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {mutation.formError ? <Alert tone="danger">{mutation.formError}</Alert> : null}

            {renderForm({ draft, setDraft, errors: mutation.fieldErrors })}

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={mutation.pending}>
                {mutation.pending ? "Gemmer …" : editing ? "Gem" : "Opret"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annullér
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={startCreate} className="w-full">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ny {labels.singular.toLowerCase()}
          </Button>
        )}
      </aside>
    </div>
  );
}
