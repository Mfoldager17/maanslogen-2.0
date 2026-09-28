import { cn } from "@/lib/cn";
import { formatCount, formatRating } from "@/lib/format";

const SIZES = { sm: 12, md: 16, lg: 22 } as const;

const STAR_PATH = "M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.5l6.5-1z";

/**
 * Halve stjerner vises ved at lægge en udfyldt stjerne oven på en tom og
 * klippe den til den rigtige bredde. Ingen `clipPath`-id'er, som ville
 * kollidere hver gang to bedømmelser på samme side havde samme værdi.
 *
 * Klipningen sker på **hver enkelt stjerne**, ikke på rækken. Klippede man
 * rækken til en andel af sin samlede bredde, ville mellemrummene mellem
 * stjernerne tælle med: kanten landede i et mellemrum i stedet for på en
 * stjerne, og udfyldningen ramte op til 1,6px forbi stjernen bagved — ved
 * 8 ud af 11 halve trin. Det er den samme opbygning som `star-input`.
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
  const label =
    count === undefined
      ? `${formatRating(value)} ud af 5 stjerner`
      : `${formatRating(value)} ud af 5 stjerner baseret på ${count} anmeldelser`;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex shrink-0 gap-0.5" role="img" aria-label={label}>
        {[0, 1, 2, 3, 4].map((index) => {
          const fill = Math.max(0, Math.min(1, value - index));
          return (
            <span
              key={index}
              className="relative inline-flex shrink-0"
              style={{ width: px, height: px }}
            >
              <Star px={px} className="text-star-empty" />
              {fill > 0 ? (
                <span
                  className="absolute inset-y-0 left-0 flex overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                  aria-hidden="true"
                >
                  <Star px={px} className="text-star" />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>

      {showValue ? (
        // Tallet følger stjernernes størrelse. I `sm` — på drikkevarekortene —
        // konkurrerede `text-sm font-semibold` med selve navnet.
        <span
          className={cn("tabular shrink-0 font-semibold", size === "sm" ? "text-xs" : "text-sm")}
          aria-hidden="true"
        >
          {formatRating(value)}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className="tabular shrink-0 text-xs text-ink-muted" aria-hidden="true">
          ({formatCount(count)})
        </span>
      ) : null}
    </span>
  );
}

function Star({ px, className }: { px: number; className: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      className={cn("shrink-0 fill-current", className)}
      aria-hidden="true"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}
