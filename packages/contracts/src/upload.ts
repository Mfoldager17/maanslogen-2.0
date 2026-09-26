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

/**
 * Cache-Control der sættes på objektet ved upload.
 *
 * Nøglerne er uforanderlige — hvert upload får sit eget UUID i stien, og et
 * objekt bliver aldrig overskrevet. Derfor kan både browseren og Cloudflares
 * cache holde på filen for evigt, og et genbesøg koster ingen R2-operation.
 */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const presignedUploadSchema = z.object({
  variant: mediaVariantSchema,
  /** PUT hertil med den rå fil og præcis de headers der står i `headers`. */
  uploadUrl: z.url(),
  /**
   * Headers klienten skal sende med sin PUT. Objektlageret gemmer dem som
   * metadata og returnerer dem igen ved GET.
   *
   * De indgår ikke i signaturen (presignede URL'er signerer kun `host`), så de
   * er ikke håndhævet — en klient der udelader `cache-control` får bare et
   * objekt uden cache-instruks. Det er derfor Cache Rule'en i Cloudflare er
   * den der *garanterer* edge-caching; denne header styrer browseren.
   */
  headers: z.record(z.string(), z.string()),
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
