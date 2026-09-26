import type { MediaAsset, MediaRendition, MediaVariant } from '@maanslogen/contracts';

export interface MediaRenditionRow {
  variant: MediaVariant;
  storageKey: string;
  width: number;
  height: number;
  bytes: number | null;
}

export interface MediaAssetRow {
  id: string;
  ownerType: 'BEVERAGE' | 'BRAND' | 'CATEGORY' | 'USER';
  alt: string | null;
  blurhash: string | null;
  createdAt: Date;
  renditions: MediaRenditionRow[];
}

/**
 * Sættes én gang ved opstart af StorageService. Mapperen er en ren funktion,
 * så den kan bruges i tests uden at rejse hele Nest-containeren.
 */
let publicBaseUrl = '';

export function setMediaPublicBaseUrl(url: string): void {
  publicBaseUrl = url.replace(/\/+$/, '');
}

export function publicUrlFor(storageKey: string): string {
  return `${publicBaseUrl}/${storageKey.replace(/^\/+/, '')}`;
}

export function toMediaAssetDto(row: MediaAssetRow): MediaAsset {
  const renditions: MediaRendition[] = row.renditions
    .map((rendition) => ({
      variant: rendition.variant,
      url: publicUrlFor(rendition.storageKey),
      width: rendition.width,
      height: rendition.height,
      bytes: rendition.bytes,
    }))
    .sort((a, b) => a.width - b.width);

  return {
    id: row.id,
    ownerType: row.ownerType,
    alt: row.alt,
    blurhash: row.blurhash,
    renditions,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMediaAssetDtoOrNull(row: MediaAssetRow | null | undefined): MediaAsset | null {
  return row ? toMediaAssetDto(row) : null;
}
