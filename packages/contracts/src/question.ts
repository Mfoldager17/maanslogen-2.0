import { z } from 'zod';
import { questionAnswerTypeSchema } from './enums';
import { baseListQuerySchema } from './pagination';
import { idSchema, isoDateTimeSchema } from './primitives';
import { attributeOptionSchema } from './attribute';

export const questionScaleSchema = z
  .object({
    min: z.number().int().min(0).max(10),
    max: z.number().int().min(1).max(10),
    minLabel: z.string().max(40).optional(),
    maxLabel: z.string().max(40).optional(),
  })
  .meta({ id: 'QuestionScale' });

export type QuestionScale = z.infer<typeof questionScaleSchema>;

export const questionSchema = z
  .object({
    id: idSchema,
    prompt: z.string(),
    helpText: z.string().nullable(),
    answerType: questionAnswerTypeSchema,
    required: z.boolean(),
    sortOrder: z.number().int(),
    options: z.array(attributeOptionSchema).nullable(),
    scale: questionScaleSchema.nullable(),
    /** Tom = gælder alle kategorier. */
    categoryIds: z.array(idSchema),
    /** Tom = gælder alle typer i de valgte kategorier. */
    typeIds: z.array(idSchema),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Question' });

export type Question = z.infer<typeof questionSchema>;

export const createQuestionSchema = z
  .object({
    prompt: z.string().trim().min(3).max(300),
    helpText: z.string().trim().max(500).optional(),
    answerType: questionAnswerTypeSchema,
    required: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    options: z.array(attributeOptionSchema).max(50).nullish(),
    scale: questionScaleSchema.nullish(),
    categoryIds: z.array(idSchema).max(50).optional(),
    typeIds: z.array(idSchema).max(200).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const needsOptions = value.answerType === 'SELECT' || value.answerType === 'MULTI_SELECT';
    if (needsOptions && (!value.options || value.options.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'SELECT-spørgsmål skal have mindst én valgmulighed',
      });
    }
    if (value.answerType === 'SCALE' && value.scale && value.scale.min >= value.scale.max) {
      ctx.addIssue({ code: 'custom', path: ['scale'], message: 'Skalaens min skal være mindre end max' });
    }
  })
  .meta({ id: 'CreateQuestion' });

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = z
  .object({
    prompt: z.string().trim().min(3).max(300).optional(),
    helpText: z.string().trim().max(500).nullish(),
    required: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    options: z.array(attributeOptionSchema).max(50).nullish(),
    scale: questionScaleSchema.nullish(),
    categoryIds: z.array(idSchema).max(50).optional(),
    typeIds: z.array(idSchema).max(200).optional(),
    active: z.boolean().optional(),
  })
  .meta({ id: 'UpdateQuestion' });

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const questionListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['sortOrder', 'prompt', 'createdAt']).default('sortOrder'),
  categoryId: idSchema.optional(),
  typeId: idSchema.optional(),
});
export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

export const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

/** Samme mønster som attributter: én validator delt af API og formular. */
export function validateAnswer(
  question: Pick<Question, 'answerType' | 'prompt' | 'options' | 'scale' | 'required'>,
  value: AnswerValue | null | undefined,
): string | null {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) return question.required ? `"${question.prompt}" skal besvares` : null;

  switch (question.answerType) {
    case 'TEXT':
      return typeof value === 'string' ? null : `"${question.prompt}" skal besvares med tekst`;
    case 'NUMBER': {
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isNaN(numeric) || typeof value === 'boolean' || Array.isArray(value)
        ? `"${question.prompt}" skal besvares med et tal`
        : null;
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : `"${question.prompt}" skal besvares med ja/nej`;
    case 'SCALE': {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(numeric)) return `"${question.prompt}" skal besvares med et tal`;
      const min = question.scale?.min ?? 1;
      const max = question.scale?.max ?? 5;
      return numeric >= min && numeric <= max
        ? null
        : `"${question.prompt}" skal være mellem ${min} og ${max}`;
    }
    case 'SELECT': {
      if (typeof value !== 'string') return `"${question.prompt}" skal være én valgmulighed`;
      const allowed = question.options?.map((option) => option.value) ?? [];
      return allowed.includes(value) ? null : `"${value}" er ikke en gyldig besvarelse`;
    }
    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) return `"${question.prompt}" skal være en liste`;
      const allowed = new Set(question.options?.map((option) => option.value) ?? []);
      const invalid = value.filter((entry) => !allowed.has(entry));
      return invalid.length === 0 ? null : `Ugyldige besvarelser: ${invalid.join(', ')}`;
    }
    default:
      return null;
  }
}
