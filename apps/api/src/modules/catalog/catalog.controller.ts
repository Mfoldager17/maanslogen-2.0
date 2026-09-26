import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  brandListQuerySchema,
  brandSchema,
  beverageTypeListQuerySchema,
  beverageTypeSchema,
  categoryListQuerySchema,
  categorySchema,
  createBrandSchema,
  createBeverageTypeSchema,
  createCategorySchema,
  paginated,
  updateBrandSchema,
  updateBeverageTypeSchema,
  updateCategorySchema,
  type BrandListQuery,
  type BeverageTypeListQuery,
  type CategoryListQuery,
  type CreateBrandInput,
  type CreateBeverageTypeInput,
  type CreateCategoryInput,
  type UpdateBrandInput,
  type UpdateBeverageTypeInput,
  type UpdateCategoryInput,
} from '@maanslogen/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { BeverageTypeService } from './beverage-type.service';
import { BrandService } from './brand.service';
import { CategoryService } from './category.service';

/**
 * Ét sæt endpoints pr. ressource. Læsning er offentlig, skrivning kræver MODERATOR.
 * 1.0 havde parallelle `admin/` og `web/` controllere med hver sit DTO-sæt for
 * de samme data — dobbelt så meget kode og to steder at glemme en ændring.
 */
@ApiTags('Katalog · Kategorier')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over kategorier' })
  @ApiZodResponse(HttpStatus.OK, paginated(categorySchema))
  list(@ZodQuery(categoryListQuerySchema) query: CategoryListQuery) {
    return this.categories.list(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Hent én kategori via id eller slug' })
  @ApiParam({ name: 'idOrSlug', example: 'oel' })
  @ApiZodResponse(HttpStatus.OK, categorySchema)
  @ApiProblemResponses(404)
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.categories.getByIdOrSlug(idOrSlug);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret en kategori' })
  @ApiZodBody(createCategorySchema)
  @ApiZodResponse(HttpStatus.CREATED, categorySchema)
  @ApiProblemResponses(401, 403, 422)
  create(@ZodBody(createCategorySchema) body: CreateCategoryInput) {
    return this.categories.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opdatér en kategori' })
  @ApiZodBody(updateCategorySchema)
  @ApiZodResponse(HttpStatus.OK, categorySchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(@Param('id') id: string, @ZodBody(updateCategorySchema) body: UpdateCategoryInput) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arkivér en kategori (blød sletning)' })
  @ApiProblemResponses(401, 403, 404, 409)
  remove(@Param('id') id: string): Promise<void> {
    return this.categories.remove(id);
  }
}

@ApiTags('Katalog · Typer')
@Controller('types')
export class BeverageTypeController {
  constructor(private readonly types: BeverageTypeService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over typer' })
  @ApiZodResponse(HttpStatus.OK, paginated(beverageTypeSchema))
  list(@ZodQuery(beverageTypeListQuerySchema) query: BeverageTypeListQuery) {
    return this.types.list(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Hent én type via id eller slug' })
  @ApiZodResponse(HttpStatus.OK, beverageTypeSchema)
  @ApiProblemResponses(404)
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.types.getByIdOrSlug(idOrSlug);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret en type' })
  @ApiZodBody(createBeverageTypeSchema)
  @ApiZodResponse(HttpStatus.CREATED, beverageTypeSchema)
  @ApiProblemResponses(401, 403, 409, 422)
  create(@ZodBody(createBeverageTypeSchema) body: CreateBeverageTypeInput) {
    return this.types.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opdatér en type' })
  @ApiZodBody(updateBeverageTypeSchema)
  @ApiZodResponse(HttpStatus.OK, beverageTypeSchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(
    @Param('id') id: string,
    @ZodBody(updateBeverageTypeSchema) body: UpdateBeverageTypeInput,
  ) {
    return this.types.update(id, body);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arkivér en type' })
  @ApiProblemResponses(401, 403, 404, 409)
  remove(@Param('id') id: string): Promise<void> {
    return this.types.remove(id);
  }
}

@ApiTags('Katalog · Mærker')
@Controller('brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over mærker' })
  @ApiZodResponse(HttpStatus.OK, paginated(brandSchema))
  list(@ZodQuery(brandListQuerySchema) query: BrandListQuery) {
    return this.brands.list(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Hent ét mærke via id eller slug' })
  @ApiZodResponse(HttpStatus.OK, brandSchema)
  @ApiProblemResponses(404)
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.brands.getByIdOrSlug(idOrSlug);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret et mærke' })
  @ApiZodBody(createBrandSchema)
  @ApiZodResponse(HttpStatus.CREATED, brandSchema)
  @ApiProblemResponses(401, 403, 422)
  create(@ZodBody(createBrandSchema) body: CreateBrandInput) {
    return this.brands.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opdatér et mærke' })
  @ApiZodBody(updateBrandSchema)
  @ApiZodResponse(HttpStatus.OK, brandSchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(@Param('id') id: string, @ZodBody(updateBrandSchema) body: UpdateBrandInput) {
    return this.brands.update(id, body);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arkivér et mærke' })
  @ApiProblemResponses(401, 403, 404, 409)
  remove(@Param('id') id: string): Promise<void> {
    return this.brands.remove(id);
  }
}
