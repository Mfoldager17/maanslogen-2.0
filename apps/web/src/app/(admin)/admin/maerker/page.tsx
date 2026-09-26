import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BrandPanel } from "@/components/admin/brand-panel";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPager } from "@/components/admin/admin-pager";
import { first, type SearchParams } from "@/lib/query-state";

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [brands, categories] = await Promise.all([
    api.brands.list({
      limit: 50,
      sort: "name",
      q: first(params, "q"),
      cursor: first(params, "cursor"),
    }),
    api.categories.list({ limit: 100, sort: "sortOrder" }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Mærker"
        description="Bryggerier, vinhuse og destillerier. Kategorierne begrænser hvor de kan bruges."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      <div className="mb-4">
        <AdminSearch basePath="/admin/maerker" placeholder="Søg mærke" />
      </div>
      <BrandPanel brands={brands.items} categories={categories.items} />
      <AdminPager basePath="/admin/maerker" cursor={brands.pageInfo.nextCursor} />
    </>
  );
}
