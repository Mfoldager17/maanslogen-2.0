import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/cn";

/**
 * Ordmærket bærer sig selv. Prikken er den samme statusprik som sidder på
 * hvert panel — et lille tegn på at det hele er bygget af samme dele.
 */
export function Logo({ className, href = "/" }: { className?: string; href?: Route }) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex shrink-0 items-center gap-2 text-ink", className)}
      aria-label="Maanslogen — til forsiden"
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent transition-transform group-hover:scale-150"
        aria-hidden="true"
      />
      <span className="font-display text-lg font-bold leading-none tracking-tight">Maanslogen</span>
    </Link>
  );
}
