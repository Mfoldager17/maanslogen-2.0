import Link from "next/link";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { MediaImage } from "@/components/catalog/media-image";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPager } from "@/components/admin/admin-pager";
import { first, type SearchParams } from "@/lib/query-state";
import type { BeverageSummary } from "@maanslogen/contracts";

export default async function AdminBeveragesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = await api.beverages.list({
    q: first(params, "q"),
    categorySlug: first(params, "categorySlug"),
    cursor: first(params, "cursor"),
    // I admin skal også skjulte drikkevarer med — det er netop dem man leder efter.
    includeInactive: true,
    limit: 25,
    withTotal: true,
    sort: "createdAt",
    order: "desc",
  });

  const columns: Column<BeverageSummary>[] = [
    {
      key: "name",
      header: "Drikkevare",
      render: (row) => (
        <div className="flex items-center gap-3">
          <MediaImage
            media={row.media}
            alt={row.name}
            variant="THUMB"
            categoryName={row.categoryName}
            className="h-9 w-9 shrink-0 rounded-lg"
            sizes="36px"
          />
          <div className="min-w-0">
            <Link
              href={`/drikkevarer/${row.slug}`}
              className="block truncate font-semibold hover:text-accent"
              title={row.name}
            >
              {row.name}
            </Link>
            <span className="block truncate text-xs text-ink-muted" title={`/${row.slug}`}>
              /{row.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "brand",
      header: "Mærke",
      width: "w-40",
      render: (row) => (
        <span className="block truncate" title={row.brandName}>
          {row.brandName}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "w-40",
      render: (row) => (
        <span
          className="block truncate text-ink-soft"
          title={`${row.categoryName} › ${row.typeName}`}
        >
          {row.categoryName} › {row.typeName}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Bedømmelse",
      // w-36 var 10px for smal til stjerner + snit + et firecifret antal.
      width: "w-44",
      render: (row) =>
        row.rating.count === 0 ? (
          <span className="text-xs text-ink-muted">—</span>
        ) : (
          <StarRating value={row.rating.average} size="sm" count={row.rating.count} showValue />
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-24",
      render: (row) =>
        row.active ? <Badge tone="positive">Aktiv</Badge> : <Badge tone="warning">Skjult</Badge>,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Drikkevarer"
        description={
          page.pageInfo.total === null ? undefined : `${page.pageInfo.total} i kataloget`
        }
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
        actions={
          <Button asChild>
            <Link href="/admin/drikkevarer/ny">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ny drikkevare
            </Link>
          </Button>
        }
      />

      <div className="mb-4">
        <AdminSearch basePath="/admin/drikkevarer" placeholder="Søg navn eller mærke" />
      </div>

      <DataTable
        caption="Drikkevarer i kataloget"
        columns={columns}
        rows={page.items}
        empty={
          <EmptyState
            title="Ingen drikkevarer"
            description="Opret den første, eller justér søgningen."
          />
        }
      />

      <AdminPager basePath="/admin/drikkevarer" cursor={page.pageInfo.nextCursor} />
    </>
  );
}
