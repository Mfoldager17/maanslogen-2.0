import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { hentArrangement } from "@/lib/arrangement.server";
import { getCurrentUser } from "@/lib/session";
import { GatheringBar } from "@/components/gathering/gathering-bar";
import { GatheringManager } from "@/components/gathering/gathering-manager";

export const metadata: Metadata = {
  title: "Styring",
  // Logens eget rum har intet at lave i et søgeindeks — og styringen da slet
  // ikke.
  robots: { index: false, follow: false },
};

/**
 * Styringen, inde i arrangementsfladen.
 *
 * Den fandtes før kun som `/admin/arrangementer/{id}`, og dén vej er lukket på
 * arrangementsværten: alt uden for `/arrangementer` bliver skrevet om, så
 * `/admin/...` blev til `/arrangementer/admin/...` og endte i en 404. Vejen ud
 * til hovedsitet ville desuden være det stik modsatte af hvad fladen er til —
 * man står med en telefon midt i en smagning og skal trykke "skænk nu".
 *
 * Adressen ligger under arrangementet selv og virker derfor begge steder:
 * `/arrangementer/{slug}/styring` på hovedværten, og det samme — plus den
 * korte `/{slug}/styring` — på arrangementsværten.
 */
export default async function ArrangementStyringPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/log-ind?retur=${encodeURIComponent(`/arrangementer/${slug}/styring`)}`);

  const detail = await hentArrangement(slug);
  if (!detail) notFound();

  /*
   * `viewer` kommer fra API'et, som er det eneste sted reglerne findes. Fladen
   * gætter ikke selv — og `notFound()` frem for en fejlside: en deltager der
   * ikke må styre, har ingenting at gøre på adressen, og "findes ikke" er et
   * ærligere svar end en side der fortæller hvad man ikke må.
   */
  if (!detail.viewer.isAdmin) notFound();

  // Hele listen, ikke første side: en afkortet liste ville betyde at den man
  // ledte efter manglede i dropdownen uden at nogen opdagede hvorfor.
  const brugere = await alleSider<User>((query) => api.users.list(query), { sort: "displayName" });

  return (
    <>
      <GatheringBar titel={detail.title} tilbage="arrangement" slug={detail.slug} />

      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <p className="mb-5 text-sm text-ink-muted">
          Du styrer {detail.title}. Deltagerne ser ændringerne med det samme.
        </p>

        <GatheringManager detail={detail} kandidater={brugere} efterSletning="/arrangementer" />
      </div>
    </>
  );
}
