import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CONFIG, type AppConfig } from '../../config/env';
import { publicUrlFor, setMediaPublicBaseUrl } from './media.mapper';

export interface PresignedPut {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  expiresAt: Date;
}

/**
 * Objektlager bag ét interface. Produktionen kører på Cloudflare R2 (ingen
 * egress-omkostninger, indbygget CDN); lokalt kører MinIO på samme S3-API.
 *
 * Til forskel fra 1.0 kan denne service ikke oprette eller slette buckets.
 * Den forrige udgave havde et cron-job der listede alle buckets og slettede
 * de tomme — med ét hårdkodet navn som eneste beskyttelse.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    if (config.STORAGE_DRIVER === 'r2') {
      this.bucket = config.R2_BUCKET as string;
      this.publicBaseUrl = (config.R2_PUBLIC_BASE_URL as string).replace(/\/+$/, '');
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.R2_ACCOUNT_ID as string}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.R2_ACCESS_KEY_ID as string,
          secretAccessKey: config.R2_SECRET_ACCESS_KEY as string,
        },
        forcePathStyle: true,
      });
    } else {
      this.bucket = config.S3_BUCKET as string;
      const endpoint = (config.S3_ENDPOINT as string).replace(/\/+$/, '');
      this.publicBaseUrl = (config.S3_PUBLIC_BASE_URL ?? `${endpoint}/${this.bucket}`).replace(
        /\/+$/,
        '',
      );
      this.client = new S3Client({
        region: config.S3_REGION,
        endpoint,
        credentials: {
          accessKeyId: config.S3_ACCESS_KEY_ID as string,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY as string,
        },
        forcePathStyle: true,
      });
    }
  }

  onModuleInit(): void {
    setMediaPublicBaseUrl(this.publicBaseUrl);
    this.logger.log(
      `Objektlager: ${this.config.STORAGE_DRIVER} · bucket "${this.bucket}" · offentlig base ${this.publicBaseUrl}`,
    );
  }

  getPublicUrl(storageKey: string): string {
    return publicUrlFor(storageKey);
  }

  /**
   * Nøglen dannes altid i backenden. Klienten kan hverken vælge bucket eller sti,
   * så en manipuleret forespørgsel kan ikke overskrive et andet objekt.
   */
  buildKey(ownerType: string, assetId: string, variant: string, contentType: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? 'bin';
    return `${ownerType.toLowerCase()}/${year}/${month}/${assetId}/${variant.toLowerCase()}.${extension}`;
  }

  async presignPut(storageKey: string, contentType: string): Promise<PresignedPut> {
    const expiresIn = this.config.UPLOAD_URL_TTL_SECONDS;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn },
    );

    return {
      uploadUrl,
      storageKey,
      publicUrl: this.getPublicUrl(storageKey),
      expiresAt: new Date(Date.now() + expiresIn * 1_000),
    };
  }

  /**
   * Bekræfter at klienten faktisk uploadede filen, og hvor stor den blev.
   * En presigned PUT kan ikke håndhæve en maksimal størrelse, så grænsen
   * kontrolleres her, når uploadet gøres krav på.
   */
  async statObject(storageKey: string): Promise<{ bytes: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return { bytes: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch {
      return null;
    }
  }

  /** Sletter kun navngivne nøgler — aldrig præfikser eller buckets. */
  async deleteObjects(storageKeys: string[]): Promise<number> {
    if (storageKeys.length === 0) return 0;
    let deleted = 0;
    for (let index = 0; index < storageKeys.length; index += 1_000) {
      const batch = storageKeys.slice(index, index + 1_000);
      try {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        deleted += batch.length - (result.Errors?.length ?? 0);
        for (const error of result.Errors ?? []) {
          this.logger.warn(`Kunne ikke slette ${error.Key ?? '?'}: ${error.Message ?? 'ukendt'}`);
        }
      } catch (error) {
        this.logger.error({ err: error }, 'Batch-sletning i objektlageret fejlede');
      }
    }
    return deleted;
  }
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
