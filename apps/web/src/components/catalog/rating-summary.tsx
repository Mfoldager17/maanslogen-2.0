import type { RatingSummary } from "@maanslogen/contracts";
import { StarRating } from "@/components/ui/star-rating";
import { formatRating } from "@/lib/format";

export function RatingSummaryPanel({ rating }: { rating: RatingSummary }) {
  const max = Math.max(1, ...Object.values(rating.distribution));

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      {rating.count === 0 ? (
        <p className="text-sm text-ink-muted">Ingen anmeldelser endnu. Bliv den første.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold leading-none tabular">
              {formatRating(rating.average)}
            </span>
            <span className="text-sm text-ink-muted">/ 5</span>
          </div>
          <StarRating value={rating.average} size="lg" showValue={false} className="mt-2.5" />
          <p className="mt-1 text-sm text-ink-muted">
            {rating.count} {rating.count === 1 ? "anmeldelse" : "anmeldelser"}
          </p>

          <ul className="mt-4 flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = rating.distribution[String(star)] ?? 0;
              return (
                <li key={star} className="flex items-center gap-2.5 text-xs">
                  <span className="tabular w-3 text-ink-muted">{star}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span
                      className="block h-full rounded-full bg-star"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-8 text-right text-ink-muted">{count}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
