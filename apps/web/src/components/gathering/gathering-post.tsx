import type { GatheringDetail } from "@maanslogen/contracts";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/ui/star-rating";
import { formatTime } from "@/lib/format";
import { ItemNotes } from "./item-notes";

/**
 * Det færdige opslag. Det her er hvad man kommer tilbage til om et år: hvad
 * vi drak, i hvilken rækkefølge, og hvad hver især syntes dén aften.
 *
 * Noterne er låst på dette tidspunkt — udgivelsen fryser dem — så der er
 * ingen formularer her, kun tekst.
 */
export function GatheringPost({ detail }: { detail: GatheringDetail }) {
  // Kun dem der faktisk skrev noget. "Inviteret, men kom ikke" hører ikke
  // hjemme i et referat af aftenen.
  const medvirkende = detail.attendees.filter((attendee) => attendee.joinedAt !== null);

  return (
    <div className="grid gap-10">
      {detail.story ? (
        <div className="grid gap-4">
          {detail.story.split(/\n{2,}/).map((afsnit, index) => (
            <p key={index} className="text-[15px] leading-relaxed text-ink-soft">
              {afsnit}
            </p>
          ))}
        </div>
      ) : null}

      {medvirkende.length > 0 ? (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Med til det
          </h2>
          <ul className="flex flex-wrap gap-2">
            {medvirkende.map((attendee) => (
              <li key={attendee.id}>
                <Badge tone="neutral">{attendee.displayName}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.items.length > 0 ? (
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Det vi drak
          </h2>

          <ol className="grid gap-6">
            {detail.items.map((item, index) => (
              <li key={item.id} className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-ink-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {item.displayName}
                    </h3>
                    {item.blind ? <Badge tone="warning">Blindt</Badge> : null}
                    {/*
                     * Tidspunkterne er aftenens tidslinje. De står kun hvor de
                     * findes — en post der aldrig blev "skænket" har ingen.
                     */}
                    {item.servedAt ? (
                      <span className="font-mono text-xs text-ink-muted">
                        {formatTime(item.servedAt)}
                      </span>
                    ) : null}
                  </div>

                  {item.averageRating !== null ? (
                    <StarRating value={item.averageRating} count={item.noteCount} size="sm" />
                  ) : null}
                </div>

                {item.note ? <p className="text-sm text-ink-muted">{item.note}</p> : null}

                <ItemNotes notes={item.notes} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
