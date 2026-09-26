import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TypePanel } from "@/components/admin/type-panel";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminTypesPage() {
  const [types, categories] = await Promise.all([
    api.types.list({ limit: 200, sort: "sortOrder" }),
    api.categories.list({ limit: 100, sort: "sortOrder" }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Typer"
        description="Niveauet under kategorierne. Attributter og spørgsmål kan målrettes helt herned."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      {categories.items.length === 0 ? (
        <EmptyState
          title="Opret en kategori først"
          description="En type skal høre til en kategori."
        />
      ) : (
        <TypePanel types={types.items} categories={categories.items} />
      )}
    </>
  );
}
