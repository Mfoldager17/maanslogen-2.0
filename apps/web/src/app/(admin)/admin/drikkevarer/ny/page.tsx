import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BeverageForm } from "@/components/admin/beverage-form";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NewBeveragePage() {
  // Dropdowns skal vise alt — ellers kan man ikke vælge det man leder efter.
  const [categories, types, brands] = await Promise.all([
    alleSider(api.categories.list, { sort: "sortOrder", active: true }),
    alleSider(api.types.list, { sort: "sortOrder", active: true }),
    alleSider(api.brands.list, { sort: "name", active: true }),
  ]);

  const ready = categories.length > 0 && types.length > 0 && brands.length > 0;

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
        <BeverageForm beverage={null} categories={categories} types={types} brands={brands} />
      ) : (
        <EmptyState
          title="Kataloget mangler grunddata"
          description="Opret mindst én kategori, én type og ét mærke først."
        />
      )}
    </>
  );
}
