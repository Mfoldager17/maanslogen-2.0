import type { Metadata } from "next";
import type { AttributeDefinition } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { BeverageList } from "@/components/catalog/beverage-list";
import { FilterSidebar } from "@/components/catalog/filter-sidebar";
import { ActiveFilters } from "@/components/catalog/active-filters";
import { SortSelect } from "@/components/catalog/sort-select";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
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
    typeSlugs: first(params, "typeSlugs"),
    brandIds: first(params, "brandIds"),
    brandSlugs: first(params, "brandSlugs"),
    countryCodes: first(params, "countryCodes"),
    minRating: first(params, "minRating"),
    sort: first(params, "sort") ?? "rating",
    order: first(params, "order") ?? "desc",
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
  // Facetterne kender allerede navnet bag hver slug; chippen skal ikke
  // hente det en gang til.
  const typeLabels = Object.fromEntries(
    facets.types.map((bucket) => [bucket.value, bucket.label]),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/*
       * Sidehovedet er en aflæsning af den forespørgsel man står i: hvad der
       * ses på, hvor mange der er, og hvordan der sorteres.
       */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono text-accent">Katalog</p>
          <h1 className="mt-1.5 break-words font-display text-3xl font-bold tracking-tight">
            {categoryLabel ?? "Katalog"}
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {page.pageInfo.total === null ? (
              "drikkevarer"
            ) : (
              <>
                <span className="tabular text-ink-soft">{formatCount(page.pageInfo.total)}</span>{" "}
                {page.pageInfo.total === 1 ? "drikkevare" : "drikkevarer"}
              </>
            )}
          </p>
        </div>
        <SortSelect />
      </div>

      <div className="mb-6">
        <ActiveFilters
          filterable={filterable}
          categoryLabel={categoryLabel}
          typeLabels={typeLabels}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <Panel
          title="Filtre"
          tone="signal"
          marks={false}
          className="self-start"
          bodyClassName="px-4 py-4"
        >
          <FilterSidebar facets={facets} filterable={filterable} />
        </Panel>

        <div>
          {page.items.length === 0 ? (
            <EmptyState
              title="Ingen drikkevarer matcher"
              description="Prøv at fjerne et filter eller søge bredere."
            />
          ) : (
            <BeverageList
              // Et nyt filter er en ny liste, ikke flere af den gamle.
              // Nøglen remounter komponenten, så de ophobede sider ryger
              // med, i stedet for at side to af whisky hænger ved under gin.
              key={JSON.stringify(query)}
              initialItems={page.items}
              initialCursor={page.pageInfo.nextCursor}
              query={query}
            />
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
