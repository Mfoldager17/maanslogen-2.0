"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/api.browser";
import { Keycap } from "@/components/ui/keycap";
import { dynamicRoute } from "@/lib/routes";
import { formatRating } from "@/lib/format";
import { cn } from "@/lib/cn";

const SIDER = [
  { label: "Katalog", sti: "/katalog", note: "alle drikkevarer" },
  { label: "Kategorier", sti: "/kategorier", note: "øl, vin, spiritus" },
  { label: "Mærker", sti: "/maerker", note: "bryggerier og huse" },
  { label: "Anmeldelser", sti: "/anmeldelser", note: "nyeste først" },
  { label: "Profil", sti: "/profil", note: "dine anmeldelser" },
] as const;

/**
 * ⌘K. Ét sted til både at søge og at springe rundt — den måde man betjener
 * et værktøj på, frem for at lede efter et menupunkt.
 *
 * Søgningen kører først når man har skrevet to tegn, og resultatet bliver
 * stående mens det næste hentes, så listen ikke blinker ved hvert tastetryk.
 */
export function CommandPalette() {
  const router = useRouter();
  const [åben, setÅben] = useState(false);
  const [tekst, setTekst] = useState("");
  const [valgt, setValgt] = useState(0);
  const listeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function tast(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setÅben((forrige) => !forrige);
        return;
      }
      // "/" åbner også, men ikke mens man skriver i et almindeligt felt.
      const mål = event.target as HTMLElement | null;
      const skriver =
        mål?.tagName === "INPUT" || mål?.tagName === "TEXTAREA" || mål?.isContentEditable;
      if (event.key === "/" && !skriver) {
        event.preventDefault();
        setÅben(true);
      }
    }
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, []);

  const søgning = tekst.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["palet", søgning],
    queryFn: () => api.beverages.list({ q: søgning, limit: 6, sort: "rating", order: "desc" }),
    enabled: åben && søgning.length >= 2,
    placeholderData: (forrige) => forrige,
  });

  const sider = useMemo(
    () =>
      SIDER.filter((side) => !søgning || side.label.toLowerCase().includes(søgning.toLowerCase())),
    [søgning],
  );

  const rækker = useMemo(
    () => [
      // Søgefeltet i hovedet førte før til /katalog?q=. Den vej skal stadig være der.
      ...(søgning.length >= 2
        ? [
            {
              slags: "søg" as const,
              nøgle: "søg",
              sti: `/katalog?q=${encodeURIComponent(søgning)}`,
              primær: `Søg efter «${søgning}» i kataloget`,
              sekundær: "Alle træffere, med filtre",
              værdi: "",
            },
          ]
        : []),
      ...(data?.items ?? []).map((drik) => ({
        slags: "drik" as const,
        nøgle: drik.id,
        sti: `/drikkevarer/${drik.slug}`,
        primær: drik.name,
        sekundær: `${drik.brandName} · ${drik.typeName}`,
        værdi: drik.rating.count > 0 ? formatRating(drik.rating.average) : "—",
      })),
      ...sider.map((side) => ({
        slags: "side" as const,
        nøgle: side.sti,
        sti: side.sti,
        primær: side.label,
        sekundær: side.note,
        værdi: "",
      })),
    ],
    [data, sider, søgning],
  );

  /*
   * Markeringen hører til den liste den peger i. Når listen skifter, nulstilles
   * den under gennemtegningen — ikke i en effekt, som ville give en ekstra
   * runde hvor markeringen stod på en række der ikke findes længere.
   */
  const listeNøgle = `${søgning}|${data?.items.length ?? 0}`;
  const [sidsteNøgle, setSidsteNøgle] = useState(listeNøgle);
  if (listeNøgle !== sidsteNøgle) {
    setSidsteNøgle(listeNøgle);
    setValgt(0);
  }

  const gå = useCallback(
    (sti: string) => {
      setÅben(false);
      setTekst("");
      router.push(dynamicRoute(sti));
    },
    [router],
  );

  function tastIFelt(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setValgt((i) => (rækker.length === 0 ? 0 : (i + 1) % rækker.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setValgt((i) => (rækker.length === 0 ? 0 : (i - 1 + rækker.length) % rækker.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const række = rækker[valgt];
      if (række) gå(række.sti);
    }
  }

  // Den valgte række skal blive i syne når man holder pilen nede.
  useEffect(() => {
    listeRef.current?.querySelector('[data-valgt="true"]')?.scrollIntoView({ block: "nearest" });
  }, [valgt]);

  return (
    <>
      {/*
       * To former, ikke én skrumpet.
       *
       * På telefon stod ordet «Søg» og ⌘K-tasten skjult, og tilbage var en
       * 44px kasse med et `›` og et `⌕` — U+2315, som de fleste skrifter
       * sætter tyndt og lille. Den lignede ikke en søgning, og man kunne se
       * lige forbi den. Her er det i stedet et almindeligt forstørrelsesglas i
       * samme mål som temaknappen ved siden af.
       *
       * Fra `sm` er der plads til striben der ligner en prompt, og den bliver:
       * ⌘K er husets måde at betjene værktøjet på, og tastaturet findes dér.
       */}
      <button
        type="button"
        onClick={() => setÅben(true)}
        aria-label="Søg og spring til"
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)]",
          "text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
          "sm:w-auto sm:justify-start sm:gap-2 sm:border sm:border-line-strong sm:bg-sunken",
          "sm:px-2.5 sm:font-mono sm:text-xs sm:hover:border-accent-line",
        )}
      >
        <Search className="h-5 w-5 sm:hidden" aria-hidden="true" />
        <span className="hidden text-accent sm:inline" aria-hidden="true">
          ›
        </span>
        <span className="hidden sm:inline">Søg</span>
        <Keycap className="ml-1 hidden sm:inline-flex">⌘K</Keycap>
      </button>

      <Dialog.Root open={åben} onOpenChange={setÅben}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm" />
          <Dialog.Content
            aria-label="Søg og spring til"
            className="fixed left-1/2 top-[12vh] z-50 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface shadow-[var(--shadow-pop)]"
          >
            <Dialog.Title className="sr-only">Søg og spring til</Dialog.Title>

            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <span className="font-mono text-accent" aria-hidden="true">
                ›
              </span>
              <input
                autoFocus
                value={tekst}
                onChange={(event) => setTekst(event.target.value)}
                onKeyDown={tastIFelt}
                placeholder="Søg i kataloget, eller spring til en side …"
                aria-label="Søg"
                className="h-12 w-full min-w-0 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {isFetching ? <span className="label-mono shrink-0 text-accent">Henter</span> : null}
            </div>

            <div ref={listeRef} className="max-h-[50vh] overflow-y-auto py-1.5">
              {rækker.length === 0 ? (
                <p className="px-4 py-6 text-center font-mono text-xs text-ink-muted">
                  {søgning.length < 2 ? "Skriv mindst to tegn" : "Intet match"}
                </p>
              ) : (
                rækker.map((række, index) => (
                  <button
                    key={`${række.slags}-${række.nøgle}`}
                    type="button"
                    data-valgt={index === valgt}
                    onMouseMove={() => setValgt(index)}
                    onClick={() => gå(række.sti)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      index === valgt ? "bg-accent-soft" : "hover:bg-sunken",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs",
                        række.slags === "drik"
                          ? "text-accent"
                          : række.slags === "søg"
                            ? "text-alt"
                            : "text-signal",
                      )}
                      aria-hidden="true"
                    >
                      {række.slags === "drik" ? "●" : række.slags === "søg" ? "⌕" : "→"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-ink">
                        {række.primær}
                      </span>
                      <span className="block truncate font-mono text-[0.6875rem] text-ink-muted">
                        {række.sekundær}
                      </span>
                    </span>
                    {række.værdi ? (
                      <span className="tabular shrink-0 font-mono text-xs text-ink-soft">
                        {række.værdi}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 font-mono text-[0.6875rem] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Keycap>↑</Keycap>
                <Keycap>↓</Keycap> vælg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Keycap>⏎</Keycap> åbn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Keycap>esc</Keycap> luk
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
