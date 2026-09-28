"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: { box: 28, stroke: 1.6 },
  md: { box: 44, stroke: 1.4 },
  lg: { box: 72, stroke: 1.1 },
} as const;

/**
 * Indlæsningsindikator: et glas der fyldes op. Fylder samme plads hele vejen,
 * så der ikke opstår layoutskift når indholdet lander.
 *
 * Bevægelsen er ren CSS og slås fra af `prefers-reduced-motion` (se globals.css);
 * glasset står så bare halvfyldt, hvilket stadig læses som "noget er i gang".
 */
export function GlassLoader({
  size = "md",
  label = "Henter …",
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  const { box, stroke } = SIZES[size];
  /*
   * Id'et var hardkodet. Står to indikatorer på samme side — admin-formularen
   * henter egenskaber mens et billede uploades — peger begge `url(#…)` på den
   * første, og forsvinder den, mister den anden sin klipning og tegner væsken
   * som en firkantet klat hen over glasset.
   */
  const clipId = useId();

  return (
    <div className={cn("flex flex-col items-center gap-3", className)} role="status">
      <svg width={box} height={box} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            {/* Formen væsken må fylde — selve glassets indre. */}
            <path d="M7.4 4.6h9.2l-1 12.2a1.6 1.6 0 0 1-1.6 1.5h-4a1.6 1.6 0 0 1-1.6-1.5z" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <rect
            x="6"
            y="3"
            width="12"
            height="17"
            className="animate-pour fill-accent/85"
            style={{ transformOrigin: "center bottom" }}
          />
          {[
            { cx: 10, cy: 16, r: 0.8, delay: "0.9s" },
            { cx: 13.5, cy: 17, r: 0.55, delay: "1.25s" },
            { cx: 11.8, cy: 15.4, r: 0.4, delay: "1.6s" },
          ].map((bubble) => (
            <circle
              key={`${bubble.cx}-${bubble.cy}`}
              cx={bubble.cx}
              cy={bubble.cy}
              r={bubble.r}
              className="fill-canvas/70"
              style={{
                animation: "mlg-bubble 1.5s ease-in infinite",
                animationDelay: bubble.delay,
              }}
            />
          ))}
        </g>

        <path
          d="M7.4 4.6h9.2l-1 12.2a1.6 1.6 0 0 1-1.6 1.5h-4a1.6 1.6 0 0 1-1.6-1.5z"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinejoin="round"
          className="text-line-strong"
        />
        <path
          d="M9.6 20.8h4.8"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-line-strong"
        />
      </svg>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}
