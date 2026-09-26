import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { Beverage, ReviewForm as ReviewFormData } from "@maanslogen/contracts";
import { serverApiOrNull } from "@/lib/api/server";
import { getCurrentUser } from "@/lib/session";
import { ReviewForm } from "@/components/review/review-form";
import { MediaImage } from "@/components/catalog/media-image";
import { AttributeChip } from "@/components/catalog/attribute-chip";

export const metadata: Metadata = { title: "Skriv en anmeldelse" };

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/log-ind?retur=${encodeURIComponent(`/drikkevarer/${slug}/anmeld`)}`);

  const [beverage, form] = await Promise.all([
    serverApiOrNull<Beverage>(`/beverages/${slug}`),
    serverApiOrNull<ReviewFormData>(`/reviews/form/${slug}`),
  ]);
  if (!beverage || !form) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/drikkevarer/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Tilbage til {beverage.name}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Skriv en anmeldelse
          </h1>
          <p className="mb-6 mt-1 text-sm text-ink-muted">
            Spørgsmålene herunder er hentet for{" "}
            <strong className="font-semibold text-ink">
              {beverage.category?.name} › {beverage.type?.name}
            </strong>{" "}
            — en anden type ville give andre.
          </p>

          <ReviewForm form={form} slug={slug} />
        </div>

        <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-24">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <MediaImage
              media={beverage.media}
              alt={beverage.name}
              variant="CARD"
              categoryName={beverage.category?.name}
              className="mb-3 aspect-[4/3] w-full rounded-[var(--radius-control)]"
              sizes="18rem"
            />
            <p className="text-xs text-ink-muted">
              {beverage.brand?.name} · {beverage.type?.name}
            </p>
            <p className="font-display text-lg font-semibold leading-snug">{beverage.name}</p>
            {beverage.attributes.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {beverage.attributes
                  .filter((attribute) => attribute.highlighted)
                  .slice(0, 4)
                  .map((attribute) => (
                    <AttributeChip key={attribute.definitionId} attribute={attribute} />
                  ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-card)] border border-line-strong bg-sunken p-4">
            <p className="mb-1.5 text-sm font-bold text-accent-hover">
              Hvorfor lige disse spørgsmål?
            </p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Spørgsmålene defineres pr. kategori og type i admin. Kommer der et nyt i morgen,
              ændres gamle anmeldelser ikke — de har bare ikke svaret på det.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
