import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" {...props} />;
}

/**
 * Pladsholder med samme mål som et drikkevarekort, så listen ikke hopper.
 *
 * Hver blok spejler sin modpart i `beverage-card.tsx` — samme polstring,
 * samme `gap-2`, samme `min-h-10` til navnet, samme faste chip-række og
 * samme stjernerække. Måles kortets højde og skelettets, skal de være ens.
 */
export function BeverageCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <Skeleton className="h-28 rounded-b-none" />
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
        {/* Mærke · type på én linje → 16px */}
        <Skeleton className="h-4 w-28" />
        {/* Navnet fylder to linjer, og pladsen står altid åben. */}
        <div className="flex min-h-10 flex-col gap-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex h-5 gap-1">
          <Skeleton className="h-full w-12 rounded-full" />
          <Skeleton className="h-full w-16 rounded-full" />
        </div>
        <div className="mt-auto flex h-5 items-center pt-1.5">
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
    </div>
  );
}
