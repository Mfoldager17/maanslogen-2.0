import Link from "next/link";
import type { Route } from "next";
import type { Category, BeverageSummary, Paginated } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { Button } from "@/components/ui/button";
import { BeverageCard } from "@/components/catalog/beverage-card";
import { BubbleField } from "@/components/motion/bubble-field";
import { formatCount } from "@/lib/format";

// Forsiden er den samme for alle og ændrer sig sjældent — den genopbygges
// i baggrunden hvert kvarter i stedet for ved hver besøgende.
export const revalidate = 900;

export default async function HomePage() {
  const [categories, topRated, newest] = await Promise.all([
    api.categories.list({ limit: 6, sort: "sortOrder", active: true }),
    api.beverages.list({ limit: 4, sort: "rating", order: "desc", withTotal: true }),
    api.beverages.list({ limit: 4, sort: "createdAt", order: "desc" }),
  ]);

  return (
    <>
      <Hero beverageCount={topRated.pageInfo.total ?? 0} />
      <Categories categories={categories.items} />
      <BeverageRow title="Højest bedømt" href="/katalog?sort=rating&order=desc" page={topRated} />
      <BeverageRow
        title="Senest tilføjet"
        href="/katalog?sort=createdAt&order=desc"
        page={newest}
      />
    </>
  );
}

function Hero({ beverageCount }: { beverageCount: number }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <BubbleField />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="flex flex-col gap-5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Din smagsbog
          </span>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Smag den. Noter den.
            <br />
            Husk hvorfor.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">
            Anmeld øl, vin og spiritus med de spørgsmål der faktisk giver mening for hver kategori —
            ikke den samme generiske formular til det hele.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg">
              <Link href="/katalog">Udforsk kataloget</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/kategorier">Se kategorier</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center">
          <dl className="grid w-full grid-cols-3 gap-4 rounded-[var(--radius-card)] border border-line bg-surface/70 p-6 backdrop-blur-sm">
            <Stat label="drikkevarer" value={formatCount(beverageCount)} />
            <Stat label="kategorier" value="6" />
            <Stat label="typer" value="18" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-2xl font-semibold sm:text-3xl">{value}</dd>
      <p className="text-xs text-ink-muted sm:text-sm">{label}</p>
    </div>
  );
}

function Categories({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <SectionHeading title="Kategorier" href="/kategorier" linkLabel="Se alle" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/katalog?categorySlug=${category.slug}`}
              className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-4 transition-colors hover:border-accent-line hover:bg-accent-soft/40"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {category.icon ?? "🥂"}
              </span>
              <span className="font-semibold">{category.name}</span>
              {category.beverageCount !== undefined ? (
                <span className="text-xs text-ink-muted">{category.beverageCount} drikke</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BeverageRow({
  title,
  href,
  page,
}: {
  title: string;
  href: Route;
  page: Paginated<BeverageSummary>;
}) {
  if (page.items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <SectionHeading title={title} href={href} linkLabel="Se alle" />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {page.items.map((beverage, index) => (
          <li key={beverage.id}>
            <BeverageCard beverage={beverage} priority={index < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: Route;
  linkLabel: string;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-4">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-accent hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}
