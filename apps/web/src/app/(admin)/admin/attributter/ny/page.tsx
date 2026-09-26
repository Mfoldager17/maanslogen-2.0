import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AttributeBuilder } from "@/components/admin/attribute-builder";

export default async function NewAttributePage() {
  const [categories, types] = await Promise.all([
    api.categories.list({ limit: 50, sort: "sortOrder" }),
    api.types.list({ limit: 200, sort: "sortOrder" }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Ny attribut"
        description="Nøgle og datatype kan ikke ændres bagefter — de binder alle gemte værdier."
        breadcrumb={[
          { href: "/admin", label: "Overblik" },
          { href: "/admin/attributter", label: "Attributter" },
        ]}
      />
      <AttributeBuilder definition={null} categories={categories.items} types={types.items} />
    </>
  );
}
