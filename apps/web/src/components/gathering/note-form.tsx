"use client";

import { useState } from "react";
import type { GatheringNote } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { StarInput } from "@/components/review/star-input";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

/**
 * Din egen note på én post. Kun din egen — API'et udleder hvem du er af
 * tokenet, så der er ingen brugervælger her. Den gamle gren havde netop dét,
 * og så kunne noterne ikke tages for pålydende bagefter.
 */
export function NoteForm({
  gatheringId,
  itemId,
  itemName,
  existing,
}: {
  gatheringId: string;
  itemId: string;
  itemName: string;
  existing: GatheringNote | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [open, setOpen] = useState(existing === null);
  const { pending, fieldErrors, run } = useApiMutation();

  async function gem() {
    await run(
      () =>
        api.gatherings.upsertNote(gatheringId, itemId, {
          rating,
          body: body.trim() || null,
        }),
      { success: "Noten er gemt" },
    );
  }

  async function slet() {
    const result = await run(() => api.gatherings.removeNote(gatheringId, itemId), {
      success: "Noten er slettet",
    });
    if (result !== null) {
      setRating(0);
      setBody("");
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2.5">
        <p className="min-w-0 flex-1 text-sm text-ink-soft">
          Du har skrevet en note.{" "}
          {existing?.body ? <span className="text-ink-muted">«{existing.body}»</span> : null}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Ret
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-line-strong bg-canvas p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Din note om {itemName}
      </p>

      <StarInput value={rating} onChange={setRating} error={fieldErrors.rating} />

      <div className="mt-4">
        <Field label="Hvad syntes du?" error={fieldErrors.body}>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Overraskende blød. Kunne godt drikke den igen."
            />
          )}
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {/*
         * Uden en bedømmelse er der ikke noget at gemme — API'et kræver den,
         * og en runde frem og tilbage for at få det at vide er spild.
         */}
        <Button onClick={gem} disabled={pending || rating === 0} size="sm">
          {existing ? "Gem ændringen" : "Gem noten"}
        </Button>
        {existing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Fortryd
            </Button>
            <Button variant="danger" size="sm" onClick={slet} disabled={pending}>
              Slet
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
