import { cn } from "@/lib/cn";

/**
 * To glas der støder sammen. Vises når en anmeldelse er udgivet — et lille
 * øjeblik der markerer at man faktisk har bidraget med noget.
 */
export function Cheers({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex h-16 w-24 items-center justify-center", className)}
    >
      <Glass
        className="absolute left-0 origin-bottom-right text-accent"
        animation="mlg-clink-left"
      />
      <Glass
        className="absolute right-0 origin-bottom-left text-accent"
        animation="mlg-clink-right"
      />

      {[
        { top: "4px", left: "46%", delay: "0.38s" },
        { top: "10px", left: "34%", delay: "0.44s" },
        { top: "12px", left: "58%", delay: "0.5s" },
      ].map((spark) => (
        <span
          key={spark.left}
          className="absolute h-1.5 w-1.5 rounded-full bg-star"
          style={{
            top: spark.top,
            left: spark.left,
            animation: "mlg-spark 0.55s ease-out forwards",
            animationDelay: spark.delay,
          }}
        />
      ))}
    </span>
  );
}

function Glass({ className, animation }: { className?: string; animation: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ animation: `${animation} 0.9s cubic-bezier(0.36, 0.9, 0.4, 1) 0.1s both` }}
    >
      <path
        d="M7 4h10l-1.1 6.2a4 4 0 0 1-2.1 2.9L13 13.6V20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 20h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.6 7.4h8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
