import type { Beverage, BeverageSummary, RatingSummary } from '@maanslogen/contracts';
import { toMediaAssetDtoOrNull, type MediaAssetRow } from '../media/media.mapper';
import { toBeverageAttributeDto, type AttributeValueRow } from '../attributes/attribute.mapper';

export interface BeverageRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  countryCode: string | null;
  vintage: number | null;
  active: boolean;
  typeId: string;
  brandId: string;
  ratingAverage: number;
  ratingCount: number;
  ratingBuckets: unknown;
  createdAt: Date;
  updatedAt: Date;
  media?: MediaAssetRow | null;
  type?: {
    id: string;
    slug: string;
    name: string;
    categoryId: string;
    category?: { id: string; slug: string; name: string; icon: string | null };
  } | null;
  brand?: { id: string; slug: string; name: string } | null;
  attributeValues?: AttributeValueRow[];
}

const EMPTY_BUCKETS = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

export function toRatingSummary(row: Pick<BeverageRow, 'ratingAverage' | 'ratingCount' | 'ratingBuckets'>): RatingSummary {
  const buckets =
    row.ratingBuckets && typeof row.ratingBuckets === 'object' && !Array.isArray(row.ratingBuckets)
      ? (row.ratingBuckets as Record<string, number>)
      : {};
  return {
    average: Number(row.ratingAverage.toFixed(2)),
    count: row.ratingCount,
    distribution: { ...EMPTY_BUCKETS, ...buckets },
  };
}

export function toBeverageDto(row: BeverageRow): Beverage {
  const attributes = (row.attributeValues ?? [])
    .map(toBeverageAttributeDto)
    .filter((attribute): attribute is NonNullable<typeof attribute> => attribute !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName, 'da'));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    countryCode: row.countryCode,
    vintage: row.vintage,
    active: row.active,
    typeId: row.typeId,
    type: row.type
      ? { id: row.type.id, slug: row.type.slug, name: row.type.name, categoryId: row.type.categoryId }
      : undefined,
    category: row.type?.category
      ? {
          id: row.type.category.id,
          slug: row.type.category.slug,
          name: row.type.category.name,
          icon: row.type.category.icon,
        }
      : undefined,
    brandId: row.brandId,
    brand: row.brand ? { id: row.brand.id, slug: row.brand.slug, name: row.brand.name } : undefined,
    media: toMediaAssetDtoOrNull(row.media),
    rating: toRatingSummary(row),
    attributes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Listevisningen henter kun de fremhævede attributter. At hente alle for 24 rækker
 * er den slags som gør et katalog langsomt uden at nogen kan se hvorfor.
 */
export function toBeverageSummaryDto(row: BeverageRow): BeverageSummary {
  const highlights = (row.attributeValues ?? [])
    .map(toBeverageAttributeDto)
    .filter((attribute): attribute is NonNullable<typeof attribute> => attribute !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryCode: row.countryCode,
    vintage: row.vintage,
    active: row.active,
    typeId: row.typeId,
    brandId: row.brandId,
    media: toMediaAssetDtoOrNull(row.media),
    rating: toRatingSummary(row),
    createdAt: row.createdAt.toISOString(),
    brandName: row.brand?.name ?? '',
    typeName: row.type?.name ?? '',
    categoryName: row.type?.category?.name ?? '',
    categorySlug: row.type?.category?.slug ?? '',
    highlights,
  };
}
