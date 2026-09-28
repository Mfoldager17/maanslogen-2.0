import { cn } from "@/lib/cn";

/** En tast. Bruges i hjælpelinjer og i ⌘K-paletten. */
export function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] border border-line-strong",
        "bg-sunken px-1.5 font-mono text-[0.6875rem] font-medium leading-none text-ink-soft",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
