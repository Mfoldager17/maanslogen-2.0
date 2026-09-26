import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/api.server";
import { serverApiOrNull } from "@/lib/api/server";
import type { Beverage, TasteProfile } from "@maanslogen/contracts";
import { MediaImage } from "@/components/catalog/media-image";
import { RatingSummaryPanel } from "@/components/catalog/rating-summary";
import { TasteProfilePanel } from "@/components/catalog/taste-profile";
import { ReviewList } from "@/components/catalog/review-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCountry } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

async function loadBeverage(slug: string): Promise<Beverage> {
  const beverage = await serverApiOrNull<Beverage>(`/beverages/${slug}`);
  if (!beverage) notFound();
  return beverage;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  try {
    const beverage = await api.beverages.get(slug);
    return {
      title: `${beverage.name} · ${beverage.brand?.name ?? ""}`.trim(),
      description:
        beverage.description ??
        `${beverage.name} fra ${beverage.brand?.name ?? "ukendt mærke"} — bedømmelser og smagsprofil.`,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { title: "Ikke fundet" };
    throw error;
  }
}

export default async function BeveragePage({ params }: Params) {
  const { slug } = await params;
  const beverage = await loadBeverage(slug);

  const [profile, reviews] = await Promise.all([
    serverApiOrNull<TasteProfile>(`/reviews/profile/${beverage.slug}`),
    api.reviews.list({ beverageId: beverage.id, limit: 6, sort: "createdAt", order: "desc" }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Brødkrumme" className="mb-6 text-sm text-ink-muted">
        <Link href="/katalog" className="hover:text-ink">
          Katalog
        </Link>
        {beverage.category ? (
          <>
            <span className="mx-1.5">/</span>
            <Link
              href={`/katalog?categorySlug=${beverage.category.slug}`}
              className="hover:text-ink"
            >
              {beverage.category.name}
            </Link>
          </>
        ) : null}
        <span className="mx-1.5">/</span>
        <span className="text-ink">{beverage.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr_16rem]">
        <MediaImage
          media={beverage.media}
          alt={beverage.name}
          variant="FULL"
          categoryName={beverage.category?.name}
          className="aspect-square w-full rounded-[var(--radius-card)] border border-line"
          sizes="(max-width: 1024px) 100vw, 20rem"
          priority
        />

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              {beverage.brand ? (
                <Link
                  href={`/katalog?brandIds=${beverage.brand.id}`}
                  className="font-semibold text-accent hover:underline"
                >
                  {beverage.brand.name}
                </Link>
              ) : null}
              {beverage.type ? (
                <>
                  <span className="text-line-strong" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-ink-muted">{beverage.type.name}</span>
                </>
              ) : null}
              {beverage.countryCode ? (
                <Badge>{formatCountry(beverage.countryCode) ?? beverage.countryCode}</Badge>
              ) : null}
              {beverage.vintage ? <Badge>Årgang {beverage.vintage}</Badge> : null}
            </div>

            <h1 className="break-words font-display text-4xl font-semibold leading-tight tracking-tight">
              {beverage.name}
            </h1>

            {beverage.description ? (
              <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{beverage.description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/drikkevarer/${beverage.slug}/anmeld`}>Skriv en anmeldelse</Link>
            </Button>
          </div>

          {beverage.attributes.length > 0 ? (
            <section aria-labelledby="egenskaber" className="border-t border-line pt-5">
              <h2
                id="egenskaber"
                className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted"
              >
                Egenskaber
              </h2>
              {/*
               * Fire spalter gav felter der var smallere end etiketter som
               * "Serveringstemperatur", så teksten skrev sig ud over rammen.
               */}
              <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {beverage.attributes.map((attribute) => (
                  <div
                    key={attribute.definitionId}
                    className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3"
                  >
                    <dt className="break-words text-xs text-ink-muted">{attribute.displayName}</dt>
                    <dd className="break-words font-display text-xl font-semibold">
                      {attribute.displayValue}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <RatingSummaryPanel rating={beverage.rating} />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[20rem_1fr]">
        {/*
         * `TasteProfilePanel` returnerer selv null uden besvarede spørgsmål, så
         * `profile ? …` alene efterlod en tom 20rem-spalte ved siden af en
         * sammenklemt anmeldelsesliste.
         */}
        {profile && profile.entries.length > 0 ? <TasteProfilePanel profile={profile} /> : <div />}

        <section aria-labelledby="anmeldelser">
          <h2 id="anmeldelser" className="mb-4 font-display text-xl font-semibold">
            Anmeldelser
          </h2>
          <ReviewList reviews={reviews.items} />
        </section>
      </div>
    </div>
  );
}
