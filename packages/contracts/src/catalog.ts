import { z } from 'zod';
import { baseListQuerySchema } from './pagination';
import { mediaAssetInputSchema, mediaAssetSchema } from './media';
import {
  optionalBoolean,
  csvQuery,
  hexColorSchema,
  iconSchema,
  idSchema,
  isoDateTimeSchema,
  slugSchema,
} from './primitives';

/* ------------------------------------------------------------------ */
/* Kategori — fx Øl, Vin, Spiritus                                     */
/* ------------------------------------------------------------------ */

export const categorySchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    name: z.string(),
    description: z.string().nullable(),
    /** Emoji. I 1.0 var ikonet misbrugt som en Image-række med emoji i url-feltet. */
    icon: z.string().nullable(),
    accentColor: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
    media: mediaAssetSchema.nullable(),
    /** Antal drikkevarer i kategorien (alle typer). Udregnes af API'et. */
    beverageCount: z.number().int().nonnegative().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Category' });

export type Category = z.infer<typeof categorySchema>;

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: slugSchema.optional(),
    description: z.string().trim().max(1_000).optional(),
    icon: iconSchema.optional(),
    accentColor: hexColorSchema.optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    active: z.boolean().optional(),
    media: mediaAssetInputSchema.nullish(),
  })
  .meta({ id: 'CreateCategory' });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().meta({ id: 'UpdateCategory' });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['sortOrder', 'name', 'createdAt']).default('sortOrder'),
  active: optionalBoolean(),
});
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;

/* ------------------------------------------------------------------ */
/* Type — fx IPA under Øl                                              */
/* ------------------------------------------------------------------ */

export const beverageTypeSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    categoryId: idSchema,
    category: categorySchema.pick({ id: true, slug: true, name: true, icon: true }).optional(),
    name: z.string(),
    description: z.string().nullable(),
    sortOrder: z.number().int(),
    active: z.boolean(),
    beverageCount: z.number().int().nonnegative().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'BeverageType' });

export type BeverageType = z.infer<typeof beverageTypeSchema>;

export const createBeverageTypeSchema = z
  .object({
    categoryId: idSchema,
    name: z.string().trim().min(1).max(80),
    slug: slugSchema.optional(),
    description: z.string().trim().max(1_000).optional(),
    sortOrder: z.number().int().min(0).max(9_999).optional(),
    active: z.boolean().optional(),
  })
  .meta({ id: 'CreateBeverageType' });

export type CreateBeverageTypeInput = z.infer<typeof createBeverageTypeSchema>;

export const updateBeverageTypeSchema = createBeverageTypeSchema
  .partial()
  .meta({ id: 'UpdateBeverageType' });
export type UpdateBeverageTypeInput = z.infer<typeof updateBeverageTypeSchema>;

export const beverageTypeListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['sortOrder', 'name', 'createdAt']).default('sortOrder'),
  categoryId: idSchema.optional(),
  categorySlug: slugSchema.optional(),
  active: optionalBoolean(),
});
export type BeverageTypeListQuery = z.infer<typeof beverageTypeListQuerySchema>;

/* ------------------------------------------------------------------ */
/* Mærke — fx Mikkeller                                                */
/* ------------------------------------------------------------------ */

export const brandSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    name: z.string(),
    description: z.string().nullable(),
    /** ISO 3166-1 alpha-2, fx "DK". */
    countryCode: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    active: z.boolean(),
    media: mediaAssetSchema.nullable(),
    categoryIds: z.array(idSchema),
    beverageCount: z.number().int().nonnegative().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'Brand' });

export type Brand = z.infer<typeof brandSchema>;

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Landekode skal være to bogstaver (ISO 3166-1 alpha-2)');

export const createBrandSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2_000).optional(),
    countryCode: countryCodeSchema.optional(),
    websiteUrl: z.url().max(500).optional(),
    active: z.boolean().optional(),
    categoryIds: z.array(idSchema).max(50).optional(),
    media: mediaAssetInputSchema.nullish(),
  })
  .meta({ id: 'CreateBrand' });

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial().meta({ id: 'UpdateBrand' });
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export const brandListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['name', 'createdAt', 'beverageCount']).default('name'),
  categoryId: idSchema.optional(),
  categoryIds: csvQuery(idSchema),
  active: optionalBoolean(),
});
export type BrandListQuery = z.infer<typeof brandListQuerySchema>;
