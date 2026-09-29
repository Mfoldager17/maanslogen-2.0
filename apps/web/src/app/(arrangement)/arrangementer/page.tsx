import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/api.server";
import { getCurrentUser } from "@/lib/session";
import { paaArrangementsVaert } from "@/lib/arrangement-vaert.server";
import { GatheringBar } from "@/components/gathering/gathering-bar";
import { GatheringCard } from "@/components/gathering/gathering-card";
import { EmptyState } from "@/components/ui/empty-state";
import { first, type SearchParams } from "@/lib/query-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Arrangementer",
  description: "Smagninger, festivaler og alt det andet logen har været til.",
};

/**
 * Arrangementer er ikke offentlige. API'et viser kun dem man er inviteret til
 * — og svarer 404 på resten — men uden en bruger er der intet at vise
 * overhovedet, så vi sender videre til login frem for at vise en tom side.
 */
export default async function ArrangementerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/log-ind?retur=%2Farrangementer");

  const params = await searchParams;
  const page = await api.gatherings.list({
    limit: 20,
    sort: "heldAt",
    order: "desc",
    cursor: first(params, "cursor"),
  });

  // På arrangementsværten er listen forsiden, og der er ikke noget ovenover.
  // På hovedværten er den en del af sitet, og vejen ud går dertil.
  const egenVaert = await paaArrangementsVaert();

  return (
    <>
      <GatheringBar titel="Arrangementer" tilbage={egenVaert ? undefined : "site"} />

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <p className="mb-5 text-sm text-ink-muted">
          Smagninger, festivaler og alt det andet. Du ser dem du er inviteret til.
        </p>

        {page.items.length === 0 ? (
          <EmptyState
            title="Ingen arrangementer endnu"
            description="Du bliver inviteret af en administrator. Så snart der er noget, står det her."
          />
        ) : (
          <div className="grid gap-4">
            {page.items.map((gathering) => (
              <GatheringCard key={gathering.id} gathering={gathering} />
            ))}
          </div>
        )}

        {page.pageInfo.nextCursor ? (
          <div className="flex justify-center pt-8">
            <Button asChild variant="secondary" size="lg">
              <Link href={`/arrangementer?cursor=${encodeURIComponent(page.pageInfo.nextCursor)}`}>
                Vis flere
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
