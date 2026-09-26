import { z } from 'zod';
import { questionAnswerTypeSchema } from './enums';
import { idSchema } from './primitives';

export const tasteProfileBucketSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});

/**
 * Sammenfatningen af ét spørgsmåls besvarelser på tværs af alle anmeldelser
 * af en drikkevare. Hvilke felter der er udfyldt afhænger af svartypen:
 * skalaer får et gennemsnit, ja/nej får en andel, og valg får en fordeling.
 */
export const tasteProfileEntrySchema = z
  .object({
    questionId: idSchema,
    prompt: z.string(),
    answerType: questionAnswerTypeSchema,
    /** Antal anmeldelser der faktisk besvarede spørgsmålet. */
    responses: z.number().int().nonnegative(),
    /** SCALE og NUMBER. */
    average: z.number().nullable(),
    scaleMin: z.number().nullable(),
    scaleMax: z.number().nullable(),
    /** BOOLEAN: andelen der svarede ja, 0–1. */
    yesRatio: z.number().min(0).max(1).nullable(),
    /** SELECT og MULTI_SELECT, sorteret faldende efter antal. */
    buckets: z.array(tasteProfileBucketSchema),
  })
  .meta({ id: 'TasteProfileEntry' });

export type TasteProfileEntry = z.infer<typeof tasteProfileEntrySchema>;

export const tasteProfileSchema = z
  .object({
    beverageId: idSchema,
    /** Antal anmeldelser sammenfatningen bygger på. */
    reviewCount: z.number().int().nonnegative(),
    entries: z.array(tasteProfileEntrySchema),
  })
  .meta({ id: 'TasteProfile' });

export type TasteProfile = z.infer<typeof tasteProfileSchema>;
