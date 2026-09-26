const BUBBLES = Array.from({ length: 7 }, (_, index) => ({
  id: index,
  // Fordelt i en vifte opad, så det ligner brus frem for en eksplosion.
  x: `${-18 + index * 6}px`,
  y: `${-22 - (index % 3) * 8}px`,
  size: 3 + (index % 3),
  delay: index * 28,
}));

/**
 * Lille brus af bobler. `key={trigger}` genmonterer elementet, hvilket starter
 * CSS-animationen forfra — ingen state og ingen timer, der skal ryddes op.
 *
 * Rent pynt: `aria-hidden`, og ingen anden del af UI'et afhænger af den.
 * `prefers-reduced-motion` slår den fra (se globals.css).
 */
export function FizzBurst({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;

  return (
    <span
      key={trigger}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.id}
          className="absolute rounded-full bg-star"
          style={
            {
              width: bubble.size,
              height: bubble.size,
              "--fizz-x": bubble.x,
              "--fizz-y": bubble.y,
              animation: "mlg-fizz 0.6s ease-out forwards",
              animationDelay: `${bubble.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
