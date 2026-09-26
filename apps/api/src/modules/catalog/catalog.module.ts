import { Module } from '@nestjs/common';
import { BeverageTypeService } from './beverage-type.service';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';
import { BeverageTypeController, BrandController, CategoryController } from './catalog.controller';

@Module({
  controllers: [CategoryController, BeverageTypeController, BrandController],
  providers: [CategoryService, BeverageTypeService, BrandService],
  exports: [CategoryService, BeverageTypeService, BrandService],
})
export class CatalogModule {}
