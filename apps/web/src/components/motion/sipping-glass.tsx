import { cn } from "@/lib/cn";

/**
 * Tomt-tilstand: et glas der vipper som om nogen tager en tår. Bruges når
 * en liste ikke gav resultater — et tomt skærmbillede med lidt personlighed.
 */
export function SippingGlass({ className }: { className?: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("text-line-strong", className)}
      style={{
        animation: "mlg-tilt-sip 3.2s ease-in-out infinite",
        transformOrigin: "12px 20px",
      }}
    >
      <path
        d="M7.4 4.6h9.2l-1 12.2a1.6 1.6 0 0 1-1.6 1.5h-4a1.6 1.6 0 0 1-1.6-1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.6 20.8h4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.2 9.2h7.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
