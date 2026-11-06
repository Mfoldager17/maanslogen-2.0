import type { GatheringDetail } from "@maanslogen/contracts";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { AddItemForm } from "./add-item-form";
import { ItemNotes } from "./item-notes";
import { NoteForm } from "./note-form";
import { PhotoGrid } from "./photo-grid";
import { PhotoUpload } from "./photo-upload";

/**
 * Arrangementet mens det står på. Rækkefølgen er den som værten har lagt —
 * `sortOrder` — og ikke tidspunkterne, for en post kan være skænket før en
 * anden blev skrevet ind.
 *
 * Hvad man må her er ikke gættet lokalt: `viewer` kommer fra API'et, som er
 * det eneste sted reglerne findes.
 */
export function GatheringLive({ detail, viewerId }: { detail: GatheringDetail; viewerId: string }) {
  const { viewer } = detail;

  return (
    <div className="grid gap-6">
      {detail.items.length === 0 ? (
        <EmptyState
          title="Listen er tom endnu"
          description={
            viewer.canAddItems
              ? "Skriv det første I smager herunder."
              : "Værten lægger tingene på efterhånden som de bliver skænket."
          }
        />
      ) : (
        <ol className="grid gap-4">
          {detail.items.map((item, index) => {
            const egen =
              viewer.attendeeId === null
                ? null
                : (item.notes.find((note) => note.attendeeId === viewer.attendeeId) ?? null);

            return (
              <li
                key={item.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display text-lg font-semibold tracking-tight">
                        {/* Blindt: navnet står der, men røbes ikke før man har smagt. */}
                        {item.blind && egen === null ? "Blind" : item.displayName}
                      </h3>
                      {item.blind ? <Badge tone="warning">Blind</Badge> : null}
                    </div>
                    {item.note ? <p className="mt-1 text-sm text-ink-muted">{item.note}</p> : null}
                  </div>

                  {item.averageRating !== null ? (
                    <StarRating value={item.averageRating} count={item.noteCount} size="sm" />
                  ) : null}
                </div>

                {viewer.canWriteNotes ? (
                  <div className="mt-4">
                    <NoteForm
                      gatheringId={detail.id}
                      itemId={item.id}
                      itemName={item.blind && egen === null ? "den blinde" : item.displayName}
                      existing={egen}
                    />
                  </div>
                ) : null}

                {item.notes.length > 0 ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <ItemNotes notes={item.notes} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {viewer.canAddItems ? <AddItemForm gatheringId={detail.id} /> : null}

      {viewer.canAddPhotos || detail.photos.length > 0 ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Billeder
            </h2>
            {viewer.canAddPhotos ? <PhotoUpload gatheringId={detail.id} /> : null}
          </div>

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
  );
}
