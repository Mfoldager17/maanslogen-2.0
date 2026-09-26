import type { Metadata } from "next";
import type { AttributeDefinition } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { BeverageCard } from "@/components/catalog/beverage-card";
import { FilterSidebar } from "@/components/catalog/filter-sidebar";
import { ActiveFilters } from "@/components/catalog/active-filters";
import { LoadMore } from "@/components/catalog/load-more";
import { SortSelect } from "@/components/catalog/sort-select";
import { EmptyState } from "@/components/ui/empty-state";
import { attributeParams, first, type SearchParams } from "@/lib/query-state";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "Katalog",
  description: "Filtrér drikkevarer på kategori, type, land og egenskaber som alkohol og farve.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const query = {
    q: first(params, "q"),
    categorySlug: first(params, "categorySlug"),
    typeIds: first(params, "typeIds"),
    brandIds: first(params, "brandIds"),
    countryCodes: first(params, "countryCodes"),
    minRating: first(params, "minRating"),
    sort: first(params, "sort") ?? "rating",
    order: first(params, "order") ?? "desc",
    cursor: first(params, "cursor"),
    limit: 24,
    withTotal: true,
    attr: attributeParams(params),
  };

  // Liste og facetter hentes side om side; facetterne bruger samme filter,
  // så tællingerne altid passer til det man ser.
  const [page, facets] = await Promise.all([
    api.beverages.list(query),
    api.beverages.facets({ ...query, cursor: undefined, limit: undefined }),
  ]);

  const filterable = await filterableAttributes(query.categorySlug);
  const categoryLabel = facets.categories.find(
    (bucket) => bucket.value === query.categorySlug,
  )?.label;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {categoryLabel ?? "Katalog"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {page.pageInfo.total === null
              ? "Drikkevarer"
              : `${formatCount(page.pageInfo.total)} drikkevarer`}
          </p>
        </div>
        <SortSelect />
      </div>

      <div className="mb-6">
        <ActiveFilters filterable={filterable} categoryLabel={categoryLabel} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <FilterSidebar facets={facets} filterable={filterable} />

        <div>
          {page.items.length === 0 ? (
            <EmptyState
              title="Ingen drikkevarer matcher"
              description="Prøv at fjerne et filter eller søge bredere."
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {page.items.map((beverage, index) => (
                  <li key={beverage.id}>
                    <BeverageCard beverage={beverage} priority={index < 4} />
                  </li>
                ))}
              </ul>
              <LoadMore cursor={page.pageInfo.nextCursor} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hvilke attributter der kan filtreres på afhænger af den valgte kategori.
 * Uden en kategori viser vi kun dem der gælder overalt.
 */
async function filterableAttributes(
  categorySlug: string | undefined,
): Promise<AttributeDefinition[]> {
  if (!categorySlug) {
    const page = await api.attributes.list({ filterable: true, limit: 50 });
    return page.items.filter((definition) => definition.categoryIds.length === 0);
  }

  const category = await api.categories.get(categorySlug).catch(() => null);
  if (!category) return [];

  const page = await api.attributes.list({
    filterable: true,
    categoryId: category.id,
    limit: 50,
  });
  return page.items;
}
