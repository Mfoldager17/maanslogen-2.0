import { redirect } from "next/navigation";
import { roleAtLeast } from "@maanslogen/contracts";
import type { User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { getCurrentUser } from "@/lib/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/admin/data-table";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPager } from "@/components/admin/admin-pager";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { first, type SearchParams } from "@/lib/query-state";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const me = await getCurrentUser();
  // Brugeradministration er ADMIN-only; moderatorer styrer kun kataloget.
  if (!me || !roleAtLeast(me.role, "ADMIN")) redirect("/admin");

  const params = await searchParams;
  const page = await api.users.list({
    limit: 25,
    sort: "createdAt",
    order: "desc",
    withTotal: true,
    q: first(params, "q"),
    cursor: first(params, "cursor"),
  });

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Bruger",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold" title={row.displayName}>
            {row.displayName}
          </p>
          <p className="truncate text-xs text-ink-muted" title={row.email}>
            {row.email}
          </p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rolle",
      width: "w-40",
      render: (row) => (
        <UserRoleSelect userId={row.id} role={row.role} disabled={row.id === me.id} />
      ),
    },
    {
      key: "reviews",
      header: "Anmeldelser",
      // Overskriften selv er bredere end 112px.
      width: "w-32",
      render: (row) => <span className="tabular">{formatNumber(row.reviewCount ?? 0)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-24",
      render: (row) =>
        row.active ? <Badge tone="positive">Aktiv</Badge> : <Badge tone="warning">Spærret</Badge>,
    },
    {
      key: "lastLogin",
      header: "Sidst set",
      width: "w-32",
      render: (row) => (
        <span className="text-xs text-ink-muted">
          {row.lastLoginAt ? formatRelative(row.lastLoginAt) : "Aldrig"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Oprettet",
      width: "w-32",
      render: (row) => <span className="text-xs text-ink-muted">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Brugere"
        description="Du kan ikke ændre din egen rolle — det er den hurtigste vej til at låse sig selv ude."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      <div className="mb-4">
        <AdminSearch basePath="/admin/brugere" placeholder="Søg navn eller e-mail" />
      </div>
      <DataTable
        caption="Brugere"
        columns={columns}
        rows={page.items}
        empty={<EmptyState title="Ingen brugere" />}
      />
      <AdminPager basePath="/admin/brugere" cursor={page.pageInfo.nextCursor} />
    </>
  );
}
