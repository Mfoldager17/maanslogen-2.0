import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Counter } from "@/components/ui/counter";
import { Keycap } from "@/components/ui/keycap";

export function Hero({
  beverageCount,
  categoryCount,
  typeCount,
}: {
  beverageCount: number | null;
  categoryCount: number | null;
  typeCount: number | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Et hårfint målegitter bag alt. Det skal anes, ikke ses. */}
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent-soft/50 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="label-mono text-accent">Din smagsbog</p>

            <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl">
              Smag den. Notér den.
              <br />
              <span className="text-accent">Husk hvorfor.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              Anmeld øl, vin og spiritus med de spørgsmål der faktisk giver mening for hver kategori
              — ikke den samme generiske formular til det hele.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/katalog">Åbn kataloget</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/kategorier">Se kategorier</Link>
              </Button>
            </div>

            {/*
             * Genvejene står der fordi de findes. Det er den slags detalje man
             * kun møder på en side hvor nogen har tænkt over hvordan den bruges.
             */}
            <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <Keycap>⌘K</Keycap> søg overalt
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Keycap>↑</Keycap>
                <Keycap>↓</Keycap> bladr i resultatet
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Keycap>⏎</Keycap> åbn
              </span>
            </p>
          </div>

          {/* Nøgletallene tæller op når siden åbner. Tal skal føles målte. */}
          <Panel
            title="Kataloget"
            tone="accent"
            meta="Opdateret hvert kvarter"
            className="self-start"
          >
            <dl className="flex flex-col divide-y divide-line">
              <Stat label="Drikkevarer" value={beverageCount} />
              <Stat label="Kategorier" value={categoryCount} />
              <Stat label="Typer" value={typeCount} />
            </dl>
          </Panel>
        </div>
      </div>
    </section>
  );
}

/** En linje i aflæsningen. Et tal vi ikke har, vises som "—" frem for som 0. */
function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="label-mono">{label}</dt>
      <dd className="font-display text-2xl font-bold leading-none text-ink">
        <Counter value={value} />
      </dd>
    </div>
  );
}
