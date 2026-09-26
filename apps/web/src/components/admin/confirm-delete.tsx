"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useApiMutation } from "@/lib/use-mutation";

/**
 * Sletning kræver altid en bekræftelse med navnet på det der forsvinder.
 * API'et afviser i øvrigt sletninger der ville efterlade forældreløse rækker,
 * så “er du sikker” ikke er den eneste beskyttelse.
 */
export function ConfirmDelete({
  label,
  description,
  onDelete,
  triggerLabel = "Slet",
  iconOnly = false,
}: {
  label: string;
  description?: string;
  onDelete: () => Promise<unknown>;
  triggerLabel?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useApiMutation();

  async function confirm() {
    const result = await mutation.run(onDelete, { success: `${label} blev fjernet` });
    if (result !== null) setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {iconOnly ? (
          <button
            type="button"
            aria-label={`${triggerLabel} ${label}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Button variant="danger" size="sm">
            {triggerLabel}
          </Button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
          <Dialog.Title className="font-display text-xl font-semibold">Fjern {label}?</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-ink-muted">
            {description ?? "Handlingen kan ikke fortrydes herfra."}
          </Dialog.Description>

          {mutation.formError ? (
            <Alert tone="danger" className="mt-4">
              {mutation.formError}
            </Alert>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Annullér</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={confirm} disabled={mutation.pending}>
              {mutation.pending ? "Fjerner …" : "Ja, fjern"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
