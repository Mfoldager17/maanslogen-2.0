import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" {...props} />;
}

/**
 * Pladsholder med samme mål som et drikkevarekort, så listen ikke hopper.
 *
 * Hver blok spejler sin modpart i `beverage-card.tsx` — samme polstring,
 * samme `gap-1.5`, samme `min-h-11` til navnet og samme faste chip-række.
 * Den gamle udgave var 262px mod kortets 292px, så gitteret sprang 30px
 * pr. række i det øjeblik data landede.
 */
export function BeverageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <Skeleton className="h-32 rounded-none" />
      <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
        {/* Mærke · type, text-xs → 16px */}
        <Skeleton className="h-4 w-28" />
        {/* Navnet må fylde to linjer, og pladsen står altid åben. */}
        <div className="flex min-h-11 flex-col gap-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-0.5 flex h-[1.375rem] gap-1.5">
          <Skeleton className="h-full w-14 rounded-md" />
          <Skeleton className="h-full w-16 rounded-md" />
        </div>
        {/* Bedømmelsesrækken er 20px høj: snittet står i text-sm ved siden af stjernerne. */}
        <div className="pt-2.5">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </div>
  );
}
