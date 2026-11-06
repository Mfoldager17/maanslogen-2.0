import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IMMUTABLE_CACHE_CONTROL } from '@maanslogen/contracts';
import { CONFIG, type AppConfig } from '../../config/env';
import { publicUrlFor, setMediaPublicBaseUrl } from './media.mapper';

export interface PresignedPut {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  /** Headers klienten skal sende. De indgår i signaturen. */
  headers: Record<string, string>;
  expiresAt: Date;
}

/** Som `PresignedPut`, men uden `publicUrl`: der findes ingen offentlig URL. */
export interface PresignedPrivatePut {
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface SignedRead {
  url: string;
  expiresAt: Date;
}

/**
 * Objektlager bag ét interface. Produktionen kører på Cloudflare R2 (ingen
 * egress-omkostninger, indbygget CDN); lokalt kører Alarik på samme S3-API.
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
  /**
   * Den private bucket deler klient og nøgler med den offentlige — samme
   * konto, samme endpoint. Det er kun *bucketen* der er en anden, og det er
   * netop dér forskellen ligger: den har intet domæne foran og ingen
   * læsepolitik, så ingen kan nå den uden en signatur.
   */
  private readonly privateBucket: string;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    if (config.STORAGE_DRIVER === 'r2') {
      this.bucket = config.R2_BUCKET as string;
      this.privateBucket = config.R2_PRIVATE_BUCKET as string;
      this.publicBaseUrl = (config.R2_PUBLIC_BASE_URL as string).replace(/\/+$/, '');
      // `WHEN_REQUIRED`, ikke standardens `WHEN_SUPPORTED`: fra og med
      // @aws-sdk/client-s3 3.729 lægger SDK'et selv en CRC32-sum på enhver
      // PutObject. Ved en presignet URL bliver den beregnet på signerings-
      // tidspunktet — hvor kroppen er tom — og lagt i query-strengen som
      // `x-amz-checksum-crc32=AAAAAA==` (CRC32 af nul bytes). Browseren
      // sender bagefter de rigtige bytes, og objektlageret afviser med
      // checksum-mismatch. Målt på vores egen presign før rettelsen.
      this.client = new S3Client({
        region: 'auto',
        requestChecksumCalculation: 'WHEN_REQUIRED',
        endpoint: `https://${config.R2_ACCOUNT_ID as string}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.R2_ACCESS_KEY_ID as string,
          secretAccessKey: config.R2_SECRET_ACCESS_KEY as string,
        },
        forcePathStyle: true,
      });
    } else {
      this.bucket = config.S3_BUCKET as string;
      this.privateBucket = config.S3_PRIVATE_BUCKET as string;
      const endpoint = (config.S3_ENDPOINT as string).replace(/\/+$/, '');
      this.publicBaseUrl = (config.S3_PUBLIC_BASE_URL ?? `${endpoint}/${this.bucket}`).replace(
        /\/+$/,
        '',
      );
      this.client = new S3Client({
        region: config.S3_REGION,
        // Se noten ved R2-klienten ovenfor.
        requestChecksumCalculation: 'WHEN_REQUIRED',
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
      `Objektlager: ${this.config.STORAGE_DRIVER} · bucket "${this.bucket}" · privat bucket "${this.privateBucket}" · offentlig base ${this.publicBaseUrl}`,
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

  /**
   * Presigner en PUT og beder klienten sætte `Cache-Control` på objektet.
   *
   * Uden den header serverer objektlageret filen uden cache-instruks, og hver
   * visning bliver en læsning. Nøglerne er uforanderlige — hvert upload får sit
   * eget UUID og bliver aldrig overskrevet — så filen kan caches for evigt.
   *
   * Presignede URL'er signerer kun `host`, så headeren er ikke håndhævet.
   * Den styrer browserens cache; edge-cachen garanteres af Cache Rule'en i
   * Cloudflare (se docs/r2-omkostninger.md).
   */
  async presignPut(storageKey: string, contentType: string): Promise<PresignedPut> {
    const expiresIn = this.config.UPLOAD_URL_TTL_SECONDS;
    const headers = {
      'content-type': contentType,
      'cache-control': IMMUTABLE_CACHE_CONTROL,
    };

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      }),
      { expiresIn },
    );

    return {
      uploadUrl,
      storageKey,
      publicUrl: this.getPublicUrl(storageKey),
      headers,
      expiresAt: new Date(Date.now() + expiresIn * 1_000),
    };
  }

  /**
   * Presigner en PUT til den private bucket.
   *
   * Uden `Cache-Control`: objektet skal ikke caches nogen steder. En signeret
   * URL udløber, men en kopi i en mellemliggende cache gør ikke — og så ville
   * udløbet ikke betyde noget.
   */
  async presignPrivatePut(storageKey: string, contentType: string): Promise<PresignedPrivatePut> {
    const expiresIn = this.config.UPLOAD_URL_TTL_SECONDS;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.privateBucket,
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn },
    );

    return {
      uploadUrl,
      storageKey,
      headers: { 'content-type': contentType },
      expiresAt: new Date(Date.now() + expiresIn * 1_000),
    };
  }

  /**
   * Signerer en læsning af ét objekt i den private bucket.
   *
   * Udstedes først efter at kalderen har fået adgang — signaturen ER adgangen,
   * så den må ikke dannes for et svar modtageren ikke måtte se. Kortlivet af
   * samme grund: en delt URL skal holde op med at virke.
   */
  async presignPrivateGet(storageKey: string): Promise<SignedRead> {
    const expiresIn = this.config.PRIVATE_URL_TTL_SECONDS;

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.privateBucket, Key: storageKey }),
      { expiresIn },
    );

    return { url, expiresAt: new Date(Date.now() + expiresIn * 1_000) };
  }

  /** Som `deleteObjects`, men i den private bucket. */
  async deletePrivateObjects(storageKeys: string[]): Promise<number> {
    return this.deleteFrom(this.privateBucket, storageKeys);
  }

  /** Sletter kun navngivne nøgler — aldrig præfikser eller buckets. */
  async deleteObjects(storageKeys: string[]): Promise<number> {
    return this.deleteFrom(this.bucket, storageKeys);
  }

  private async deleteFrom(bucket: string, storageKeys: string[]): Promise<number> {
    if (storageKeys.length === 0) return 0;
    let deleted = 0;
    for (let index = 0; index < storageKeys.length; index += 1_000) {
      const batch = storageKeys.slice(index, index + 1_000);
      try {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
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
