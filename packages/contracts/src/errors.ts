import { z } from 'zod';

/**
 * Fejl følger RFC 9457 (Problem Details). Det giver ét forudsigeligt fejlformat
 * for hele API'et i stedet for Nests standard `{ statusCode, message }`.
 */
export const problemDetailsSchema = z
  .object({
    /** URI der identificerer fejltypen, fx "https://maanslogen.dk/problems/validation-failed". */
    type: z.string(),
    /** Kort, menneskelæsbar overskrift. */
    title: z.string(),
    status: z.number().int().min(100).max(599),
    /** Forklaring rettet mod denne specifikke forekomst. */
    detail: z.string().optional(),
    /** Stien fejlen opstod på. */
    instance: z.string().optional(),
    /** Korrelations-id, matcher `x-request-id` i svaret. */
    requestId: z.string().optional(),
    /** Feltfejl ved validering: `{ "name": ["Må ikke være tom"] }`. */
    errors: z.record(z.string(), z.array(z.string())).optional(),
  })
  .meta({ id: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_BASE_URI = 'https://maanslogen.dk/problems';

export const ProblemType = {
  ValidationFailed: `${PROBLEM_BASE_URI}/validation-failed`,
  NotFound: `${PROBLEM_BASE_URI}/not-found`,
  Conflict: `${PROBLEM_BASE_URI}/conflict`,
  Unauthorized: `${PROBLEM_BASE_URI}/unauthorized`,
  Forbidden: `${PROBLEM_BASE_URI}/forbidden`,
  RateLimited: `${PROBLEM_BASE_URI}/rate-limited`,
  PayloadTooLarge: `${PROBLEM_BASE_URI}/payload-too-large`,
  Internal: `${PROBLEM_BASE_URI}/internal-error`,
} as const;
