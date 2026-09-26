import type { Review } from "@maanslogen/contracts";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelative, initialsOf } from "@/lib/format";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Ingen anmeldelser endnu"
        description="Den første anmeldelse sætter tonen for resten."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {reviews.map((review) => (
        <li key={review.id}>
          <article className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <header className="mb-3 flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent"
                aria-hidden="true"
              >
                {initialsOf(review.author.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{review.author.displayName}</p>
                <p className="text-xs text-ink-muted">
                  <time dateTime={review.createdAt}>{formatRelative(review.createdAt)}</time>
                </p>
              </div>
              <StarRating value={review.rating} size="sm" showValue={false} />
            </header>

            {review.title ? <h3 className="font-semibold">{review.title}</h3> : null}
            {review.body ? (
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {review.body}
              </p>
            ) : null}

            {review.answers.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {review.answers.map((answer) => (
                  <li
                    key={answer.questionId}
                    className="rounded-md bg-sunken px-2.5 py-1 text-xs text-ink-soft"
                    title={answer.prompt}
                  >
                    {shortPrompt(answer.prompt)}{" "}
                    <strong className="font-semibold text-ink">{answer.displayValue}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

/** "Hvor bitter er den?" → "Bitter" — chippen skal kunne læses i ét blik. */
function shortPrompt(prompt: string): string {
  const cleaned = prompt.replace(/\?$/, "").replace(/^(hvor|hvilke[nt]?|ville du|hvad)\s+/i, "");
  const words = cleaned.split(/\s+/).slice(0, 2).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
