import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoryPanel } from "@/components/admin/category-panel";

export default async function AdminCategoriesPage() {
  const categories = await api.categories.list({ limit: 100, sort: "sortOrder" });

  return (
    <>
      <AdminPageHeader
        title="Kategorier"
        description="Det øverste niveau. En kategori kan ikke arkiveres, så længe den har aktive typer."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      <CategoryPanel categories={categories.items} />
    </>
  );
}
