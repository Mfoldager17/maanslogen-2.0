import { notFound } from "next/navigation";
import type { AttributeDefinition } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { serverApiOrNull } from "@/lib/api/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AttributeBuilder } from "@/components/admin/attribute-builder";
import { DeleteAttributeAction } from "@/components/admin/delete-attribute-action";

export default async function EditAttributePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [definition, categories, types] = await Promise.all([
    serverApiOrNull<AttributeDefinition>(`/attributes/${id}`),
    api.categories.list({ limit: 50, sort: "sortOrder" }),
    api.types.list({ limit: 200, sort: "sortOrder" }),
  ]);
  if (!definition) notFound();

  return (
    <>
      <AdminPageHeader
        title={definition.displayName}
        description={`Nøglen "${definition.key}" er låst — den binder alle gemte værdier.`}
        breadcrumb={[
          { href: "/admin", label: "Overblik" },
          { href: "/admin/attributter", label: "Attributter" },
        ]}
        actions={<DeleteAttributeAction id={definition.id} label={definition.displayName} />}
      />
      <AttributeBuilder definition={definition} categories={categories.items} types={types.items} />
    </>
  );
}
