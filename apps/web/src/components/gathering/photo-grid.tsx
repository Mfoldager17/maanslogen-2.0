"use client";

import type { GatheringPhoto } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";

/**
 * Billederne fra aftenen.
 *
 * Et almindeligt `<img>`, ikke `next/image`, og det er ikke sjusk. Adresserne
 * er signerede og kortlivede og skifter ved hvert svar, så optimeringscachen —
 * som nøgles på URL'en — ville gemme hver enkelt signatur én gang og aldrig
 * genbruge noget. Værre: den optimerede kopi ligger derefter på vores eget
 * domæne **uden** signatur, og så er billedet ude af den private bucket
 * alligevel. `unoptimized` ville løse det, men gør det til noget man kan
 * fjerne ved et uheld; her er der ikke noget at fjerne.
 *
 * `referrerPolicy`: adressen indeholder signaturen, og den skal ikke følge med
 * som Referer hvis billedet en dag peger et andet sted hen.
 */
export function PhotoGrid({
  gatheringId,
  photos,
  viewerId,
  kanFjerne,
}: {
  gatheringId: string;
  photos: GatheringPhoto[];
  viewerId: string;
  kanFjerne: boolean;
}) {
  const { pending, run } = useApiMutation();

  if (photos.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.id} className="group relative">
          <div className="relative aspect-square overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element -- se noten ovenfor */}
            <img
              src={photo.url}
              alt={photo.caption ?? `Billede lagt op af ${photo.uploadedByName}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
            />
          </div>

          {photo.caption ? (
            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{photo.caption}</p>
          ) : null}

          {kanFjerne && photo.uploadedById === viewerId ? (
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() =>
                void run(() => api.gatherings.removePhoto(gatheringId, photo.id), {
                  success: "Billedet er fjernet",
                })
              }
            >
              Fjern
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
