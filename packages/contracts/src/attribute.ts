import { z } from 'zod';
import { attributeDataTypeSchema } from './enums';
import { baseListQuerySchema } from './pagination';
import { optionalBoolean, csvQuery, idSchema, isoDateTimeSchema } from './primitives';

/**
 * Attributternes værdier er utypede på tværs af rækker, men vi kan gøre dem
 * typede på tværs af API'et: én discriminated union i stedet for 1.0-modellens
 * `valueString | valueNumber | valueBoolean`-felter som alle var nullable.
 */
export const attributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type AttributeValue = z.infer<typeof attributeValueSchema>;

export const attributeOptionSchema = z.object({
  value: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
});
export type AttributeOption = z.infer<typeof attributeOptionSchema>;

export const attributeRulesSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().max(200).optional(),
  })
  .meta({ id: 'AttributeRules' });
export type AttributeRules = z.infer<typeof attributeRulesSchema>;

export const attributeDefinitionSchema = z
  .object({
    id: idSchema,
    key: z.string(),
    displayName: z.string(),
    description: z.string().nullable(),
    dataType: attributeDataTypeSchema,
    /** Enhed vist efter værdien, fx "%" eller "IBU". Fandtes ikke i 1.0. */
    unit: z.string().nullable(),
    required: z.boolean(),
    filterable: z.boolean(),
    /** Vis attributten fremtrædende på kort/lister. */
    highlighted: z.boolean(),
    sortOrder: z.number().int(),
    rules: attributeRulesSchema.nullable(),
    options: z.array(attributeOptionSchema).nullable(),
    /** Tom liste = gælder alle kategorier. */
    categoryIds: z.array(idSchema),
    /** Tom liste = gælder alle typer i de valgte kategorier. */
    typeIds: z.array(idSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'AttributeDefinition' });

export type AttributeDefinition = z.infer<typeof attributeDefinitionSchema>;

export const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const createAttributeDefinitionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(ATTRIBUTE_KEY_PATTERN, 'Nøglen skal være snake_case, fx "alcohol_percent"'),
    displayName: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    dataType: attributeDataTypeSchema,
    unit: z.string().trim().max(16).optional(),
    required: z.boolean().optional(),
    filterable: z.boolean().optional(),
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    rules: attributeRulesSchema.nullish(),
    options: z.array(attributeOptionSchema).max(100).nullish(),
    categoryIds: z.array(idSchema).max(50).optional(),
    typeIds: z.array(idSchema).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    const needsOptions = value.dataType === 'ENUM' || value.dataType === 'MULTI_ENUM';
    if (needsOptions && (!value.options || value.options.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'ENUM-attributter skal have mindst én valgmulighed',
      });
    }
    if (!needsOptions && value.options && value.options.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Valgmuligheder kan kun sættes på ENUM- og MULTI_ENUM-attributter',
      });
    }
    if (value.rules?.min !== undefined && value.rules.max !== undefined) {
      if (value.rules.min > value.rules.max) {
        ctx.addIssue({ code: 'custom', path: ['rules', 'min'], message: 'min må ikke være større end max' });
      }
    }
  })
  .meta({ id: 'CreateAttributeDefinition' });

export type CreateAttributeDefinitionInput = z.infer<typeof createAttributeDefinitionSchema>;

/**
 * `key` kan ikke ændres efter oprettelse — den er nøglen eksisterende værdier hænger på,
 * og at ændre den ville bryde alle gemte attributværdier.
 */
export const updateAttributeDefinitionSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullish(),
    unit: z.string().trim().max(16).nullish(),
    required: z.boolean().optional(),
    filterable: z.boolean().optional(),
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    rules: attributeRulesSchema.nullish(),
    options: z.array(attributeOptionSchema).max(100).nullish(),
    categoryIds: z.array(idSchema).max(50).optional(),
    typeIds: z.array(idSchema).max(200).optional(),
  })
  .meta({ id: 'UpdateAttributeDefinition' });

export type UpdateAttributeDefinitionInput = z.infer<typeof updateAttributeDefinitionSchema>;

