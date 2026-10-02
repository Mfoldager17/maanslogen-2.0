"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { BeverageSummary } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Kun det listen skal bruge. Resten af katalogposten hører ikke til her. */
export interface ValgtDrikkevare {
  id: string;
  navn: string;
  maerke: string;
}

/** Under to tegn er søgningen hele kataloget, og svaret siger ingenting. */
const MINDSTE_SOEGNING = 2;

/**
 * Vælg en drikkevare fra kataloget.
 *
 * Til en festival skriver man navnet som det står på skiltet og går videre —
 * derfor er `beverageId` valgfri i modellen. Men lægger man listen på forhånd
 * til en smagning, står tingene allerede i kataloget, og at skrive dem af i
 * hånden ville både koste tid og betyde at posten bagefter skulle knyttes til
 * den rigtige drikkevare alligevel.
 *
 * Søgningen venter 250 ms efter sidste tastetryk: ét kald pr. ord frem for ét
 * pr. bogstav. Svar der kommer hjem efter et nyere kald bliver kasseret — uden
 * det kunne et langsomt svar på "her" lande oven på et hurtigt svar på
 * "hernö".
 */
export function BeveragePicker({
  valgt,
  onVaelg,
  deaktiveret = false,
  autoFocus = false,
}: {
  valgt: ValgtDrikkevare | null;
  onVaelg: (valg: ValgtDrikkevare | null) => void;
  deaktiveret?: boolean;
  /** Sættes hvor søgningen er det første man vil gøre. Se `AddItemSheet`. */
  autoFocus?: boolean;
}) {
  const [soegning, setSoegning] = useState("");
  const [fund, setFund] = useState<BeverageSummary[]>([]);
  const [henter, setHenter] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  // Tælleren afgør hvilket svar der stadig er det nyeste.
  const seneste = useRef(0);

  useEffect(() => {
    // Tælleren frem ved hver ændring, også når der ikke søges: et kald der
    // allerede er undervejs, når man sletter tilbage til ét bogstav, ville
    // ellers lande bagefter og fylde listen med fund til en søgning der ikke
    // står der længere.
    const mit = seneste.current + 1;
    seneste.current = mit;

    const ord = soegning.trim();
    if (valgt !== null || ord.length < MINDSTE_SOEGNING) return;

    const timer = setTimeout(async () => {
      setHenter(true);
      try {
        const side = await api.beverages.list({ q: ord, limit: 8, sort: "name", order: "asc" });
        if (seneste.current !== mit) return;
        setFund(side.items);
        setFejl(null);
      } catch {
        if (seneste.current !== mit) return;
        setFund([]);
        setFejl("Kunne ikke søge i kataloget. Skriv navnet i stedet.");
      } finally {
        if (seneste.current === mit) setHenter(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [soegning, valgt]);

  const soeger = valgt === null && soegning.trim().length >= MINDSTE_SOEGNING;

  if (valgt !== null) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] border border-line bg-sunken px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{valgt.navn}</span>
          <span className="block truncate text-xs text-ink-muted">{valgt.maerke}</span>
        </span>
        <Button
          variant="ghost"
          size="md"
          className="w-11 shrink-0 px-0"
          aria-label="Vælg en anden"
          disabled={deaktiveret}
          onClick={() => {
            onVaelg(null);
            setSoegning("");
          }}
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Field label="Søg i kataloget" error={fejl ?? undefined}>
        {(props) => (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              {...props}
              type="search"
              autoFocus={autoFocus}
              value={soegning}
              disabled={deaktiveret}
              onChange={(event) => setSoegning(event.target.value)}
              placeholder="Hernö, Nordisk, Laphroaig …"
              className="pl-9"
            />
          </div>
        )}
      </Field>

      {/*
       * Afledt frem for gemt: nulstillede effekten `fund`, ville den skrive
       * state uden for en hændelse — og de tidligere fund ville blinke væk
       * ved hvert tastetryk i stedet for at blive stående til de nye kommer.
       */}
      {soeger ? (
        henter ? (
          <p className="text-xs text-ink-muted">Søger …</p>
        ) : fund.length === 0 ? (
          <p className="text-xs text-ink-muted">
            Ingen i kataloget hedder det. Skriv navnet nedenfor i stedet.
          </p>
        ) : (
          <ul className="grid gap-1">
            {fund.map((drikkevare) => (
              <li key={drikkevare.id}>
                {/* Hele rækken er målet, ikke en knap i kanten. */}
                <button
                  type="button"
                  disabled={deaktiveret}
                  onClick={() =>
                    onVaelg({
                      id: drikkevare.id,
                      navn: drikkevare.name,
                      maerke: drikkevare.brandName,
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2 text-left transition-colors active:bg-canvas"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{drikkevare.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {drikkevare.brandName} · {drikkevare.typeName}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
