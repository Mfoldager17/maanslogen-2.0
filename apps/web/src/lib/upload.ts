'use client';

import {
  MEDIA_OWNER_VARIANTS,
  MEDIA_VARIANT_SIZES,
  type MediaAssetInput,
  type MediaOwnerType,
  type MediaVariant,
} from '@maanslogen/contracts';
import { api } from '@/lib/api/api.browser';

/**
 * Skalerer i browseren og uploader direkte til objektlageret (R2) med de
 * presignede URL'er API'et udsteder. Filerne rører aldrig vores egen server,
 * så en 8 MB upload hverken bruger API-båndbredde eller hukommelse der.
 */
export async function uploadImage(
  file: File,
  ownerType: MediaOwnerType,
  alt?: string,
): Promise<MediaAssetInput> {
  const variants = MEDIA_OWNER_VARIANTS[ownerType];
  const contentType = 'image/webp';

  const presigned = await api.media.presign({
    ownerType,
    variants: [...variants],
    contentType,
  });

  const renditions = await Promise.all(
    presigned.uploads.map(async (upload) => {
      const blob = await resize(file, upload.width, upload.height, contentType);

      // Headerne kommer fra API'et, fordi de indgår i signaturen — og fordi
      // det er dér `Cache-Control` sættes, som afgør om Cloudflare må cache
      // filen i stedet for at spørge R2 hver gang.
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: upload.headers,
      });
      if (!response.ok) {
        throw new Error(`Upload af ${upload.variant} fejlede (${response.status})`);
      }

      return {
        variant: upload.variant as MediaVariant,
        storageKey: upload.storageKey,
        width: upload.width,
        height: upload.height,
        bytes: blob.size,
      };
    }),
  );

  return { alt: alt?.trim() || undefined, renditions };
}

/**
 * Skalerer med "cover"-beskæring til den ønskede ramme. Bevidst ikke
 * `object-fit` i CSS: der skal ikke sendes et 4000 px-billede ud til
 * en 200 px-thumbnail.
 */
async function resize(file: File, width: number, height: number, type: string): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Kunne ikke behandle billedet i browseren');

  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;

  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Kunne ikke kode billedet'))),
      type,
      0.86,
    );
  });
}

export { MEDIA_VARIANT_SIZES };
