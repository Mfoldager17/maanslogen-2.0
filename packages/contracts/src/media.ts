import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './primitives';
import { mediaOwnerTypeSchema, mediaVariantSchema } from './enums';

export const mediaRenditionSchema = z
  .object({
    variant: mediaVariantSchema,
    url: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Filstørrelse i bytes, hvis kendt. */
    bytes: z.number().int().nonnegative().nullable(),
  })
  .meta({ id: 'MediaRendition' });

export type MediaRendition = z.infer<typeof mediaRenditionSchema>;

/**
 * Ét logisk billede med flere renditions. Erstatter 2.0-forgængerens `Image`-tabel,
 * hvor hver størrelse var sin egen række uden nogen sammenhæng.
 */
export const mediaAssetSchema = z
  .object({
    id: idSchema,
    ownerType: mediaOwnerTypeSchema,
    /** Alt-tekst. Vigtigt for tilgængelighed — manglede helt i 1.0. */
    alt: z.string().max(200).nullable(),
    blurhash: z.string().max(64).nullable(),
    renditions: z.array(mediaRenditionSchema).min(1),
    createdAt: isoDateTimeSchema,
  })
  .meta({ id: 'MediaAsset' });

export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const mediaRenditionInputSchema = z.object({
  variant: mediaVariantSchema,
  /** Nøglen der blev udstedt af `/uploads/presign`. */
  storageKey: z.string().min(1).max(512),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  bytes: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024)
    .optional(),
});

export const mediaAssetInputSchema = z
  .object({
    alt: z.string().trim().max(200).optional(),
    blurhash: z.string().max(64).optional(),
    renditions: z.array(mediaRenditionInputSchema).min(1).max(5),
  })
  .meta({ id: 'MediaAssetInput' });

export type MediaAssetInput = z.infer<typeof mediaAssetInputSchema>;

/** Hjælper til frontend: vælg den mindste rendition der er stor nok. */
export function pickRendition(
  asset: Pick<MediaAsset, 'renditions'> | null | undefined,
  preferred: z.infer<typeof mediaVariantSchema>,
): MediaRendition | null {
  if (!asset?.renditions?.length) return null;
  return asset.renditions.find((r) => r.variant === preferred) ?? asset.renditions[0] ?? null;
}
