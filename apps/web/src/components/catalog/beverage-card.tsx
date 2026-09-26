import Link from "next/link";
import type { BeverageSummary } from "@maanslogen/contracts";
import { MediaImage } from "./media-image";
import { AttributeChip } from "./attribute-chip";
import { StarRating } from "@/components/ui/star-rating";
import { formatCount } from "@/lib/format";

export function BeverageCard({
  beverage,
  priority,
}: {
  beverage: BeverageSummary;
  priority?: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-raise)]">
      <Link href={`/drikkevarer/${beverage.slug}`} className="flex h-full flex-col">
        <MediaImage
          media={beverage.media}
          alt={beverage.name}
          variant="CARD"
          categoryName={beverage.categoryName}
          className="h-32 w-full"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />

        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
          <p
            className="truncate text-xs text-ink-muted"
            title={`${beverage.brandName} · ${beverage.typeName}`}
          >
            {beverage.brandName} · {beverage.typeName}
          </p>
          {/*
           * Navnet må fylde højst to linjer. Uden klemning strakte en drikkevare
           * med et langt navn hele gitterrækken — målt spænd mellem kort i samme
           * gitter var 332px. `min-h` holder pladsen, så et kort med ét-linjers
           * navn er lige så højt som et med to.
           */}
          <h3
            className="line-clamp-2 min-h-11 font-semibold leading-snug transition-colors group-hover:text-accent"
            title={beverage.name}
          >
            {beverage.name}
            {beverage.vintage ? (
              <span className="ml-1 font-normal text-ink-muted">{beverage.vintage}</span>
            ) : null}
          </h3>

          {/*
           * Præcis én linje chips, altid. Højden er låst og resten klippes væk —
           * og fordi rækken ombrydes, falder en chip der ikke er plads til helt
           * ned på næste linje og forsvinder hel, aldrig skåret midt over.
           * Hele attributlisten står på drikkevarens egen side.
           */}
          <div className="mt-0.5 flex h-[1.375rem] flex-wrap gap-1.5 overflow-hidden">
            {beverage.highlights.slice(0, 3).map((attribute) => (
              <AttributeChip key={attribute.definitionId} attribute={attribute} />
            ))}
          </div>

          <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-2.5">
            {beverage.rating.count > 0 ? (
              <>
                {/*
                 * `shrink-0`: stjernernes udfyldning er en andel af rækkens egen
                 * bredde, så rækken må ikke klemmes — så rammer udfyldningen
                 * ikke længere stjernerne bagved.
                 */}
                <StarRating
                  value={beverage.rating.average}
                  size="sm"
                  className="shrink-0 text-ink"
                  count={undefined}
                />
                <span className="truncate text-xs text-ink-muted">
                  · {formatCount(beverage.rating.count)}{" "}
                  {beverage.rating.count === 1 ? "anmeldelse" : "anmeldelser"}
                </span>
              </>
            ) : (
              <span className="truncate text-xs text-ink-muted">Ingen anmeldelser endnu</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
