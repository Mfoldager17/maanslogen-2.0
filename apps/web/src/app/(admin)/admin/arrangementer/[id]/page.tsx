import Link from "next/link";
import { notFound } from "next/navigation";
import type { User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { ApiError } from "@/lib/api/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { GatheringManager } from "@/components/gathering/gathering-manager";
import { Button } from "@/components/ui/button";
import { ARRANGEMENT_ETIKETTER } from "@/lib/arrangementer";

export default async function AdminGatheringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const detail = await api.gatherings.get(id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!detail) notFound();

  // Hele listen, ikke første side: en afkortet liste ville betyde at den man
  // ledte efter manglede i dropdownen uden at nogen opdagede hvorfor.
  const brugere = await alleSider<User>((query) => api.users.list(query), { sort: "displayName" });

  return (
    <>
      <AdminPageHeader
        title={detail.title}
        description={`${ARRANGEMENT_ETIKETTER[detail.kind]} · ${detail.attendeeCount} deltagere · ${detail.itemCount} ting`}
        breadcrumb={[
          { href: "/admin", label: "Overblik" },
          { href: "/admin/arrangementer", label: "Arrangementer" },
        ]}
        actions={
          <Button asChild variant="secondary" size="md">
            <Link href={`/arrangementer/${detail.slug}`}>Se som deltager</Link>
          </Button>
        }
      />

      <GatheringManager detail={detail} kandidater={brugere} efterSletning="/admin/arrangementer" />
    </>
  );
}
