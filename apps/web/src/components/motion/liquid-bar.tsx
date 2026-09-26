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
      {/* Bølgen i overfladen af væsken. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 h-3 w-3 rounded-[40%]",
          tone === "accent" ? "bg-accent" : "bg-positive",
        )}
        style={{
          left: `${percent}%`,
          animation: "mlg-surface-wobble 2.4s ease-in-out infinite",
        }}
      />
    </span>
  );
}
