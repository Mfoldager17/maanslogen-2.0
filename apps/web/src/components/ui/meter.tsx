import { cn } from "@/lib/cn";

const SEGMENTER = 20;

/*
 * Skalaen tegnes som en maske på beholderen, ikke som 20 flex-børn.
 *
 * Med flex-børn og `gap-px` fordeler browseren en brøkdel af en pixel på
 * tværs af segmenterne: målt gav det segmenter på 12,55px og segmenter på
 * 0px i samme måler. Masken ligger derimod på den fælles beholder, så både
 * skalaen og udfyldningen skæres af præcis de samme streger — og fordi
 * udfyldningens bredde altid er et helt antal segmenter, lander kanten
 * aldrig midt i et af dem. Det er den samme lære som stjernerne.
 */
const MASKE =
  "repeating-linear-gradient(90deg, #000 0 calc(5% - 1px), transparent calc(5% - 1px) 5%)";

export function Meter({
  value,
  max = 5,
  tone = "accent",
  animate = true,
  className,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "signal" | "alt";
  animate?: boolean;
  className?: string;
}) {
  const andel = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const taendte = Math.round(andel * SEGMENTER);

  const farve = tone === "signal" ? "bg-signal" : tone === "alt" ? "bg-alt" : "bg-accent";

  return (
    <span
      className={cn("relative block h-2.5 w-full", className)}
      style={{ maskImage: MASKE, WebkitMaskImage: MASKE }}
      role="img"
      aria-label={`${value} af ${max}`}
    >
      {/* Skalaen skal kunne ses som en skala, også hvor der intet er aflæst. */}
      <span className="absolute inset-0 bg-ink-muted/40" aria-hidden="true" />
      {taendte > 0 ? (
        <span
          className={cn("absolute inset-y-0 left-0", farve, animate && "animate-needle")}
          style={{ width: `${(taendte / SEGMENTER) * 100}%` }}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

/** Måler med etiket til venstre og aflæst værdi til højre. */
export function MeterRow({
  label,
  value,
  max,
  display,
  tone,
  className,
}: {
  label: string;
  value: number;
  max?: number;
  display: string;
  tone?: "accent" | "signal" | "alt";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-mono min-w-0 truncate" title={label}>
          {label}
        </span>
        <span className="tabular shrink-0 whitespace-nowrap font-mono text-xs text-ink">
          {display}
        </span>
      </div>
      <Meter value={value} max={max} tone={tone} />
    </div>
  );
}
