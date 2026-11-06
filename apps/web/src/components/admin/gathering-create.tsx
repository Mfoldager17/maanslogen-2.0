"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { gatheringKindSchema, type GatheringKind } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ARRANGEMENT_ETIKETTER, ARRANGEMENT_FORKLARINGER } from "@/lib/arrangementer";
import { dynamicRoute } from "@/lib/routes";

/**
 * Kun admin opretter arrangementer. Værten bliver automatisk deltager — det
 * sker i API'et, så den der holder smagningen ikke skal invitere sig selv for
 * at kunne skrive en note.
 */
export function GatheringCreate() {
  const router = useRouter();
  const [kind, setKind] = useState<GatheringKind>("TASTING");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [location, setLocation] = useState("");
  const { pending, fieldErrors, run } = useApiMutation();

  async function opret() {
    const result = await run(
      () =>
        api.gatherings.create({
          kind,
          title: title.trim(),
          summary: summary.trim() || undefined,
          // <input type="datetime-local"> giver lokal tid uden zone; API'et
          // vil have en ISO-streng med offset.
          heldAt: heldAt ? new Date(heldAt).toISOString() : undefined,
          location: location.trim() || undefined,
        }),
      { success: "Arrangementet er oprettet" },
    );

    if (result !== null) router.push(dynamicRoute(`/admin/arrangementer/${result.id}`));
  }

  return (
    <Panel title="Nyt arrangement" tone="accent">
      <div className="grid gap-4">
        <Field label="Slags" hint={ARRANGEMENT_FORKLARINGER[kind]} required>
          {(props) => (
            <NativeSelect
              {...props}
              value={kind}
              onChange={(event) => setKind(event.target.value as GatheringKind)}
            >
              {gatheringKindSchema.options.map((option) => (
                <option key={option} value={option}>
                  {ARRANGEMENT_ETIKETTER[option]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field label="Titel" error={fieldErrors.title} required>
          {(props) => (
            <Input
              {...props}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ginfestival i Øksnehallen"
            />
          )}
        </Field>

        <Field label="Kort om det" error={fieldErrors.summary}>
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Fire timer, sytten stande, ingen plan."
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hvornår" error={fieldErrors.heldAt}>
            {(props) => (
              <Input
                {...props}
                type="datetime-local"
                value={heldAt}
                onChange={(event) => setHeldAt(event.target.value)}
              />
            )}
          </Field>

          <Field label="Hvor" error={fieldErrors.location}>
            {(props) => (
              <Input
                {...props}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Øksnehallen, København"
              />
            )}
          </Field>
        </div>

        <div>
          <Button onClick={opret} disabled={pending || title.trim() === ""}>
            Opret arrangement
          </Button>
        </div>
      </div>
    </Panel>
  );
}
