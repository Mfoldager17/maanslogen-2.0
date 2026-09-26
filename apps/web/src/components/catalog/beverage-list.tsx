"use client";

import { useState } from "react";
import type { BeverageSummary } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { BeverageCard } from "@/components/catalog/beverage-card";
import { Button } from "@/components/ui/button";

/**
 * Listen plus "Vis flere", som faktisk lægger til.
 *
 * Før lå cursoren i URL'en: knappen skubbede `?cursor=…`, serveren hentede
 * den NÆSTE side, og de 24 man allerede kiggede på forsvandt. Knappen hed
 * "Vis flere" og opførte sig som "gå til næste side" — uden en vej tilbage.
 *
 * Cursoren hører heller ikke hjemme i URL'en: den beskriver hvor langt man
 * er nået, ikke hvad man søger efter. Et delt link med en cursor i viste
 * side to af noget, modtageren aldrig havde set side ét af. Filtrene bliver
 * i URL'en, cursoren bor her.
 */
export function BeverageList({
  initialItems,
  initialCursor,
  query,
}: {
  initialItems: BeverageSummary[];
  initialCursor: string | null;
  /** Samme filter som serveren brugte, så side to matcher side ét. */
  query: Record<string, unknown>;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setFailed(false);
    try {
      const next = await api.beverages.list({ ...query, cursor, withTotal: false });
      setItems((current) => {
        // Cursor-pagination skal ikke gentage en række, men en sortering med
        // mange ens værdier kan flytte rundt under os. Uden det her ville
        // det give en dublet-nøgle i React frem for bare en dublet.
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(next.pageInfo.nextCursor);
    } catch {
      // En fejl må ikke tømme det, man allerede kigger på.
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((beverage, index) => (
          <li key={beverage.id}>
            <BeverageCard beverage={beverage} priority={index < 4} />
          </li>
        ))}
      </ul>

      {cursor ? (
        <div className="flex flex-col items-center gap-2 pt-8">
          <Button variant="secondary" size="lg" onClick={loadMore} disabled={pending}>
            {pending ? "Henter …" : "Vis flere"}
          </Button>
          {failed ? (
            <p role="alert" className="text-sm text-ink-muted">
              Kunne ikke hente flere. Prøv igen.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
