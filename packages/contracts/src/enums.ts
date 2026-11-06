import { z } from 'zod';

/**
 * Alle enums lever her, så API (Prisma) og web deler præcis de samme værdier.
 * Prisma-enums i `apps/api/prisma/schema.prisma` skal matche 1:1 — det verificeres
 * af en test i API'et (`prisma-enums.spec.ts`).
 */

export const roleSchema = z.enum(['USER', 'MODERATOR', 'ADMIN']).meta({
  id: 'Role',
  description: 'Brugerens rolle. MODERATOR kan redigere katalogdata, ADMIN kan alt.',
});
export type Role = z.infer<typeof roleSchema>;

/** Rolle-hierarki: en rolle giver adgang til alt på eller under sit niveau. */
export const ROLE_RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export function roleAtLeast(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export const attributeDataTypeSchema = z
  .enum(['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM', 'MULTI_ENUM'])
  .meta({
    id: 'AttributeDataType',
    description: 'Datatypen for en attributdefinition (fx alkoholprocent = NUMBER).',
  });
export type AttributeDataType = z.infer<typeof attributeDataTypeSchema>;

export const questionAnswerTypeSchema = z
  .enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SCALE', 'SELECT', 'MULTI_SELECT'])
  .meta({
    id: 'QuestionAnswerType',
    description: 'Svartypen for et anmeldelsesspørgsmål.',
  });
export type QuestionAnswerType = z.infer<typeof questionAnswerTypeSchema>;

export const mediaVariantSchema = z.enum(['THUMB', 'CARD', 'FULL', 'AVATAR']).meta({
  id: 'MediaVariant',
  description: 'Én konkret rendering (størrelse) af et medie-asset.',
});
export type MediaVariant = z.infer<typeof mediaVariantSchema>;

export const mediaOwnerTypeSchema = z.enum(['BEVERAGE', 'BRAND', 'CATEGORY', 'USER']).meta({
  id: 'MediaOwnerType',
  description: 'Hvilken slags entitet et medie-asset hører til.',
});
export type MediaOwnerType = z.infer<typeof mediaOwnerTypeSchema>;

/** Pixelmål pr. variant — bruges både af upload-API og af klientens resize. */
export const MEDIA_VARIANT_SIZES: Record<MediaVariant, { width: number; height: number }> = {
  THUMB: { width: 200, height: 200 },
  CARD: { width: 600, height: 600 },
  FULL: { width: 1200, height: 1200 },
  AVATAR: { width: 256, height: 256 },
};

/** Hvilke varianter en given ejer-type får genereret ved upload. */
export const MEDIA_OWNER_VARIANTS: Record<MediaOwnerType, readonly MediaVariant[]> = {
  BEVERAGE: ['THUMB', 'CARD', 'FULL'],
  BRAND: ['THUMB', 'CARD'],
  CATEGORY: ['THUMB', 'CARD'],
  USER: ['AVATAR'],
};

export const gatheringKindSchema = z
  .enum(['TASTING', 'FESTIVAL', 'VISIT', 'DINNER', 'OTHER'])
  .meta({
    id: 'GatheringKind',
    description:
      'Hvad slags arrangement. TASTING er kurateret: rækkefølgen er bestemt i forvejen, og værten skænker én ad gangen. De øvrige er ad hoc — deltagerne skriver ind hvad de drikker, undervejs.',
  });
export type GatheringKind = z.infer<typeof gatheringKindSchema>;

/**
 * Den ene forskel der betyder noget i koden: hvem må lægge ting på listen, og
 * er der en rækkefølge bestemt i forvejen. Alt andet er fælles.
 */
export function erKurateret(kind: GatheringKind): boolean {
  return kind === 'TASTING';
}

export const gatheringStatusSchema = z.enum(['PLANNED', 'LIVE', 'DONE']).meta({
  id: 'GatheringStatus',
  description:
    'PLANNED: oprettet, ikke begyndt. LIVE: i gang — her skrives noterne. DONE: afholdt; værten skriver opslaget færdigt og udgiver det.',
});
export type GatheringStatus = z.infer<typeof gatheringStatusSchema>;
