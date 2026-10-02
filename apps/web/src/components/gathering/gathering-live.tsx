"use client";

import { useState } from "react";
import { Camera, Plus } from "lucide-react";
import type { GatheringDetail, GatheringItem } from "@maanslogen/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { formatRating } from "@/lib/format";
import { AddItemSheet } from "./add-item-sheet";
import { ItemNotes } from "./item-notes";
import { NoteSheet } from "./note-sheet";
import { PhotoGrid } from "./photo-grid";
import { PhotoUpload } from "./photo-upload";

/**
 * Arrangementet mens det står på — bygget til en telefon, holdt i én hånd,
 * stående, med et glas i den anden.
 *
 * Derfor kompakte rækker frem for udfoldede formularer: en aften med ti
 * serveringer var før ti stjernerækker og ti tekstfelter på én lang rulle.
 * Nu er hver post én række man trykker på, og noten kommer op nedefra.
 *
 * Rækkefølgen er værtens — `sortOrder` — ikke tidspunkterne, for en post kan
 * være skænket før en anden blev skrevet ind.
 *
 * Hvad man må, gættes ikke lokalt: `viewer` kommer fra API'et, som er det
 * eneste sted reglerne findes.
 */
export function GatheringLive({ detail, viewerId }: { detail: GatheringDetail; viewerId: string }) {
  const { viewer } = detail;
  const [aabenPost, setAabenPost] = useState<GatheringItem | null>(null);
  const [tilfoejAaben, setTilfoejAaben] = useState(false);

  function egenNote(item: GatheringItem) {
    if (viewer.attendeeId === null) return null;
    return item.notes.find((note) => note.attendeeId === viewer.attendeeId) ?? null;
  }

  function visteNavn(item: GatheringItem) {
    // Blindt: navnet står i databasen, men røbes ikke før man selv har smagt.
    return item.blind && egenNote(item) === null ? "Blind" : item.displayName;
  }

  const harBundbjaelke = viewer.canAddItems || viewer.canAddPhotos;

  return (
    <>
      {/* Plads til bundbjælken, så den ikke dækker det sidste på listen. */}
      <div className={harBundbjaelke ? "grid gap-6 pb-24" : "grid gap-6"}>
        {detail.items.length === 0 ? (
          <EmptyState
            title="Listen er tom endnu"
            description={
              viewer.canAddItems
                ? "Tryk på Tilføj forneden når I smager det første."
                : "Værten lægger tingene på efterhånden som de bliver skænket."
            }
          />
        ) : (
          <ol className="grid gap-2">
            {detail.items.map((item, index) => {
              const egen = egenNote(item);
              const kanTrykke = viewer.canWriteNotes;

              const indhold = (
                <>
                  <span className="font-mono text-xs text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-base font-semibold tracking-tight">
                        {visteNavn(item)}
                      </span>
                      {item.blind ? <Badge tone="warning">Blind</Badge> : null}
                    </span>

                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                      {item.averageRating !== null ? (
                        <>
                          <StarRating value={item.averageRating} size="sm" showValue={false} />
                          <span>
                            {formatRating(item.averageRating)} · {item.noteCount}
                          </span>
                        </>
                      ) : (
                        <span>Ingen noter endnu</span>
                      )}
                    </span>
                  </span>

                  {/* Din egen status på posten — dét man scanner efter når
                      man er nået halvvejs gennem listen. */}
                  {kanTrykke ? (
                    egen ? (
                      <Badge tone="positive">{formatRating(egen.rating)}</Badge>
                    ) : (
                      <Badge tone="accent">Skriv</Badge>
                    )
                  ) : null}
                </>
              );

              return (
                <li key={item.id}>
                  {kanTrykke ? (
                    // Hele rækken er målet, ikke en lille knap i kanten.
                    <button
                      type="button"
                      onClick={() => setAabenPost(item)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-left transition-colors active:bg-sunken"
                    >
                      {indhold}
                    </button>
                  ) : (
                    <div className="flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
                      {indhold}
                    </div>
                  )}

                  {item.notes.length > 0 ? (
                    <div className="px-4 pt-3">
                      <ItemNotes notes={item.notes} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {viewer.canAddPhotos || detail.photos.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Billeder
            </h2>
            <PhotoGrid
              gatheringId={detail.id}
              photos={detail.photos}
              viewerId={viewerId}
              kanFjerne={viewer.canAddPhotos}
            />
          </section>
        ) : null}

        {!viewer.canWriteNotes && viewer.attendeeId !== null && detail.status === "PLANNED" ? (
          <p className="text-sm text-ink-muted">
            Noterne åbner når værten sætter arrangementet i gang.
          </p>
        ) : null}
      </div>

      {/*
       * Handlingsbjælken. Fast i bunden, hvor tommelfingeren er — ikke et
       * sted man skal rulle hen til. `safe-area-inset-bottom` holder den fri
       * af hjemmeindikatoren på en iPhone.
       */}
      {harBundbjaelke ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {viewer.canAddItems ? (
              <Button size="lg" onClick={() => setTilfoejAaben(true)} className="flex-1">
                <Plus size={18} />
                Tilføj
              </Button>
            ) : null}
            {viewer.canAddPhotos ? (
              <PhotoUpload
                gatheringId={detail.id}
                className={viewer.canAddItems ? "" : "flex-1"}
                icon={<Camera size={18} />}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {aabenPost ? (
        <NoteSheet
          key={aabenPost.id}
          gatheringId={detail.id}
          itemId={aabenPost.id}
          itemName={visteNavn(aabenPost)}
          existing={egenNote(aabenPost)}
          open
          onOpenChange={(open) => !open && setAabenPost(null)}
        />
      ) : null}

      <AddItemSheet gatheringId={detail.id} open={tilfoejAaben} onOpenChange={setTilfoejAaben} />
    </>
  );
}
