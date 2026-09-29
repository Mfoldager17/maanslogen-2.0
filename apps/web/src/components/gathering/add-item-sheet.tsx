"use client";

import { useState } from "react";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

/**
 * Til en festival står man med en plastikkop og en telefon. Ét felt, én knap —
 * navnet som det står på skiltet. Koblingen til kataloget sker hjemme i sofaen
 * bagefter, og derfor er `beverageId` valgfri i modellen.
 *
 * `autoFocus`: sheeten åbnes af en bevidst handling, så tastaturet skal frem
 * med det samme. Ellers er det to tryk for at skrive ét navn.
 */
export function AddItemSheet({
  gatheringId,
  open,
  onOpenChange,
}: {
  gatheringId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
      onOpenChange(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Hvad drikker I nu?"
      description="Skriv navnet som det står på skiltet"
    >
      <div className="grid gap-5">
        <Field label="Navn" error={fieldErrors.label}>
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && label.trim() && !pending) void tilfoej();
              }}
              placeholder="Nordisk Gin, batch 4"
            />
          )}
        </Field>

        {/* Hele rækken er klikbar, ikke kun afkrydsningsfeltet — 20px er ikke
            et mål man rammer stående. */}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={blind}
            onChange={(event) => setBlind(event.target.checked)}
            className="size-5 rounded border-line-strong"
          />
          Blindsmagning
        </label>

        <Button
          size="lg"
          onClick={tilfoej}
          disabled={pending || label.trim() === ""}
          className="w-full"
        >
          Tilføj
        </Button>
      </div>
    </Sheet>
  );
}
