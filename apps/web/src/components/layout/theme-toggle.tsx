"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Ikonet skiftes med CSS ud fra `.dark`-klassen på <html>, ikke med state.
 *
 * Det almindelige "mounted"-mønster (sæt state i en effect for at undgå
 * hydreringsfejl) betyder at knappen er tom ved første render. Her er der
 * ingen effect, ingen state og intet spring.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      // Etiketten beskriver handlingen, ikke tilstanden, så den er rigtig
      // uanset hvilket tema der er aktivt — også før JavaScript har kørt.
      aria-label="Skift mellem lyst og mørkt tema"
      className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
