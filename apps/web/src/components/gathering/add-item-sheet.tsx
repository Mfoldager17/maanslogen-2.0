"use client";

import { useState } from "react";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { BeveragePicker, type ValgtDrikkevare } from "./beverage-picker";

/**
 * To måder at sige hvad det er.
 *
 * Fra kataloget: posten er knyttet til drikkevaren med det samme, og noterne
 * fra aftenen kan findes igen fra drikkevarens egen side. Det er vejen når
 * listen lægges på forhånd — tingene står der allerede.
 *
 * Eller bare et navn: til en festival står man med en plastikkop og en
 * telefon, og det der står på skiltet findes måske slet ikke i kataloget.
 * Koblingen kan ske hjemme i sofaen bagefter, og derfor er `beverageId`
 * valgfri i modellen.
 *
 * `anledning` skifter teksten og hvad der har fokus når sheeten åbner. Midt i
 * et arrangement skriver man det man står med — og til en festival står det
 * sjældent i kataloget, så dér skal tastaturet frem i navnefeltet med det
 * samme. Lægger man listen i forvejen, er katalogsøgningen det første man vil.
 */
export function AddItemSheet({
  gatheringId,
  open,
  onOpenChange,
  anledning = "nu",
}: {
  gatheringId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anledning?: "nu" | "paa-forhaand";
}) {
  const [valgt, setValgt] = useState<ValgtDrikkevare | null>(null);
  const [label, setLabel] = useState("");
  const [blind, setBlind] = useState(false);
  const { pending, fieldErrors, run } = useApiMutation();

  const kanTilfoeje = valgt !== null || label.trim() !== "";

  async function tilfoej() {
    if (!kanTilfoeje) return;

    const result = await run(
      () =>
        api.gatherings.addItem(
          gatheringId,
          valgt !== null ? { beverageId: valgt.id, blind } : { label: label.trim(), blind },
        ),
      { success: "Tilføjet til listen" },
    );
    if (result !== null) {
      setValgt(null);
      setLabel("");
      setBlind(false);
      onOpenChange(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={anledning === "nu" ? "Hvad drikker I nu?" : "Læg noget på listen"}
      description="Vælg fra kataloget, eller skriv navnet som det står på skiltet"
    >
      <div className="grid gap-5">
        <BeveragePicker
          valgt={valgt}
          onVaelg={setValgt}
          deaktiveret={pending}
          autoFocus={anledning === "paa-forhaand"}
        />

        {/*
         * Fritekstfeltet forsvinder ikke når noget er valgt fra kataloget —
         * så ville sheeten hoppe i højden hver gang man valgte og fortrød.
         * Det er slået fra i stedet, og hvad der bliver sendt afhænger ikke
         * af hvad der står i et felt man ikke kan se.
         */}
        <Field
          label="… eller skriv et navn"
          error={fieldErrors.label}
          hint={valgt !== null ? "Du har valgt en fra kataloget." : undefined}
        >
          {(props) => (
            <Input
              {...props}
              autoFocus={anledning === "nu"}
              value={label}
              disabled={valgt !== null || pending}
              onChange={(event) => setLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && kanTilfoeje && !pending) void tilfoej();
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

        <Button size="lg" onClick={tilfoej} disabled={pending || !kanTilfoeje} className="w-full">
          Tilføj
        </Button>
      </div>
    </Sheet>
  );
}
