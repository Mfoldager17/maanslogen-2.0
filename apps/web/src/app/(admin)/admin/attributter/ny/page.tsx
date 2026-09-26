import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AttributeBuilder } from "@/components/admin/attribute-builder";

export default async function NewAttributePage() {
  const [categories, types] = await Promise.all([
    alleSider(api.categories.list, { sort: "sortOrder" }),
    alleSider(api.types.list, { sort: "sortOrder" }),
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
      <AttributeBuilder definition={null} categories={categories} types={types} />
    </>
  );
}
