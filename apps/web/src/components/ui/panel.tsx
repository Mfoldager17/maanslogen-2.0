import { cn } from "@/lib/cn";

/**
 * Fladens grundform: en boks med en titellinje øverst, som et vindue i en
 * terminal. Titlen står i spærrede versaler, og statusprikken til venstre
 * fortæller hvad boksen viser uden at fylde en linje.
 */
export function Panel({
  title,
  meta,
  tone = "neutral",
  marks = true,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  meta?: React.ReactNode;
  tone?: "neutral" | "accent" | "signal" | "alt";
  /** Hjørnemærker som på et instrument. Slå fra hvor de bliver til støj. */
  marks?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const prik =
    tone === "accent"
      ? "bg-accent"
      : tone === "signal"
        ? "bg-signal"
        : tone === "alt"
          ? "bg-alt"
          : "bg-ink-muted";

  return (
    <section
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border border-line bg-surface",
        marks && "corner-marks",
        className,
      )}
    >
      {title ? (
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", prik)} aria-hidden="true" />
          <h2 className="label-mono min-w-0 truncate text-ink-soft" title={title}>
            {title}
          </h2>
          {meta ? (
            <div className="ml-auto shrink-0 font-mono text-xs text-ink-muted">{meta}</div>
          ) : null}
        </header>
      ) : null}
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
