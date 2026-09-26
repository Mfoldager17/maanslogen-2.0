import { Module } from '@nestjs/common';
import { QuestionModule } from '../questions/question.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { TasteProfileService } from './taste-profile.service';

@Module({
  imports: [QuestionModule],
  controllers: [ReviewController],
  providers: [ReviewService, TasteProfileService],
  exports: [ReviewService, TasteProfileService],
})
export class ReviewModule {}
