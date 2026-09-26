import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TypePanel } from "@/components/admin/type-panel";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminTypesPage() {
  // Begge lister skal være komplette: panelet grupperer typer under deres
  // kategori, så en afkortet liste ville tabe rækker uden at sige det.
  const [types, categories] = await Promise.all([
    alleSider(api.types.list, { sort: "sortOrder" }),
    alleSider(api.categories.list, { sort: "sortOrder" }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Typer"
        description="Niveauet under kategorierne. Attributter og spørgsmål kan målrettes helt herned."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      {categories.length === 0 ? (
        <EmptyState
          title="Opret en kategori først"
          description="En type skal høre til en kategori."
        />
      ) : (
        <TypePanel types={types} categories={categories} />
      )}
    </>
  );
}
