import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/api.server";
import { getCurrentUser } from "@/lib/session";
import { paaArrangementsVaert } from "@/lib/arrangement-vaert.server";
import { GatheringBar } from "@/components/gathering/gathering-bar";
import { GatheringLive } from "@/components/gathering/gathering-live";
import { GatheringPost } from "@/components/gathering/gathering-post";
import { Badge } from "@/components/ui/badge";
import { ARRANGEMENT_ETIKETTER, STATUS_ETIKETTER, STATUS_TONER } from "@/lib/arrangementer";
import { formatDate } from "@/lib/format";

/**
 * Ét arrangement. Er opslaget udgivet, læses siden som en beretning; ellers
 * er det fladen man bruger mens det står på.
 *
 * API'et svarer 404 — ikke 403 — på et arrangement man ikke er inviteret til,
 * netop for ikke at røbe at det findes. Den skelnen skal siden ikke lave om
 * på, så et 404 herfra bliver til Next's `notFound()` uden videre.
 */
async function hentArrangement(slug: string) {
  try {
    return await api.gatherings.get(slug);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return { title: "Arrangement" };

  const detail = await hentArrangement(slug);
  if (!detail) return { title: "Arrangement" };

  return {
    title: detail.title,
    description: detail.summary ?? undefined,
    // Logens eget rum har intet at lave i et søgeindeks.
    robots: { index: false, follow: false },
  };
}

export default async function ArrangementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/log-ind?retur=${encodeURIComponent(`/arrangementer/${slug}`)}`);

  const detail = await hentArrangement(slug);
  if (!detail) notFound();

  const udgivet = detail.publishedAt !== null;
  // Listen er forsiden på arrangementsværten og /arrangementer på hovedværten.
  const egenVaert = await paaArrangementsVaert();

  return (
    <>
      <GatheringBar
        titel={detail.title}
        tilbage={egenVaert ? "listeRod" : "liste"}
        gatheringId={detail.viewer.isAdmin ? detail.id : undefined}
      />

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        {/*
         * Alt det der før stod som en fuld sidehoved-blok med egen overskrift,
         * resumé, metalinje og en skillelinje, ligger nu på to linjer. Titlen
         * er i bjælken; det her er kun det man skal bruge for at vide hvor man
         * er, og så skal listen i gang.
         */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Badge tone="neutral">{ARRANGEMENT_ETIKETTER[detail.kind]}</Badge>
          <Badge tone={STATUS_TONER[detail.status]}>{STATUS_ETIKETTER[detail.status]}</Badge>
          <span className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
            {detail.heldAt ? <span>{formatDate(detail.heldAt)}</span> : null}
            {detail.location ? <span>{detail.location}</span> : null}
            <span>{detail.attendeeCount} deltagere</span>
          </span>
        </div>

        {detail.summary ? <p className="mt-2 text-sm text-ink-muted">{detail.summary}</p> : null}

        {/*
         * Et udkast er kun synligt for admin — API'et udelader `story` for
         * alle andre. At sige det her fremfor at lade det stå tomt sparer et
         * "hvorfor kan jeg ikke se teksten".
         */}
        {!udgivet && detail.viewer.isAdmin && detail.story ? (
          <p className="mt-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2 text-sm text-ink-soft">
            Opslaget er skrevet, men ikke udgivet. Kun du kan se det.
          </p>
        ) : null}

        <div className="pt-5">
          {udgivet ? (
            <GatheringPost detail={detail} viewerId={user.id} />
          ) : (
            <GatheringLive detail={detail} viewerId={user.id} />
          )}
        </div>
      </div>
    </>
  );
}
