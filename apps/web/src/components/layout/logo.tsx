import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/cn";

export function Logo({ className, href = "/" }: { className?: string; href?: Route }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 text-ink", className)}
      aria-label="Maanslogen — til forsiden"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-accent"
      >
        <path d="M6 3h12l-1.2 6.4a5 5 0 0 1-2.3 3.3L13 13.6V20" />
        <path d="M9.5 20h5" />
        <path d="M6.6 6.8h10.8" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Maanslogen</span>
    </Link>
  );
}
