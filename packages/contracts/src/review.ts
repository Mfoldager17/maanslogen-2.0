import { z } from 'zod';
import { answerValueSchema, questionSchema } from './question';
import { baseListQuerySchema } from './pagination';
import { optionalFloat, idSchema, isoDateTimeSchema } from './primitives';

export const MIN_RATING = 1;
export const MAX_RATING = 5;
/** Halve stjerner. */
export const RATING_STEP = 0.5;

export const ratingSchema = z
  .number()
  .min(MIN_RATING)
  .max(MAX_RATING)
  .refine((value) => Number.isInteger(value / RATING_STEP), {
    message: 'Bedømmelsen skal være i halve stjerner (1, 1.5, 2 …)',
  });

export const reviewAnswerSchema = z
  .object({
    questionId: idSchema,
    prompt: z.string(),
    answerType: questionSchema.shape.answerType,
    value: answerValueSchema,
    displayValue: z.string(),
  })
  .meta({ id: 'ReviewAnswer' });

export type ReviewAnswer = z.infer<typeof reviewAnswerSchema>;

export const reviewAuthorSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const reviewSchema = z
  .object({
    id: idSchema,
    beverageId: idSchema,
    beverageName: z.string().optional(),
    beverageSlug: z.string().optional(),
    author: reviewAuthorSchema,
    rating: z.number(),
    title: z.string().nullable(),
    body: z.string().nullable(),
    answers: z.array(reviewAnswerSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Review' });

export type Review = z.infer<typeof reviewSchema>;

export const reviewAnswerInputSchema = z.object({
  questionId: idSchema,
  value: answerValueSchema.nullable(),
});

export const createReviewSchema = z
  .object({
    beverageId: idSchema,
    rating: ratingSchema,
    title: z.string().trim().max(160).optional(),
    body: z.string().trim().max(5_000).optional(),
    answers: z.array(reviewAnswerInputSchema).max(50).optional(),
  })
  .meta({ id: 'CreateReview' });

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = createReviewSchema
  .omit({ beverageId: true })
  .partial()
  .meta({ id: 'UpdateReview' });

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['createdAt', 'rating']).default('createdAt'),
  beverageId: idSchema.optional(),
  userId: idSchema.optional(),
  minRating: optionalFloat({ min: MIN_RATING, max: MAX_RATING }),
  maxRating: optionalFloat({ min: MIN_RATING, max: MAX_RATING }),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

/** Alt en anmelder skal bruge for at udfylde formularen for én drikkevare. */
export const reviewFormSchema = z
  .object({
    beverageId: idSchema,
    beverageName: z.string(),
    questions: z.array(questionSchema),
    /** Brugerens eksisterende anmeldelse, hvis der er en (én pr. bruger pr. drikkevare). */
    existingReview: reviewSchema.nullable(),
  })
  .meta({ id: 'ReviewForm' });

export type ReviewForm = z.infer<typeof reviewFormSchema>;
