import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BeverageForm } from "@/components/admin/beverage-form";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NewBeveragePage() {
  const [categories, types, brands] = await Promise.all([
    api.categories.list({ limit: 100, sort: "sortOrder", active: true }),
    api.types.list({ limit: 300, sort: "sortOrder", active: true }),
    api.brands.list({ limit: 300, sort: "name", active: true }),
  ]);

  const ready = categories.items.length > 0 && types.items.length > 0 && brands.items.length > 0;

  return (
    <>
      <AdminPageHeader
        title="Ny drikkevare"
        description="Egenskabsfelterne skifter med den valgte type."
        breadcrumb={[
          { href: "/admin", label: "Overblik" },
          { href: "/admin/drikkevarer", label: "Drikkevarer" },
        ]}
      />
      {ready ? (
        <BeverageForm
          beverage={null}
          categories={categories.items}
          types={types.items}
          brands={brands.items}
        />
      ) : (
        <EmptyState
          title="Kataloget mangler grunddata"
          description="Opret mindst én kategori, én type og ét mærke først."
        />
      )}
    </>
  );
}
