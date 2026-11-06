"use client";

import { useState } from "react";
import type { GatheringNote } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { StarInput } from "@/components/review/star-input";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

/**
 * Din egen note. Kun din egen — API'et udleder hvem du er af tokenet, så der
 * er ingen brugervælger her.
 *
 * Den lå før som en udfoldet formular inde i listen. Det betød at en aften med
 * ti serveringer blev til ti stjernerækker og ti tekstfelter på én rulle, og
 * at det man skulle røre lå et tilfældigt sted lodret. Nu åbner den nedefra,
 * hvor tommelfingeren i forvejen er.
 */
export function NoteSheet({
  gatheringId,
  itemId,
  itemName,
  existing,
  open,
  onOpenChange,
}: {
  gatheringId: string;
  itemId: string;
  itemName: string;
  existing: GatheringNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Ingen effekt der synkroniserer felterne med `existing`. Forælderen giver
  // komponenten en `key` pr. post, så den monteres på ny når man åbner en
  // anden servering — og så er disse to startværdier allerede de rigtige.
  // En effekt der satte state ville udløse en ekstra render for ingenting.
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const { pending, fieldErrors, run } = useApiMutation();

  async function gem() {
    const result = await run(
      () => api.gatherings.upsertNote(gatheringId, itemId, { rating, body: body.trim() || null }),
      { success: "Noten er gemt" },
    );
    if (result !== null) onOpenChange(false);
  }

  async function slet() {
    const result = await run(() => api.gatherings.removeNote(gatheringId, itemId), {
      success: "Noten er slettet",
    });
    if (result !== null) onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={itemName}
      description={existing ? "Ret din note" : "Hvad synes du?"}
    >
      <div className="grid gap-5">
        <StarInput value={rating} onChange={setRating} error={fieldErrors.rating} />

        <Field label="Noter" error={fieldErrors.body}>
          {(props) => (
            <Textarea
              {...props}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Overraskende blød. Kunne godt drikke den igen."
            />
          )}
        </Field>

        <div className="grid gap-2">
          {/*
           * Fuld bredde og `lg`: det er den ene knap man rammer med en hånd
           * der også holder et glas. Uden en bedømmelse er der ikke noget at
           * gemme — API'et kræver den, og en tur frem og tilbage for at få det
           * at vide er spild når man står i et selskab.
           */}
          <Button size="lg" onClick={gem} disabled={pending || rating === 0} className="w-full">
            {existing ? "Gem ændringen" : "Gem noten"}
          </Button>

          {existing ? (
            <Button variant="danger" size="md" onClick={slet} disabled={pending} className="w-full">
              Slet noten
            </Button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
