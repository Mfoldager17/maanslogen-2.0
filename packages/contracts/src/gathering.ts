import { z } from 'zod';
import { gatheringKindSchema, gatheringStatusSchema } from './enums';
import { baseListQuerySchema } from './pagination';
import { idSchema, isoDateTimeSchema, slugSchema } from './primitives';
import { ratingSchema } from './review';

/**
 * Et arrangement er en anledning: logen mødtes, drak nogle ting, og skrev ned
 * hvad de syntes. Bagefter bliver det til et opslag man kan gå tilbage til.
 *
 * Noterne herinde er bevidst *ikke* `Review`. En anmeldelse er din stående dom
 * om en drikkevare — `Review` har `@@unique([userId, beverageId])`, så du kan
 * kun have én. En note er hvad du syntes dén aften. Smager I det samme igen et
 * år senere, skal begge dele kunne stå.
 */

export const gatheringAttendeeSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    invitedAt: isoDateTimeSchema,
    /** Sættes første gang deltageren skriver noget. Skelner "var med" fra "kom ikke". */
    joinedAt: isoDateTimeSchema.nullable(),
  })
  .meta({ id: 'GatheringAttendee' });

export type GatheringAttendee = z.infer<typeof gatheringAttendeeSchema>;

export const gatheringNoteSchema = z
  .object({
    id: idSchema,
    attendeeId: idSchema,
    authorName: z.string(),
    rating: z.number(),
    body: z.string().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'GatheringNote' });

export type GatheringNote = z.infer<typeof gatheringNoteSchema>;

/** Drikkevaren som den optræder på arrangementet, hvis den findes i kataloget. */
export const gatheringItemBeverageSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  brandName: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export const gatheringItemSchema = z
  .object({
    id: idSchema,
    sortOrder: z.number().int(),
    /**
     * `beverage` er null indtil posten er knyttet til kataloget. Til en festival
     * skriver man navnet som det står på skiltet og går videre; koblingen sker
     * hjemme i sofaen bagefter.
     */
    beverage: gatheringItemBeverageSchema.nullable(),
    label: z.string().nullable(),
    /** Det navn fladen skal vise: katalognavnet, ellers etiketten. */
    displayName: z.string(),
    blind: z.boolean(),
    servedAt: isoDateTimeSchema.nullable(),
    note: z.string().nullable(),
    notes: z.array(gatheringNoteSchema),
    averageRating: z.number().nullable(),
    noteCount: z.number().int().nonnegative(),
  })
  .meta({ id: 'GatheringItem' });

export type GatheringItem = z.infer<typeof gatheringItemSchema>;

export const gatheringHostSchema = z.object({
  id: idSchema,
  displayName: z.string(),
});

/** Listevisningen. Uden ting og deltagere — dem henter detaljen. */
export const gatheringSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    kind: gatheringKindSchema,
    status: gatheringStatusSchema,
    title: z.string(),
    summary: z.string().nullable(),
    heldAt: isoDateTimeSchema.nullable(),
    location: z.string().nullable(),
    host: gatheringHostSchema,
    /** Sat = opslaget er skrevet færdigt og udsendt. Låser samtidig noterne. */
    publishedAt: isoDateTimeSchema.nullable(),
    itemCount: z.number().int().nonnegative(),
    attendeeCount: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Gathering' });

export type Gathering = z.infer<typeof gatheringSchema>;

export const gatheringDetailSchema = gatheringSchema
  .extend({
    /** Bloggens brødtekst. Skjult indtil `publishedAt` er sat, undtagen for admin. */
    story: z.string().nullable(),
    items: z.array(gatheringItemSchema),
    attendees: z.array(gatheringAttendeeSchema),
    /** Hvad den kaldende bruger må her og nu — så fladen slipper for at gætte. */
    viewer: z.object({
      isHost: z.boolean(),
      isAdmin: z.boolean(),
      attendeeId: idSchema.nullable(),
      canAddItems: z.boolean(),
      canWriteNotes: z.boolean(),
    }),
  })
  .meta({ id: 'GatheringDetail' });

export type GatheringDetail = z.infer<typeof gatheringDetailSchema>;

// ---- Input ---------------------------------------------------------------

export const createGatheringSchema = z
  .object({
    kind: gatheringKindSchema,
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().max(400).optional(),
    heldAt: isoDateTimeSchema.optional(),
    location: z.string().trim().max(160).optional(),
  })
  .meta({ id: 'CreateGathering' });

export type CreateGatheringInput = z.infer<typeof createGatheringSchema>;

export const updateGatheringSchema = createGatheringSchema
  .partial()
  .omit({ kind: true })
  .extend({
    story: z.string().max(20_000).nullish(),
    status: gatheringStatusSchema.optional(),
  })
  .meta({ id: 'UpdateGathering' });

export type UpdateGatheringInput = z.infer<typeof updateGatheringSchema>;

/**
 * Enten en drikkevare fra kataloget eller en etiket skrevet i farten — men
 * mindst én af dem. En post uden nogen af delene siger ingenting.
 */
export const addGatheringItemSchema = z
  .object({
    beverageId: idSchema.optional(),
    label: z.string().trim().min(1).max(160).optional(),
    blind: z.boolean().optional(),
    note: z.string().trim().max(400).optional(),
  })
  .refine((value) => value.beverageId !== undefined || value.label !== undefined, {
    message: 'Angiv enten en drikkevare fra kataloget eller et navn',
    path: ['label'],
  })
  .meta({ id: 'AddGatheringItem' });

export type AddGatheringItemInput = z.infer<typeof addGatheringItemSchema>;

export const updateGatheringItemSchema = z
  .object({
    /** Knytter en post skrevet i farten til kataloget bagefter. */
    beverageId: idSchema.nullish(),
    label: z.string().trim().min(1).max(160).nullish(),
    blind: z.boolean().optional(),
    note: z.string().trim().max(400).nullish(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .meta({ id: 'UpdateGatheringItem' });

export type UpdateGatheringItemInput = z.infer<typeof updateGatheringItemSchema>;

export const upsertGatheringNoteSchema = z
  .object({
    rating: ratingSchema,
    body: z.string().trim().max(2000).nullish(),
  })
  .meta({ id: 'UpsertGatheringNote' });

export type UpsertGatheringNoteInput = z.infer<typeof upsertGatheringNoteSchema>;

export const inviteAttendeeSchema = z.object({ userId: idSchema }).meta({ id: 'InviteAttendee' });

export type InviteAttendeeInput = z.infer<typeof inviteAttendeeSchema>;

export const gatheringListQuerySchema = baseListQuerySchema.extend({
  kind: gatheringKindSchema.optional(),
  status: gatheringStatusSchema.optional(),
  sort: z.enum(['heldAt', 'createdAt', 'title']).default('heldAt'),
});

export type GatheringListQuery = z.infer<typeof gatheringListQuerySchema>;
