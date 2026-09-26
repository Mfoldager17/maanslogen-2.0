import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/format";

const SIZES = { sm: 12, md: 16, lg: 22 } as const;

const STAR_PATH = "M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.5l6.5-1z";

/**
 * Halve stjerner vises ved at lægge en udfyldt række oven på en tom og klippe
 * den til den rigtige bredde. Ingen `clipPath`-id'er, som ville kollidere hver
 * gang to bedømmelser på samme side havde samme værdi.
 *
 * Talværdien står ved siden af: stjerner alene kan hverken læses op eller
 * skelnes af folk der ikke ser farveforskellen.
 */
export function StarRating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  value: number;
  count?: number;
  size?: keyof typeof SIZES;
  showValue?: boolean;
  className?: string;
}) {
  const px = SIZES[size];
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  const label =
    count === undefined
      ? `${formatRating(value)} ud af 5 stjerner`
      : `${formatRating(value)} ud af 5 stjerner baseret på ${count} anmeldelser`;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex" role="img" aria-label={label}>
        <StarRow px={px} className="text-star-empty" />
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          <StarRow px={px} className="text-star" />
        </span>
      </span>

      {showValue ? (
        <span className="tabular text-sm font-semibold" aria-hidden="true">
          {formatRating(value)}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className="text-xs text-ink-muted" aria-hidden="true">
          ({count})
        </span>
      ) : null}
    </span>
  );
}

function StarRow({ px, className }: { px: number; className: string }) {
  return (
    <span className={cn("inline-flex shrink-0 gap-0.5", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <svg
          key={index}
          width={px}
          height={px}
          viewBox="0 0 24 24"
          className="shrink-0 fill-current"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
