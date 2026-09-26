import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_VARIANT_SIZES,
  type MediaAssetInput,
  type MediaOwnerType,
  type PresignRequest,
  type PresignResponse,
} from '@maanslogen/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { CONFIG, type AppConfig } from '../../config/env';
import { StorageService } from './storage.service';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Udsteder presigned PUT-URL'er og registrerer hver nøgle som "afventende".
   * Bliver de ikke gjort krav på, fjerner oprydningsjobbet både objektet og rækken.
   */
  async presign(request: PresignRequest): Promise<PresignResponse> {
    const assetId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.PENDING_UPLOAD_TTL_MINUTES * 60_000);

    const uploads = await Promise.all(
      request.variants.map(async (variant) => {
        const storageKey = this.storage.buildKey(
          request.ownerType,
          assetId,
          variant,
          request.contentType,
        );
        const presigned = await this.storage.presignPut(storageKey, request.contentType);
        const size = MEDIA_VARIANT_SIZES[variant];
        return {
          variant,
          uploadUrl: presigned.uploadUrl,
          storageKey: presigned.storageKey,
          publicUrl: presigned.publicUrl,
          width: size.width,
          height: size.height,
        };
      }),
    );

    await this.prisma.pendingUpload.createMany({
      data: uploads.map((upload) => ({ storageKey: upload.storageKey, expiresAt })),
      skipDuplicates: true,
    });

    return {
      uploads,
      expiresAt: new Date(Date.now() + this.config.UPLOAD_URL_TTL_SECONDS * 1_000).toISOString(),
      maxBytes: MAX_UPLOAD_BYTES,
    };
  }

  /**
   * Gør et sæt uploadede nøgler til et MediaAsset. Kaldes inde i den transaktion
   * der opretter eller opdaterer ejeren, så et halvt gemt billede ikke er muligt.
   */
  async createAsset(
    tx: Prisma.TransactionClient,
    ownerType: MediaOwnerType,
    input: MediaAssetInput,
  ): Promise<string> {
    const keys = input.renditions.map((rendition) => rendition.storageKey);

    const pending = await tx.pendingUpload.findMany({ where: { storageKey: { in: keys } } });
    const known = new Set(pending.map((row) => row.storageKey));
    const unknown = keys.filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw AppError.validation(
        'En eller flere billednøgler er ukendte eller udløbne — bed om nye upload-URL’er',
        { 'media.renditions': unknown },
      );
    }

    for (const rendition of input.renditions) {
      if (rendition.bytes !== undefined && rendition.bytes > MAX_UPLOAD_BYTES) {
        throw AppError.validation(
          `Billedet er for stort (${Math.round(rendition.bytes / 1024)} kB). Maks er ${Math.round(MAX_UPLOAD_BYTES / 1024)} kB.`,
          { 'media.renditions': ['Filen overskrider den tilladte størrelse'] },
        );
      }
    }

    const asset = await tx.mediaAsset.create({
      data: {
        ownerType,
        alt: input.alt ?? null,
        blurhash: input.blurhash ?? null,
        renditions: {
          create: input.renditions.map((rendition) => ({
            variant: rendition.variant,
            storageKey: rendition.storageKey,
            width: rendition.width,
            height: rendition.height,
            bytes: rendition.bytes ?? null,
          })),
        },
      },
    });

    // Nøglerne er nu i brug og skal ikke ryddes op.
    await tx.pendingUpload.deleteMany({ where: { storageKey: { in: keys } } });

    return asset.id;
  }

  /**
   * Markerer et asset's filer til oprydning. Rækken slettes med det samme,
   * men objekterne får en udsættelse, så et utilsigtet klik kan nå at blive fortrudt
   * i en eventuel backup-proces — og så sletningen ikke blokerer svaret.
   */
  async scheduleAssetDeletion(
    tx: Prisma.TransactionClient,
    assetId: string | null | undefined,
    graceMinutes = 60 * 24,
  ): Promise<void> {
    if (!assetId) return;
    const asset = await tx.mediaAsset.findUnique({
      where: { id: assetId },
      include: { renditions: true },
    });
    if (!asset) return;

    const expiresAt = new Date(Date.now() + graceMinutes * 60_000);
    for (const rendition of asset.renditions) {
      await tx.pendingUpload.upsert({
        where: { storageKey: rendition.storageKey },
        create: { storageKey: rendition.storageKey, expiresAt },
        update: { expiresAt },
      });
    }
    await tx.mediaAsset.delete({ where: { id: assetId } });
  }

  /**
   * Sletter udløbne, ikke-indløste uploads fra objektlageret.
   * Springer nøgler over der imens er blevet knyttet til et asset.
   */
  async cleanupExpiredUploads(): Promise<{ deleted: number; skipped: number }> {
    const expired = await this.prisma.pendingUpload.findMany({
      where: { expiresAt: { lt: new Date() } },
      take: 1_000,
    });
    if (expired.length === 0) return { deleted: 0, skipped: 0 };

    const keys = expired.map((row) => row.storageKey);
    const stillInUse = await this.prisma.mediaRendition.findMany({
      where: { storageKey: { in: keys } },
      select: { storageKey: true },
    });
    const inUse = new Set(stillInUse.map((row) => row.storageKey));
    const deletable = keys.filter((key) => !inUse.has(key));

    await this.storage.deleteObjects(deletable);
    await this.prisma.pendingUpload.deleteMany({ where: { storageKey: { in: keys } } });

    if (deletable.length > 0) {
      this.logger.log(`Ryddede ${deletable.length} uafhentede uploads op`);
    }
    return { deleted: deletable.length, skipped: inUse.size };
  }
}
