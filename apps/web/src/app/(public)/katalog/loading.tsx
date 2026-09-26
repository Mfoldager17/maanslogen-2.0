import { BeverageCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-4 w-32" />
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <div className="hidden flex-col gap-6 lg:flex">
          {[0, 1, 2].map((group) => (
            <div key={group} className="flex flex-col gap-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <BeverageCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
