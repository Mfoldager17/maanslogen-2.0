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
          <p className="truncate text-xs text-ink-muted">
            {beverage.brandName} · {beverage.typeName}
          </p>
          <h3 className="font-semibold leading-snug transition-colors group-hover:text-accent">
            {beverage.name}
            {beverage.vintage ? (
              <span className="ml-1 font-normal text-ink-muted">{beverage.vintage}</span>
            ) : null}
          </h3>

          {beverage.highlights.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {beverage.highlights.slice(0, 3).map((attribute) => (
                <AttributeChip key={attribute.definitionId} attribute={attribute} />
              ))}
            </div>
          ) : null}

          <div className="mt-auto pt-2.5">
            {beverage.rating.count > 0 ? (
              <StarRating
                value={beverage.rating.average}
                size="sm"
                className="text-ink"
                count={undefined}
              />
            ) : (
              <span className="text-xs text-ink-muted">Ingen anmeldelser endnu</span>
            )}
            {beverage.rating.count > 0 ? (
              <span className="ml-1.5 text-xs text-ink-muted">
                · {formatCount(beverage.rating.count)} anmeldelser
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
