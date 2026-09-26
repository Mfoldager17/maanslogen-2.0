import Link from "next/link";
import type { BeverageSummary } from "@maanslogen/contracts";
import { MediaImage } from "./media-image";
import { Meter } from "@/components/ui/meter";
import { formatCount, formatRating } from "@/lib/format";

/**
 * Kortet er en aflæsning, ikke en reklame. Mærke og type står som en nøgle i
 * spærrede versaler, navnet i monospace, og bedømmelsen som et instrument med
 * faste segmenter frem for stjerner — stjernerne hører til på selve
 * drikkevaresiden, hvor der er plads til dem.
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

          {/* Aflæsningen står på billedet, hvor øjet lander først. */}
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[3px] border border-line-strong bg-canvas/85 px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-ink backdrop-blur-sm">
            <span
              className={`h-1 w-1 rounded-full ${anmeldt ? "bg-accent" : "bg-ink-muted"}`}
              aria-hidden="true"
            />
            {anmeldt ? formatRating(beverage.rating.average) : "—"}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
          <p className="label-mono truncate" title={`${beverage.brandName} · ${beverage.typeName}`}>
            {beverage.brandName} · {beverage.typeName}
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
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[3px] border border-line bg-sunken px-1.5 font-mono text-[0.6875rem] leading-5 text-ink-soft"
                title={`${attribute.displayName}: ${attribute.displayValue}`}
              >
                {attribute.dataType === "BOOLEAN" ? attribute.displayName : attribute.displayValue}
              </span>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
            <Meter value={anmeldt ? beverage.rating.average : 0} max={5} animate={anmeldt} />
            <p className="font-mono text-[0.6875rem] leading-4 text-ink-muted">
              {anmeldt ? (
                <>
                  <span className="tabular text-ink-soft">
                    {formatCount(beverage.rating.count)}
                  </span>{" "}
                  {beverage.rating.count === 1 ? "anmeldelse" : "anmeldelser"}
                </>
              ) : (
                "Ingen anmeldelser"
              )}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
