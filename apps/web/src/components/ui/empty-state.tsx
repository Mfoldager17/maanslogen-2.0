import { SippingGlass } from "@/components/motion/sipping-glass";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]",
        "border border-dashed border-line-strong px-6 py-14 text-center",
        className,
      )}
    >
      <SippingGlass />
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
