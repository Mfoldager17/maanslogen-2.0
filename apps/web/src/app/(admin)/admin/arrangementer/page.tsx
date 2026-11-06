import Link from "next/link";
import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { GatheringCreate } from "@/components/admin/gathering-create";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { ARRANGEMENT_ETIKETTER, STATUS_ETIKETTER, STATUS_TONER } from "@/lib/arrangementer";
import { formatDate } from "@/lib/format";

export default async function AdminGatheringsPage() {
  // Admin ser alle arrangementer — det afgør API'et, ikke denne side.
  const page = await api.gatherings.list({ limit: 100, sort: "heldAt", order: "desc" });

  return (
    <>
      <AdminPageHeader
        title="Arrangementer"
        description="Smagninger, festivaler og alt det andet. Kun admin opretter dem; deltagerne inviteres."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />

      <div className="grid gap-6">
        <GatheringCreate />

        <Panel title="Alle arrangementer">
          {page.items.length === 0 ? (
            <EmptyState title="Ingen arrangementer endnu" description="Opret det første ovenfor." />
          ) : (
            <ul className="grid gap-2">
              {page.items.map((gathering) => (
                <li key={gathering.id}>
                  <Link
                    href={`/admin/arrangementer/${gathering.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2.5 transition-colors hover:bg-canvas"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {gathering.title}
                    </span>
                    <Badge tone="neutral">{ARRANGEMENT_ETIKETTER[gathering.kind]}</Badge>
                    <Badge tone={STATUS_TONER[gathering.status]}>
                      {STATUS_ETIKETTER[gathering.status]}
                    </Badge>
                    {gathering.publishedAt ? <Badge tone="accent">Udgivet</Badge> : null}
                    <span className="text-xs text-ink-muted">
                      {gathering.heldAt ? formatDate(gathering.heldAt) : "uden dato"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
