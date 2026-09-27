import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel } from "@/components/ui/panel";
import { Counter } from "@/components/ui/counter";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelative } from "@/lib/format";

/**
 * Overblikket er admins forside. Tællingerne er grupperet som sidebaren —
 * katalog, definitioner, drift — så de to fremstillinger af det samme er
 * ordnet ens, og hver tælling er en genvej til sin egen side.
 *
 * De to spalter nederst er ikke pynt: før stod der syv flade kasser, fem
 * anmeldelser og derefter ~450px tomhed. "Senest tilføjet" svarer på det man
 * faktisk kommer for — hvad er der sket i kataloget siden sidst.
 */
export default async function AdminDashboard() {
  const [beverages, categories, types, brands, attributes, questions, reviews, users, seneste] =
    await Promise.all([
      api.beverages.list({ limit: 1, withTotal: true, active: undefined }),
      api.categories.list({ limit: 1, withTotal: true }),
      api.types.list({ limit: 1, withTotal: true }),
      api.brands.list({ limit: 1, withTotal: true }),
      api.attributes.list({ limit: 1, withTotal: true }),
      api.questions.list({ limit: 1, withTotal: true }),
      api.reviews.list({ limit: 5, sort: "createdAt", order: "desc", withTotal: true }),
      api.users.list({ limit: 1, withTotal: true }),
      api.beverages.list({
        limit: 5,
        sort: "createdAt",
        order: "desc",
        // Også de skjulte: en nyoprettet drikkevare der endnu ikke er sat
        // aktiv, er netop dén man vil se her.
        includeInactive: true,
      }),
    ]);

  const grupper: {
    titel: string;
    tone: "accent" | "signal" | "alt";
    tal: { label: string; value: number | null; href: Route }[];
  }[] = [
    {
      titel: "Katalog",
      tone: "accent",
      tal: [
        { label: "Drikkevarer", value: beverages.pageInfo.total, href: "/admin/drikkevarer" },
        { label: "Kategorier", value: categories.pageInfo.total, href: "/admin/kategorier" },
        { label: "Typer", value: types.pageInfo.total, href: "/admin/typer" },
        { label: "Mærker", value: brands.pageInfo.total, href: "/admin/maerker" },
      ],
    },
    {
      titel: "Definitioner",
      tone: "alt",
      tal: [
        { label: "Attributter", value: attributes.pageInfo.total, href: "/admin/attributter" },
        { label: "Spørgsmål", value: questions.pageInfo.total, href: "/admin/spoergsmaal" },
      ],
    },
    {
      titel: "Drift",
      tone: "signal",
      tal: [
        { label: "Anmeldelser", value: reviews.pageInfo.total, href: "/admin/anmeldelser" },
        { label: "Brugere", value: users.pageInfo.total, href: "/admin/brugere" },
      ],
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Overblik"
        description="Katalogets størrelse, og hvad der er sket siden sidst."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
        {grupper.map((gruppe) => (
          <Panel key={gruppe.titel} title={gruppe.titel} tone={gruppe.tone} bodyClassName="p-0">
            {/*
             * To rækker i alle paneler. Med fast to spalter fik Definitioner
             * og Drift kun én række hver og stod med en tom underhalvdel,
             * fordi gitteret strækker panelerne til samme højde.
             */}
            <ul className={gruppe.tal.length > 2 ? "grid grid-cols-2" : "grid grid-cols-1"}>
              {gruppe.tal.map((tal, indeks) => (
                <li key={tal.label} className={cellekant(indeks, gruppe.tal.length > 2 ? 2 : 1)}>
                  <Link
                    href={tal.href}
                    className="flex h-full flex-col gap-0.5 px-4 py-3.5 transition-colors hover:bg-sunken"
                  >
                    <Counter
                      value={tal.value}
                      className="tabular font-display text-2xl font-semibold"
                    />
                    <span className="truncate text-xs text-ink-muted">{tal.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Seneste anmeldelser"
          meta={<SeAlle href="/admin/anmeldelser" />}
          bodyClassName={reviews.items.length ? "p-0" : undefined}
        >
          {/* Uden tom-tilstand stod overskriften over et tomt hul. */}
          {reviews.items.length === 0 ? (
            <EmptyState
              title="Ingen anmeldelser endnu"
              description="De nyeste dukker op her, så snart nogen har anmeldt."
            />
          ) : (
            <ul className="divide-y divide-line">
              {reviews.items.map((review) => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                >
                  <StarRating value={review.rating} size="sm" showValue={false} />
                  <span className="min-w-0 truncate font-medium">
                    {review.beverageName ?? "Ukendt drikkevare"}
                  </span>
                  <span className="min-w-0 truncate text-ink-muted">
                    af {review.author.displayName}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-ink-muted">
                    {formatRelative(review.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Senest tilføjet"
          tone="accent"
          meta={<SeAlle href="/admin/drikkevarer" />}
          bodyClassName={seneste.items.length ? "p-0" : undefined}
        >
          {seneste.items.length === 0 ? (
            <EmptyState
              title="Kataloget er tomt"
              description="Opret den første drikkevare for at komme i gang."
            />
          ) : (
            <ul className="divide-y divide-line">
              {seneste.items.map((beverage) => (
                <li key={beverage.id} className="text-sm">
                  <Link
                    href={`/drikkevarer/${beverage.slug}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-sunken"
                  >
                    <span className="min-w-0 truncate font-medium">{beverage.name}</span>
                    <span className="min-w-0 truncate text-xs text-ink-muted">
                      {beverage.brandName} · {beverage.typeName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

/**
 * Skillelinjer kun mellem cellerne, aldrig ud mod panelets egen kant — ellers
 * står der en dobbeltstreg hele vejen rundt.
 */
function cellekant(indeks: number, kolonner: number): string {
  const venstre = indeks % kolonner !== 0 ? "border-l border-line" : "";
  const over = indeks >= kolonner ? "border-t border-line" : "";
  return ["min-w-0", venstre, over].filter(Boolean).join(" ");
}

function SeAlle({ href }: { href: Route }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-accent hover:underline"
    >
      Se alle
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}
