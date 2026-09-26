import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" {...props} />;
}

/** Pladsholder med samme mål som et drikkevarekort, så listen ikke hopper. */
export function BeverageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <Skeleton className="h-32 rounded-none" />
      <div className="flex flex-col gap-2 px-4 py-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
    </div>
  );
}
