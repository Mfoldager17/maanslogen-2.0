import type { GatheringNote } from "@maanslogen/contracts";
import { StarRating } from "@/components/ui/star-rating";

/**
 * Alles noter om én post. Bruges både mens arrangementet er i gang og i det
 * færdige opslag — det er den samme tekst, bare låst bagefter.
 */
export function ItemNotes({ notes }: { notes: GatheringNote[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-ink-muted">Ingen har skrevet noget om den endnu.</p>;
  }

  return (
    <ul className="grid gap-3">
      {notes.map((note) => (
        <li key={note.id} className="border-l-2 border-line pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{note.authorName}</span>
            <StarRating value={note.rating} size="sm" />
          </div>
          {note.body ? <p className="mt-1 text-sm text-ink-soft">{note.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}
