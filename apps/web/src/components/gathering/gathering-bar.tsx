import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Alt det sidehovedet ellers ville fylde, skåret ned til én række: vej tilbage,
 * hvor man er, og for den der holder arrangementet vej ind til styringen.
 *
 * Titlen er sidens `h1`. Den står kun her — gentaget nedenunder ville den koste
 * en `text-3xl` linje af den højde der skal bruges til indholdet.
 *
 * `tilbage` er et af fire faste mål frem for en fri adresse: `typedRoutes`
 * kræver at adressen kan genkendes som en rute ved bygning, og en almindelig
 * streng udefra kan den ikke. Udeladt er der ingen pil — det er tilfældet på
 * arrangementsværtens forside, hvor der ikke er noget ovenover.
 */
const TILBAGE = {
  /** Ud af arrangementerne og tilbage til sitet. Kun på hovedværten. */
  site: { href: "/", etiket: "Tilbage til Maanslogen" },
  /** Op til listen, som den ligger på hovedværten. */
  liste: { href: "/arrangementer", etiket: "Tilbage til arrangementer" },
  /** Op til listen på arrangementsværten, hvor den er forsiden. */
  listeRod: { href: "/", etiket: "Tilbage til arrangementer" },
} as const;

export function GatheringBar({
  titel,
  tilbage,
  slug,
  kanStyre = false,
}: {
  titel: string;
  /** `arrangement` er vejen op fra styringen og kræver `slug`. */
  tilbage?: keyof typeof TILBAGE | "arrangement";
  slug?: string;
  /**
   * Vis vejen ind til styringen. Kommer fra `viewer` i API'ets svar — fladen
   * gætter ikke selv på hvem der må hvad.
   */
  kanStyre?: boolean;
}) {
  const vej = tilbage === "arrangement" ? null : tilbage ? TILBAGE[tilbage] : null;
  // Vejen op fra styringen kan ikke stå i tabellen: den indeholder slug'en, og
  // skrives derfor hvor `typedRoutes` kan se at det er `/arrangementer/[slug]`.
  const tilArrangementet = tilbage === "arrangement" && slug !== undefined;

  return (
    // Safe-area foroven: uden den ville bjælken ligge under uret og signalet,
    // den dag fladen åbnes fra hjemmeskærmen frem for i en browser.
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-1">
        {tilArrangementet ? (
          <Button
            asChild
            variant="ghost"
            size="md"
            className="w-11 shrink-0 px-0"
            aria-label="Tilbage til arrangementet"
          >
            <Link href={`/arrangementer/${slug}`}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        ) : vej ? (
          <Button
            asChild
            variant="ghost"
            size="md"
            className="w-11 shrink-0 px-0"
            aria-label={vej.etiket}
          >
            <Link href={vej.href}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        ) : (
          // Uden pil skal titlen stadig starte hvor den ellers gør, så
          // bjælken ikke hopper vandret mellem liste og arrangement.
          <span className="w-3 shrink-0" aria-hidden />
        )}

        <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight">
          {titel}
        </h1>

        {/*
         * Styringen ligger i arrangementsfladen, ikke i admin. Den pegede før
         * på `/admin/arrangementer/{id}`, og dén adresse findes ikke på
         * arrangementsværten: `/admin/...` bliver skrevet om til
         * `/arrangementer/admin/...` og ender i en 404. Her bliver man.
         */}
        {kanStyre && slug !== undefined ? (
          <Button
            asChild
            variant="ghost"
            size="md"
            className="w-11 shrink-0 px-0"
            aria-label="Styr arrangementet"
          >
            <Link href={`/arrangementer/${slug}/styring`}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