export const attributeDefinitionListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['sortOrder', 'displayName', 'createdAt']).default('sortOrder'),
  categoryId: idSchema.optional(),
  typeId: idSchema.optional(),
  dataTypes: csvQuery(attributeDataTypeSchema),
  filterable: optionalBoolean(),
});
export type AttributeDefinitionListQuery = z.infer<typeof attributeDefinitionListQuerySchema>;

/** En attributværdi som den ser ud på en drikkevare. */
export const beverageAttributeSchema = z
  .object({
    definitionId: idSchema,
    key: z.string(),
    displayName: z.string(),
    dataType: attributeDataTypeSchema,
    unit: z.string().nullable(),
    highlighted: z.boolean(),
    sortOrder: z.number().int(),
    value: attributeValueSchema,
    /** Færdigformateret til visning, fx "5,6 %". */
    displayValue: z.string(),
  })
  .meta({ id: 'BeverageAttribute' });

export type BeverageAttribute = z.infer<typeof beverageAttributeSchema>;

export const beverageAttributeInputSchema = z.object({
  definitionId: idSchema,
  value: attributeValueSchema.nullable(),
});
export type BeverageAttributeInput = z.infer<typeof beverageAttributeInputSchema>;

/**
 * Validerer en konkret værdi op mod sin definition. Bruges både i API'et (autoritativt)
 * og i frontend-formularen (øjeblikkelig feedback) — samme regler, ét sted.
 */
export function validateAttributeValue(
  definition: Pick<AttributeDefinition, 'dataType' | 'displayName' | 'rules' | 'options'>,
  value: AttributeValue | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const { dataType, rules, options } = definition;

  switch (dataType) {
    case 'TEXT': {
      if (typeof value !== 'string') return `${definition.displayName} skal være tekst`;
      if (rules?.minLength !== undefined && value.length < rules.minLength)
        return `${definition.displayName} skal være mindst ${rules.minLength} tegn`;
      if (rules?.maxLength !== undefined && value.length > rules.maxLength)
        return `${definition.displayName} må højst være ${rules.maxLength} tegn`;
      if (rules?.pattern && !new RegExp(rules.pattern).test(value))
        return `${definition.displayName} har ugyldigt format`;
      return null;
    }
    case 'NUMBER': {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (typeof value === 'boolean' || Array.isArray(value) || Number.isNaN(numeric))
        return `${definition.displayName} skal være et tal`;
      if (rules?.min !== undefined && numeric < rules.min)
        return `${definition.displayName} skal være mindst ${rules.min}`;
      if (rules?.max !== undefined && numeric > rules.max)
        return `${definition.displayName} må højst være ${rules.max}`;
      return null;
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : `${definition.displayName} skal være ja/nej`;
    case 'ENUM': {
      if (typeof value !== 'string') return `${definition.displayName} skal være én valgmulighed`;
      const allowed = options?.map((option) => option.value) ?? [];
      return allowed.includes(value) ? null : `"${value}" er ikke en gyldig værdi for ${definition.displayName}`;
    }
    case 'MULTI_ENUM': {
      if (!Array.isArray(value)) return `${definition.displayName} skal være en liste af valgmuligheder`;
      const allowed = new Set(options?.map((option) => option.value) ?? []);
      const invalid = value.filter((entry) => !allowed.has(entry));
      return invalid.length === 0
        ? null
        : `Ugyldige værdier for ${definition.displayName}: ${invalid.join(', ')}`;
    }
    default:
      return null;
  }
}

/** Menneskevenlig visning af en attributværdi. */
export function formatAttributeValue(
  definition: Pick<AttributeDefinition, 'dataType' | 'unit' | 'options'>,
  value: AttributeValue | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  const suffix = definition.unit ? ` ${definition.unit}` : '';
  switch (definition.dataType) {
    case 'BOOLEAN':
      return value ? 'Ja' : 'Nej';
    case 'NUMBER': {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(numeric)) return '—';
      return `${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(numeric)}${suffix}`;
    }
    case 'ENUM': {
      const label = definition.options?.find((option) => option.value === value)?.label;
      return `${label ?? String(value)}${suffix}`;
    }
    case 'MULTI_ENUM': {
      if (!Array.isArray(value)) return '—';
      const labels = value.map(
        (entry) => definition.options?.find((option) => option.value === entry)?.label ?? entry,
      );
      return labels.join(', ') || '—';
    }
    default:
      return `${String(value)}${suffix}`;
  }
}
