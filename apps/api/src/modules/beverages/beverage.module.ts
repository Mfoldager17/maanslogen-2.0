import { Module } from '@nestjs/common';
import { AttributeModule } from '../attributes/attribute.module';
import { BeverageController } from './beverage.controller';
import { BeverageService } from './beverage.service';

@Module({
  imports: [AttributeModule],
  controllers: [BeverageController],
  providers: [BeverageService],
  exports: [BeverageService],
})
export class BeverageModule {}
