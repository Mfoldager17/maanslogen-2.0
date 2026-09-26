import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api/api.server";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Kategorier",
  description: "Øl, vin, whisky, gin, rom og cider — hver med sine egne attributter og spørgsmål.",
};

export const revalidate = 900;

export default async function CategoriesPage() {
  const [categories, types] = await Promise.all([
    api.categories.list({ limit: 50, sort: "sortOrder", active: true }),
    api.types.list({ limit: 100, sort: "sortOrder", active: true }),
  ]);

  if (categories.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Ingen kategorier endnu" description="De oprettes i admin." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Kategorier</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Hver kategori har sine egne attributter og anmeldelsesspørgsmål. En stout bliver spurgt om
        bitterhed; en riesling bliver ikke.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {categories.items.map((category) => {
          const categoryTypes = types.items.filter((type) => type.categoryId === category.id);

          return (
            <li key={category.id}>
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {category.icon ?? "🥂"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-semibold">
                      <Link
                        href={`/katalog?categorySlug=${category.slug}`}
                        className="hover:text-accent"
                      >
                        {category.name}
                      </Link>
                    </h2>
                    {category.description ? (
                      <p className="mt-0.5 text-sm text-ink-muted">{category.description}</p>
                    ) : null}
                  </div>
                </div>

                {categoryTypes.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {categoryTypes.map((type) => (
                      <li key={type.id}>
                        <Link
                          href={`/katalog?categorySlug=${category.slug}&typeIds=${type.id}`}
                          className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-sm text-ink-soft transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent-hover"
                        >
                          {type.name}
                          {type.beverageCount !== undefined ? (
                            <span className="ml-1.5 text-xs text-ink-muted">
                              {type.beverageCount}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
