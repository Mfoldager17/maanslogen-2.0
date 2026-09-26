import type { Metadata } from "next";
import { api } from "@/lib/api/api.server";
import { ReviewList } from "@/components/catalog/review-list";
import { first, type SearchParams } from "@/lib/query-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Anmeldelser",
  description: "De seneste anmeldelser på tværs af hele kataloget.",
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = await api.reviews.list({
    limit: 20,
    sort: "createdAt",
    order: "desc",
    cursor: first(params, "cursor"),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Seneste anmeldelser</h1>
      <p className="mb-8 mt-1 text-sm text-ink-muted">Fra hele kataloget, nyeste først.</p>

      <ReviewList reviews={page.items} />

      {page.pageInfo.nextCursor ? (
        <div className="flex justify-center pt-8">
          {/* Samme knap som i kataloget — den var før håndskrevet med mindre skrift. */}
          <Button asChild variant="secondary" size="lg">
            <Link href={`/anmeldelser?cursor=${encodeURIComponent(page.pageInfo.nextCursor)}`}>
              Vis flere
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
