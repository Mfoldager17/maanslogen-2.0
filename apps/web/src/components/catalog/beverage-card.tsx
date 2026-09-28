import Link from "next/link";
import type { BeverageSummary } from "@maanslogen/contracts";
import { MediaImage } from "./media-image";
import { StarRating } from "@/components/ui/star-rating";

/**
 * Kortet er det sted man bladrer, ikke det sted man aflæser. Instrumenterne —
 * målerne, de spærrede versal-etiketter, statusprikken — bliver derfor på
 * drikkevaresiden og i bedømmelsesfordelingen, hvor der faktisk studeres tal.
 * Her står kun det man vælger ud fra: billede, mærke, navn, et par egenskaber
 * og stjerner.
 *
 * Hver blok har låst højde, så alle kort i gitteret er ens uanset indhold.
 * Målt spænd: 0px på alle bredder.
 */
export function BeverageCard({
  beverage,
  priority,
}: {
  beverage: BeverageSummary;
  priority?: boolean;
}) {
  const anmeldt = beverage.rating.count > 0;

  return (
    <article className="group relative min-w-0 rounded-[var(--radius-card)] border border-line bg-surface transition-colors hover:border-accent-line">
      <Link
        href={`/drikkevarer/${beverage.slug}`}
        className="flex h-full flex-col rounded-[var(--radius-card)]"
      >
        <div className="relative overflow-hidden rounded-t-[var(--radius-card)]">
          <MediaImage
            media={beverage.media}
            alt={beverage.name}
            variant="CARD"
            categoryName={beverage.categoryName}
            className="h-28 w-full"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
          <p
            className="truncate text-xs leading-4 text-ink-muted"
            title={`${beverage.brandName} · ${beverage.typeName}`}
          >
            {beverage.brandName} <span className="text-line-strong">·</span> {beverage.typeName}
          </p>

          {/*
           * To linjer, altid. Uden låst højde strakte ét langt navn hele rækken.
           *
           * Klemningen sidder på et <span> inde i overskriften, ikke på
           * overskriften selv: som flex-barn bliver `display: -webkit-box`
           * blokificeret til `flow-root`, og så falder `line-clamp` væk — målt
           * som en overskrift der blev klippet midt i tredje linje i stedet for
           * at ende i en ellipse.
           */}
          <h3 className="min-h-10 font-display text-sm font-medium leading-tight text-ink transition-colors group-hover:text-accent">
            <span className="line-clamp-2" title={beverage.name}>
              {beverage.name}
              {beverage.vintage ? (
                <span className="ml-1.5 font-normal text-ink-muted">{beverage.vintage}</span>
              ) : null}
            </span>
          </h3>

          {/* Præcis én linje egenskaber; en chip der ikke er plads til, falder helt væk. */}
          <div className="flex h-5 flex-wrap gap-1 overflow-hidden">
            {beverage.highlights.slice(0, 3).map((attribute) => (
              <span
                key={attribute.definitionId}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-sunken px-2 text-[0.6875rem] leading-5 text-ink-soft"
                title={`${attribute.displayName}: ${attribute.displayValue}`}
              >
                {attribute.dataType === "BOOLEAN" ? attribute.displayName : attribute.displayValue}
              </span>
            ))}
          </div>

          {/*
           * Uden anmeldelser vises ingen stjerner. Fem tomme ville læses som
           * "bedømt til nul" frem for "ikke bedømt endnu".
           */}
          <div className="mt-auto flex h-5 items-center pt-1.5">
            {anmeldt ? (
              <StarRating value={beverage.rating.average} count={beverage.rating.count} size="sm" />
            ) : (
              <span className="text-xs text-ink-muted">Ingen anmeldelser endnu</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
