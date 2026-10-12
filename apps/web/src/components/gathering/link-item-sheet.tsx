"use client";

import { useEffect, useState } from "react";
import type { Brand, BeverageType } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { alleSider } from "@/lib/api/alle-sider";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { BeveragePicker, type ValgtDrikkevare } from "./beverage-picker";

/**
 * Knytter en post til kataloget bagefter.
 *
 * Det er det almindelige forløb, ikke undtagelsen: til en festival skriver man
 * navnet som det står på skiltet og går videre, og koblingen sker hjemme i
 * sofaen. Derfor er den her og ikke gemt i admin.
 *
 * To veje ind. Enten findes drikkevaren allerede, og så er det den der skal
 * vælges — ellers ville kataloget få en dublet. Eller også gør den ikke, og så
 * oprettes den her: `createBeverage` kræver både en type og et mærke, så det er
 * en lille formular og ikke ét tryk. Mærket kan oprettes undervejs; typen kan
 * ikke, for den hænger på en kategori og hører til i admin.
 *
 * Typer og mærker hentes først når arket åbnes. De er sjældent nødvendige, og
 * styringssiden skal ikke vente på dem for at vise listen.
 */
export function LinkItemSheet({
  gatheringId,
  itemId,
  itemNavn,
  udgivet,
  open,
  onOpenChange,
}: {
  gatheringId: string;
  itemId: string;
  itemNavn: string;
  /** Afgør hvornår noterne bliver til anmeldelser — og hvad vi lover her. */
  udgivet: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [valgt, setValgt] = useState<ValgtDrikkevare | null>(null);
  const [opretter, setOpretter] = useState(false);
  const [navn, setNavn] = useState(itemNavn);
  const [typeId, setTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [nytMaerke, setNytMaerke] = useState("");

  const [typer, setTyper] = useState<BeverageType[]>([]);
  const [maerker, setMaerker] = useState<Brand[]>([]);
  const [henter, setHenter] = useState(false);

  const { pending, fieldErrors, run } = useApiMutation();

  useEffect(() => {
    if (!open || !opretter || typer.length > 0) return;

    // `gaelder` frem for at nulstille i effektkroppen: lukkes arket mens
    // kaldet er undervejs, skal svaret ikke sætte state på en komponent der
    // ikke viser noget længere — og eslint tillader ikke setState her ude.
    let gaelder = true;
    void (async () => {
      setHenter(true);
      try {
        const [t, m] = await Promise.all([
          alleSider<BeverageType>((query) => api.types.list(query), { sort: "name" }),
          alleSider<Brand>((query) => api.brands.list(query), { sort: "name" }),
        ]);
        if (!gaelder) return;
        setTyper(t);
        setMaerker(m);
      } finally {
        if (gaelder) setHenter(false);
      }
    })();

    return () => {
      gaelder = false;
    };
  }, [open, opretter, typer.length]);

  const kanGemme = opretter
    ? navn.trim() !== "" && typeId !== "" && (brandId !== "" || nytMaerke.trim() !== "")
    : valgt !== null;

  async function gem() {
    if (!kanGemme) return;

    const result = await run(
      async () => {
        let drikkevareId = valgt?.id;

        if (opretter) {
          // Mærket først: uden det kan drikkevaren ikke oprettes, og et mærke
          // uden drikkevarer er harmløst hvis næste trin fejler.
          const maerke =
            brandId !== "" ? { id: brandId } : await api.brands.create({ name: nytMaerke.trim() });
          const drikkevare = await api.beverages.create({
            name: navn.trim(),
            typeId,
            brandId: maerke.id,
          });
          drikkevareId = drikkevare.id;
        }

        if (drikkevareId === undefined) throw new Error("Ingen drikkevare valgt");
        return api.gatherings.updateItem(gatheringId, itemId, { beverageId: drikkevareId });
      },
      {
        success: udgivet
          ? "Knyttet til kataloget. Noterne er lagt ind som anmeldelser."
          : "Knyttet til kataloget.",
      },
    );

    if (result !== null) onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Knyt til kataloget"
      description={`«${itemNavn}» blev skrevet i farten. Hvad var det?`}
    >
      <div className="grid gap-5">
        {opretter ? (
          <>
            <Field label="Navn" error={fieldErrors.name}>
              {(props) => (
                <Input
                  {...props}
                  autoFocus
                  value={navn}
                  disabled={pending}
                  onChange={(event) => setNavn(event.target.value)}
                />
              )}
            </Field>

            <Field label="Type" error={fieldErrors.typeId} hint={henter ? "Henter …" : undefined}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={typeId}
                  disabled={pending || henter}
                  onChange={(event) => setTypeId(event.target.value)}
                >
                  <option value="">Vælg …</option>
                  {typer.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field label="Mærke" error={fieldErrors.brandId}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={brandId}
                  disabled={pending || henter}
                  onChange={(event) => setBrandId(event.target.value)}
                >
                  <option value="">Opret et nyt …</option>
                  {maerker.map((maerke) => (
                    <option key={maerke.id} value={maerke.id}>
                      {maerke.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            {brandId === "" ? (
              <Field label="Nyt mærke" error={fieldErrors.name}>
                {(props) => (
                  <Input
                    {...props}
                    value={nytMaerke}
                    disabled={pending}
                    onChange={(event) => setNytMaerke(event.target.value)}
                    placeholder="Hernö"
                  />
                )}
              </Field>
            ) : null}

            <Button
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => setOpretter(false)}
              className="justify-start px-0"
            >
              ← Find den i kataloget i stedet
            </Button>
          </>
        ) : (
          <>
            <BeveragePicker valgt={valgt} onVaelg={setValgt} deaktiveret={pending} autoFocus />

            <Button
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={() => setOpretter(true)}
              className="justify-start px-0"
            >
              Står den ikke i kataloget? Opret den
            </Button>
          </>
        )}

        {/*
         * Sig hvad der sker med noterne, før det sker. Det er ikke til at
         * gætte, og forskellen betyder noget for den der trykker.
         */}
        <p className="text-sm text-ink-muted">
          {udgivet
            ? "Aftenens noter bliver til anmeldelser af drikkevaren. Har en deltager allerede anmeldt den, bliver den gamle anmeldelse stående, og noten bliver en note."
            : "Noterne bliver til anmeldelser når opslaget udgives — ikke før. Indtil da kan de stadig rettes."}
        </p>

        <Button size="lg" onClick={gem} disabled={pending || !kanGemme} className="w-full">
          {opretter ? "Opret og knyt" : "Knyt"}
        </Button>
      </div>
    </Sheet>
  );
}
