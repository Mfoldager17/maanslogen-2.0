import { cn } from "@/lib/cn";

/**
 * Måler der fyldes som væske i stedet for en almindelig fremdriftslinje.
 * Bruges til smagsprofilen. Værdien står også som tekst, så meningen ikke
 * hænger på farve eller bredde alene.
 */
export function LiquidBar({
  value,
  max = 5,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "positive";
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <span
      className={cn("relative block h-2 overflow-hidden rounded-full bg-sunken", className)}
      role="presentation"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
          tone === "accent" ? "bg-accent" : "bg-positive",
        )}
        style={{ width: `${percent}%` }}
      />
      {/*
       * Bølgen i overfladen af væsken.
       *
       * Den ydre span centrerer lodret; den indre bærer animationen, som selv
       * laver `translateX(-50%)` og derfor ikke kan dele transform med en
       * Tailwind-klasse. Uden den lodrette centrering hang klatten 8px ned
       * under en 8px høj bjælke, og `overflow-hidden` skar to tredjedele af
       * den væk — tilbage stod en spids tak i enden af hver bjælke.
       *
       * Ved 0 % er der ingen overflade at vise.
       */}
      {percent > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${percent}%` }}
        >
          <span
            className={cn(
              "block h-2.5 w-2.5 rounded-[40%]",
              tone === "accent" ? "bg-accent" : "bg-positive",
            )}
            style={{ animation: "mlg-surface-wobble 2.4s ease-in-out infinite" }}
          />
        </span>
      ) : null}
    </span>
  );
}
