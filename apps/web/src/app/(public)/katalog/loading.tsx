import { BeverageCardSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Skelettet spejler `page.tsx` blok for blok — samme ydre polstring, samme
 * overskriftsrække med sortering til højre, samme plads til de aktive filtre,
 * og samme gitter. Ellers hopper siden når indholdet lander, og det er netop
 * det et skelet er til for at undgå.
 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* h1: text-3xl → 36px. Undertekst: text-sm → 20px, med mt-1 over. */}
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-1 h-5 w-32" />
        </div>
        {/* SortSelect: etiket + select i h-10. */}
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Samme mb-6 som rækken med aktive filtre, der er tom indtil man filtrerer. */}
      <div className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        {/*
         * Filterkolonnen vises på alle bredder i page.tsx, så den skal også
         * være her på mobil — ellers skød hele gitteret nedad når filtrene kom.
         */}
        <div className="flex flex-col gap-7">
          {[0, 1, 2, 3].map((group) => (
            <div key={group}>
              {/* FacetGroup: h2 i text-xs (16px) med mb-2.5, så rækker i gap-2.5. */}
              <Skeleton className="mb-2.5 h-4 w-20" />
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-5 w-3/5" />
              </div>
            </div>
          ))}
        </div>

        <div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <BeverageCardSkeleton />
              </li>
            ))}
          </ul>
          {/* LoadMore: pt-8 om en knap i size=lg (h-12). */}
          <div className="flex justify-center pt-8">
            <Skeleton className="h-12 w-32 rounded-[var(--radius-control)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
