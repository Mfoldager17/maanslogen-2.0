import { Skeleton } from "@/components/ui/skeleton";

/**
 * Uden en indlæsningsgrænse her fanger `app/loading.tsx` navigationen, og den
 * ligger over `(public)/layout.tsx` — så sidehoved og sidefod forsvandt ved
 * hvert sideskift og hoppede ind igen bagefter. Grænsen ligger nu under dem.
 *
 * `/katalog` har sin egen, der spejler netop den side.
 */
export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-5 w-40" />
      <div className="mt-8 flex flex-col gap-4">
        {[0, 1, 2, 3].map((række) => (
          <Skeleton key={række} className="h-28 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
