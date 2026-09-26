import { z } from 'zod';
import { mediaOwnerTypeSchema, mediaVariantSchema } from './enums';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const presignRequestSchema = z
  .object({
    ownerType: mediaOwnerTypeSchema,
    /**
     * Klienten beder kun om de varianter den faktisk uploader. Backend bestemmer
     * bucket og nøgle — klienten kan aldrig vælge, hvor filen lander.
     */
    variants: z.array(mediaVariantSchema).min(1).max(5),
    contentType: z.enum(ALLOWED_IMAGE_TYPES),
  })
  .meta({ id: 'PresignRequest' });

export type PresignRequest = z.infer<typeof presignRequestSchema>;

export const presignedUploadSchema = z.object({
  variant: mediaVariantSchema,
  /** PUT hertil med den rå fil og den aftalte Content-Type. */
  uploadUrl: z.url(),
  /** Uigennemsigtig nøgle der refereres, når entiteten gemmes. */
  storageKey: z.string(),
  /** Endelig offentlig URL når uploadet er gennemført. */
  publicUrl: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const presignResponseSchema = z
  .object({
    uploads: z.array(presignedUploadSchema).min(1),
    expiresAt: z.iso.datetime({ offset: true }),
    maxBytes: z.number().int().positive(),
  })
  .meta({ id: 'PresignResponse' });

export type PresignResponse = z.infer<typeof presignResponseSchema>;
