import type { RatingSummary } from "@maanslogen/contracts";
import { Panel } from "@/components/ui/panel";
import { Meter } from "@/components/ui/meter";
import { formatCount, formatRating } from "@/lib/format";

/**
 * Bedømmelsen som en aflæsning: tallet stort, fordelingen som fem målere.
 * Stjerner hører ikke til her — de er en vurdering, og det her er data.
 */
export function RatingSummaryPanel({ rating }: { rating: RatingSummary }) {
  const største = Math.max(1, ...Object.values(rating.distribution));

  return (
    <Panel
      title="Bedømmelse"
      tone="accent"
      meta={rating.count === 0 ? "ingen data" : formatCount(rating.count)}
    >
      {rating.count === 0 ? (
        <p className="font-mono text-sm text-ink-muted">
          Ingen anmeldelser endnu. Bliv den første.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="tabular font-display text-4xl font-bold leading-none text-ink">
              {formatRating(rating.average)}
            </span>
            <span className="label-mono whitespace-nowrap">/ 5</span>
            <span className="label-mono w-full whitespace-nowrap sm:w-auto">
              {formatCount(rating.count)} {rating.count === 1 ? "anmeldelse" : "anmeldelser"}
            </span>
          </div>

          <ul className="mt-5 flex flex-col gap-2">
            {[5, 4, 3, 2, 1].map((trin) => {
              const antal = rating.distribution[String(trin)] ?? 0;
              return (
                <li key={trin} className="flex items-center gap-3">
                  <span className="label-mono w-3 shrink-0">{trin}</span>
                  <Meter value={antal} max={største} className="min-w-0 flex-1" />
                  <span className="tabular w-12 shrink-0 text-right font-mono text-xs text-ink-muted">
                    {formatCount(antal)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
