import Image from "next/image";
import { pickRendition, type MediaAsset, type MediaVariant } from "@maanslogen/contracts";
import { cn } from "@/lib/cn";

const GLYPHS = {
  beer: (
    <>
      <path d="M7 4h7v16H7z" />
      <path d="M14 8h2.5a1.5 1.5 0 0 1 0 5H14" />
      <path d="M7 8h7" />
    </>
  ),
  wine: (
    <>
      <path d="M7 3h10l-1 6a4 4 0 0 1-8 0z" />
      <path d="M12 13v7" />
      <path d="M8.5 20h7" />
    </>
  ),
  tumbler: (
    <>
      <path d="M6 8h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
      <path d="M6.6 14h10.8" />
    </>
  ),
  coupe: (
    <>
      <path d="M5 4h14l-7 8z" />
      <path d="M12 12v8" />
      <path d="M8.5 20h7" />
    </>
  ),
} as const;

/** Vælger et glas der passer til kategorien, så pladsholderen ikke er en grå kasse. */
function glyphFor(category: string | undefined): keyof typeof GLYPHS {
  const name = (category ?? "").toLowerCase();
  if (name.includes("øl") || name.includes("cider")) return "beer";
  if (name.includes("vin")) return "wine";
  if (name.includes("gin")) return "coupe";
  return "tumbler";
}

export function MediaImage({
  media,
  alt,
  variant = "CARD",
  categoryName,
  sizes,
  className,
  priority,
}: {
  media: MediaAsset | null;
  alt: string;
  variant?: MediaVariant;
  categoryName?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const rendition = pickRendition(media, variant);

  if (!rendition) {
    return (
      <span
        className={cn("flex items-center justify-center bg-sunken text-accent/70", className)}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2/5 w-2/5 max-h-20 max-w-20"
        >
          {GLYPHS[glyphFor(categoryName)]}
        </svg>
      </span>
    );
  }

  return (
    <span className={cn("relative block overflow-hidden bg-sunken", className)}>
      <Image
        src={rendition.url}
        alt={media?.alt ?? alt}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        priority={priority}
        /**
         * Billedet er allerede skaleret til netop denne variant ved upload, så
         * der er intet for Next at optimere. Slår man det til, henter vores
         * egen server filen fra R2 for at gen-kode den — altså en R2-læsning
         * *og* CPU-tid for noget der allerede er gjort.
         *
         * Uoptimeret går browseren direkte til Cloudflare-domænet foran
         * bucketen, hvor et cache-hit slet ikke rører R2. Lazy loading og den
         * reserverede plads (ingen layoutskift) får vi stadig fra next/image.
         */
        unoptimized
        className="object-cover"
      />
    </span>
  );
}
