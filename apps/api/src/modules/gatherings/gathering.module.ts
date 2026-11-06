import { Module } from '@nestjs/common';
import { ReviewModule } from '../reviews/review.module';
import { GatheringController } from './gathering.controller';
import { GatheringService } from './gathering.service';

/**
 * `ReviewModule` for at kunne gøre aftenens noter til anmeldelser ved
 * udgivelsen. Afhængigheden går kun denne vej — anmeldelser ved ingenting om
 * arrangementer — så der er ingen ring at bryde.
 */
@Module({
  imports: [ReviewModule],
  controllers: [GatheringController],
  providers: [GatheringService],
  exports: [GatheringService],
})
export class GatheringModule {}
