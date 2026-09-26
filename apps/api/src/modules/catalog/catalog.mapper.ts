import type { Brand, BeverageType, Category } from '@maanslogen/contracts';
import { toMediaAssetDtoOrNull, type MediaAssetRow } from '../media/media.mapper';

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  accentColor: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  media?: MediaAssetRow | null;
  beverageCount?: number;
}

export function toCategoryDto(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    accentColor: row.accentColor,
    sortOrder: row.sortOrder,
    active: row.active,
    media: toMediaAssetDtoOrNull(row.media),
    beverageCount: row.beverageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface BeverageTypeRow {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; slug: string; name: string; icon: string | null } | null;
  _count?: { beverages: number };
}

export function toBeverageTypeDto(row: BeverageTypeRow): BeverageType {
  return {
    id: row.id,
    slug: row.slug,
    categoryId: row.categoryId,
    category: row.category
      ? {
          id: row.category.id,
          slug: row.category.slug,
          name: row.category.name,
          icon: row.category.icon,
        }
      : undefined,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    active: row.active,
    beverageCount: row._count?.beverages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  countryCode: string | null;
  websiteUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  media?: MediaAssetRow | null;
  categories?: { id: string }[];
  _count?: { beverages: number };
}

export function toBrandDto(row: BrandRow): Brand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    countryCode: row.countryCode,
    websiteUrl: row.websiteUrl,
    active: row.active,
    media: toMediaAssetDtoOrNull(row.media),
    categoryIds: row.categories?.map((category) => category.id) ?? [],
    beverageCount: row._count?.beverages,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
