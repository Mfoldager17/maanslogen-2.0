import { cn } from "@/lib/cn";

// Faste værdier frem for Math.random(): ellers ville server og klient
// gengive forskellige bobler, og React ville klage over hydrering.
const BUBBLES = [
  { left: "12%", size: 7, delay: "0s", duration: "7.5s" },
  { left: "24%", size: 4, delay: "1.4s", duration: "6.2s" },
  { left: "38%", size: 9, delay: "2.6s", duration: "8.4s" },
  { left: "52%", size: 5, delay: "0.8s", duration: "6.8s" },
  { left: "63%", size: 6, delay: "3.4s", duration: "7.9s" },
  { left: "77%", size: 4, delay: "2.1s", duration: "6.5s" },
  { left: "88%", size: 8, delay: "4.2s", duration: "8.8s" },
];

/**
 * Bobler der langsomt stiger gennem en beholder. Dekorativ baggrund — ligger
 * bag indholdet og fanger ingen klik.
 */
export function BubbleField({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.left}
          className="absolute bottom-0 rounded-full border border-accent/25 bg-accent/10"
          style={{
            left: bubble.left,
            width: bubble.size,
            height: bubble.size,
            animation: `mlg-bubble ${bubble.duration} ease-in infinite`,
            animationDelay: bubble.delay,
          }}
        />
      ))}
    </span>
  );
}
