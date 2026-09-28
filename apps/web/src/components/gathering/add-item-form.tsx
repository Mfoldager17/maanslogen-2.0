"use client";

import { useState } from "react";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/**
 * Til en festival står man med en plastikkop og en telefon. Ét felt, én knap —
 * navnet som det står på skiltet. Koblingen til kataloget sker hjemme i sofaen
 * bagefter, og derfor er `beverageId` valgfri i modellen.
 */
export function AddItemForm({ gatheringId }: { gatheringId: string }) {
  const [label, setLabel] = useState("");
  const [blind, setBlind] = useState(false);
  const { pending, fieldErrors, run } = useApiMutation();

  async function tilfoej() {
    const result = await run(
      () => api.gatherings.addItem(gatheringId, { label: label.trim(), blind }),
      { success: "Tilføjet til listen" },
    );
    if (result !== null) {
      setLabel("");
      setBlind(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-4">
      <Field label="Hvad drikker I nu?" error={fieldErrors.label}>
        {(props) => (
          <Input
            {...props}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && label.trim() && !pending) void tilfoej();
            }}
            placeholder="Nordisk Gin, batch 4"
          />
        )}
      </Field>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={blind}
            onChange={(event) => setBlind(event.target.checked)}
            className="size-4 rounded border-line-strong"
          />
          Blindsmagning
        </label>

        <Button onClick={tilfoej} disabled={pending || label.trim() === ""} size="sm">
          Tilføj
        </Button>
      </div>
    </div>
  );
}
