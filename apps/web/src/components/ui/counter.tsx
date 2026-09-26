"use client";

import { useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Et tal der tæller op til sin værdi første gang det kommer frem.
 *
 * Serveren renderer det færdige tal, så pladsen er rigtig fra start og
 * ingenting hopper — optællingen sker først efter hydrering. Har man bedt om
 * mindre bevægelse, springes den helt over.
 */
export function Counter({
  value,
  duration = 900,
  className,
}: {
  value: number | null;
  duration?: number;
  className?: string;
}) {
  const [vist, setVist] = useState(value);
  const startet = useRef(false);

  useEffect(() => {
    if (value === null || startet.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    startet.current = true;

    let ramme = 0;
    const start = performance.now();

    // Første billede sætter selv startværdien. Sætter man 0 synkront her,
    // udløser det en ekstra gennemtegning før animationen overhovedet er i gang.
    function tik(nu: number) {
      const t = Math.min(1, (nu - start) / duration);
      // Hurtigt ud, blødt ind — som en tæller der falder på plads.
      const lettet = 1 - Math.pow(1 - t, 3);
      setVist(Math.round(lettet * (value as number)));
      if (t < 1) ramme = requestAnimationFrame(tik);
    }

    ramme = requestAnimationFrame(tik);
    return () => cancelAnimationFrame(ramme);
  }, [value, duration]);

  return (
    <span className={cn("tabular", className)}>{vist === null ? "—" : formatCount(vist)}</span>
  );
}
