import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

/**
 * Rydder uafhentede uploads. Til forskel fra 1.0's job rører dette aldrig
 * buckets — kun konkrete nøgler som API'et selv har udstedt.
 */
@Injectable()
class UploadJanitor {
  private readonly logger = new Logger(UploadJanitor.name);

  constructor(private readonly media: MediaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const result = await this.media.cleanupExpiredUploads();
    if (result.deleted > 0) {
      this.logger.log(`Oprydning: ${result.deleted} slettet, ${result.skipped} stadig i brug`);
    }
  }
}

@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService, StorageService, UploadJanitor],
  exports: [MediaService, StorageService],
})
export class MediaModule {}
