import Link from "next/link";
import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPager } from "@/components/admin/admin-pager";
import { EmptyState } from "@/components/ui/empty-state";
import { StarRating } from "@/components/ui/star-rating";
import { DeleteReviewAction } from "@/components/admin/delete-review-action";
import { formatRelative } from "@/lib/format";
import { first, type SearchParams } from "@/lib/query-state";
import type { Review } from "@maanslogen/contracts";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = await api.reviews.list({
    limit: 25,
    sort: "createdAt",
    order: "desc",
    withTotal: true,
    q: first(params, "q"),
    cursor: first(params, "cursor"),
  });

  const columns: Column<Review>[] = [
    {
      key: "rating",
      header: "Bedømmelse",
      width: "w-32",
      render: (row) => <StarRating value={row.rating} size="sm" />,
    },
    {
      key: "beverage",
      header: "Drikkevare",
      render: (row) =>
        row.beverageSlug ? (
          <Link
            href={`/drikkevarer/${row.beverageSlug}`}
            className="font-semibold hover:text-accent"
          >
            {row.beverageName}
          </Link>
        ) : (
          <span className="text-ink-muted">Ukendt</span>
        ),
    },
    {
      key: "title",
      header: "Overskrift",
      render: (row) => <span className="line-clamp-1 text-ink-soft">{row.title ?? "—"}</span>,
    },
    { key: "author", header: "Anmelder", width: "w-40", render: (row) => row.author.displayName },
    {
      key: "answers",
      header: "Svar",
      width: "w-20",
      render: (row) => <span className="tabular text-ink-muted">{row.answers.length}</span>,
    },
    {
      key: "created",
      header: "Oprettet",
      width: "w-32",
      render: (row) => (
        <time dateTime={row.createdAt} className="text-xs text-ink-muted">
          {formatRelative(row.createdAt)}
        </time>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "w-14",
      align: "right",
      render: (row) => (
        <DeleteReviewAction
          id={row.id}
          label={`anmeldelsen af ${row.beverageName ?? "drikkevaren"}`}
        />
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Anmeldelser"
        description={page.pageInfo.total === null ? undefined : `${page.pageInfo.total} i alt`}
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      <div className="mb-4">
        <AdminSearch basePath="/admin/anmeldelser" placeholder="Søg i overskrift og tekst" />
      </div>
      <DataTable
        caption="Anmeldelser"
        columns={columns}
        rows={page.items}
        empty={<EmptyState title="Ingen anmeldelser" />}
      />
      <AdminPager basePath="/admin/anmeldelser" cursor={page.pageInfo.nextCursor} />
    </>
  );
}
