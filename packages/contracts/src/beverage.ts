import { z } from 'zod';
import { beverageAttributeInputSchema, beverageAttributeSchema } from './attribute';
import { brandSchema, categorySchema, beverageTypeSchema, countryCodeSchema } from './catalog';
import { mediaAssetInputSchema, mediaAssetSchema } from './media';
import { baseListQuerySchema } from './pagination';
import {
  optionalBoolean,
  csvQuery,
  optionalFloat,
  idSchema,
  isoDateTimeSchema,
  slugSchema,
} from './primitives';

export const ratingSummarySchema = z
  .object({
    average: z.number().min(0).max(5),
    count: z.number().int().nonnegative(),
    /** Antal anmeldelser pr. hele stjerne, 1-5. Bruges til fordelings-grafen. */
    distribution: z.record(z.string(), z.number().int().nonnegative()),
  })
  .meta({ id: 'RatingSummary' });

export type RatingSummary = z.infer<typeof ratingSummarySchema>;

export const beverageSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    name: z.string(),
    description: z.string().nullable(),
    countryCode: z.string().nullable(),
    /** Årgang/batch-år, relevant for vin og whisky. */
    vintage: z.number().int().nullable(),
    active: z.boolean(),
    typeId: idSchema,
    type: beverageTypeSchema
      .pick({ id: true, slug: true, name: true, categoryId: true })
      .optional(),
    category: categorySchema.pick({ id: true, slug: true, name: true, icon: true }).optional(),
    brandId: idSchema,
    brand: brandSchema.pick({ id: true, slug: true, name: true }).optional(),
    media: mediaAssetSchema.nullable(),
    rating: ratingSummarySchema,
    attributes: z.array(beverageAttributeSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Beverage' });

export type Beverage = z.infer<typeof beverageSchema>;

/** Slank udgave til lister og kort — undgår at hente attributter for 100 rækker. */
export const beverageSummarySchema = beverageSchema
  .pick({
    id: true,
    slug: true,
    name: true,
    countryCode: true,
    vintage: true,
    active: true,
    typeId: true,
    brandId: true,
    media: true,
    rating: true,
    createdAt: true,
  })
  .extend({
    brandName: z.string(),
    typeName: z.string(),
    categoryName: z.string(),
    categorySlug: slugSchema,
    /** Kun attributter markeret `highlighted` — det der vises på kortet. */
    highlights: z.array(beverageAttributeSchema),
  })
  .meta({ id: 'BeverageSummary' });

export type BeverageSummary = z.infer<typeof beverageSummarySchema>;

export const createBeverageSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema.optional(),
    description: z.string().trim().max(4_000).optional(),
    typeId: idSchema,
    brandId: idSchema,
    countryCode: countryCodeSchema.optional(),
    vintage: z.number().int().min(1_500).max(2_200).optional(),
    active: z.boolean().optional(),
    media: mediaAssetInputSchema.nullish(),
    attributes: z.array(beverageAttributeInputSchema).max(100).optional(),
  })
  .meta({ id: 'CreateBeverage' });

export type CreateBeverageInput = z.infer<typeof createBeverageSchema>;

export const updateBeverageSchema = createBeverageSchema.partial().meta({ id: 'UpdateBeverage' });
export type UpdateBeverageInput = z.infer<typeof updateBeverageSchema>;

/**
 * Filtrering sker i databasen, ikke i browseren. 1.0 hentede alle drikkevarer
 * og filtrerede i en `useMemo` — det skalerer ikke ud over et par hundrede rækker.
 */
export const beverageListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['name', 'createdAt', 'rating', 'reviewCount']).default('createdAt'),
  categoryId: idSchema.optional(),
  categorySlug: slugSchema.optional(),
  typeId: idSchema.optional(),
  typeIds: csvQuery(idSchema),
  brandId: idSchema.optional(),
  brandIds: csvQuery(idSchema),
  countryCodes: csvQuery(z.string().length(2)),
  minRating: optionalFloat({ min: 0, max: 5 }),
  /** Uden dette viser listen kun aktive drikkevarer. */
  active: optionalBoolean(),
  /**
   * Tager både aktive og skjulte med. Admin har brug for det; det offentlige
   * katalog sætter det aldrig, så skjulte drikkevarer aldrig slipper ud ved et uheld.
   */
  includeInactive: optionalBoolean(),
  /**
   * Attributfiltre sendes som `attr[alcohol_percent]=4.5-6.0` eller `attr[color]=dark`.
   * Parses af `parseAttributeFilters`.
   */
  attr: z.record(z.string(), z.string()).optional(),
});

export type BeverageListQuery = z.infer<typeof beverageListQuerySchema>;

export type AttributeFilter =
  | { key: string; kind: 'range'; min?: number; max?: number }
  | { key: string; kind: 'values'; values: string[] }
  | { key: string; kind: 'boolean'; value: boolean };

/** `"4.5-6.0"` → range, `"a|b"` → values, `"true"` → boolean. */
export function parseAttributeFilters(raw: Record<string, string> | undefined): AttributeFilter[] {
  if (!raw) return [];
  const filters: AttributeFilter[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue;
    if (value === 'true' || value === 'false') {
      filters.push({ key, kind: 'boolean', value: value === 'true' });
      continue;
    }
    const rangeMatch = /^(-?\d+(?:\.\d+)?)?\.\.(-?\d+(?:\.\d+)?)?$/.exec(value);
    if (rangeMatch) {
      const [, min, max] = rangeMatch;
      if (min === undefined && max === undefined) continue;
      filters.push({
        key,
        kind: 'range',
        min: min === undefined ? undefined : Number(min),
        max: max === undefined ? undefined : Number(max),
      });
      continue;
    }
    filters.push({ key, kind: 'values', values: value.split('|').filter(Boolean) });
  }
  return filters;
}

/** Facetter til filtersidebaren — hvilke værdier findes faktisk i resultatsættet. */
export const facetBucketSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
});

export const beverageFacetsSchema = z
  .object({
    categories: z.array(facetBucketSchema),
    types: z.array(facetBucketSchema),
    brands: z.array(facetBucketSchema),
    countries: z.array(facetBucketSchema),
  })
  .meta({ id: 'BeverageFacets' });

export type BeverageFacets = z.infer<typeof beverageFacetsSchema>;
