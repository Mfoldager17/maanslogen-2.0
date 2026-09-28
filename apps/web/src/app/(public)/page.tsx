import Link from "next/link";
import type { Route } from "next";
import type { Category, BeverageSummary, Paginated } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { BeverageCard } from "@/components/catalog/beverage-card";
import { formatCount } from "@/lib/format";
import { Hero } from "@/components/home/hero";

// Forsiden er den samme for alle og ændrer sig sjældent — den genopbygges
// i baggrunden hvert kvarter i stedet for ved hver besøgende.
export const revalidate = 900;

export default async function HomePage() {
  // Tallene i heroen skal være de rigtige. To af dem stod hardkodet som "6"
  // og "18", så forsiden kunne modsige kategorisiden på samme skærm.
  const [categories, topRated, newest, alleKategorier, alleTyper] = await Promise.all([
    api.categories.list({ limit: 6, sort: "sortOrder", active: true }),
    api.beverages.list({ limit: 4, sort: "rating", order: "desc", withTotal: true }),
    api.beverages.list({ limit: 4, sort: "createdAt", order: "desc" }),
    api.categories.list({ limit: 1, active: true, withTotal: true }),
    api.types.list({ limit: 1, active: true, withTotal: true }),
  ]);

  return (
    <>
      <Hero
        beverageCount={topRated.pageInfo.total}
        categoryCount={alleKategorier.pageInfo.total}
        typeCount={alleTyper.pageInfo.total}
      />
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
              className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 transition-colors hover:border-accent-line hover:bg-accent-soft/40"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {category.icon ?? "🥂"}
              </span>
              <span className="font-semibold">{category.name}</span>
              {category.beverageCount !== undefined ? (
                <span className="text-xs text-ink-muted">
                  {formatCount(category.beverageCount)}{" "}
                  {category.beverageCount === 1 ? "drikkevare" : "drikkevarer"}
                </span>
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
