import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Alt det sidehovedet ellers ville fylde, skåret ned til én række: vej tilbage,
 * hvor man er, og for en admin vej ind til styringen.
 *
 * Titlen er sidens `h1`. Den står kun her — gentaget nedenunder ville den koste
 * en `text-3xl` linje af den højde der skal bruges til drikkevarerne.
 *
 * `gatheringId` frem for en færdig href: `typedRoutes` kræver at adressen kan
 * genkendes som en rute ved bygning, og en almindelig streng udefra kan den
 * ikke. Skabelonstrengen her kan.
 */
export function GatheringBar({ titel, gatheringId }: { titel: string; gatheringId?: string }) {
  return (
    // Safe-area foroven: uden den ville bjælken ligge under uret og signalet,
    // den dag fladen åbnes fra hjemmeskærmen frem for i en browser.
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-1">
        <Button
          asChild
          variant="ghost"
          size="md"
          className="w-11 shrink-0 px-0"
          aria-label="Tilbage til arrangementer"
        >
          <Link href="/arrangementer">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
        </Button>

        <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight">
          {titel}
        </h1>

        {gatheringId ? (
          <Button
            asChild
            variant="ghost"
            size="md"
            className="w-11 shrink-0 px-0"
            aria-label="Styr arrangementet"
          >
            <Link href={`/admin/arrangementer/${gatheringId}`}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
