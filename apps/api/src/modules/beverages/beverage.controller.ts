import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  beverageFacetsSchema,
  beverageListQuerySchema,
  beverageSchema,
  beverageSummarySchema,
  createBeverageSchema,
  paginated,
  updateBeverageSchema,
  type BeverageListQuery,
  type CreateBeverageInput,
  type UpdateBeverageInput,
} from '@maanslogen/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { BeverageService } from './beverage.service';

@ApiTags('Drikkevarer')
@Controller('beverages')
export class BeverageController {
  constructor(private readonly beverages: BeverageService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Søg og filtrér drikkevarer',
    description:
      'Filtrering, søgning og sortering sker i databasen. Dynamiske attributfiltre sendes som attr[nøgle]=værdi, fx attr[alcohol_percent]=5..9 eller attr[color]=dark|amber.',
  })
  @ApiZodResponse(HttpStatus.OK, paginated(beverageSummarySchema))
  list(@ZodQuery(beverageListQuerySchema) query: BeverageListQuery) {
    return this.beverages.list(query);
  }

  @Public()
  @Get('facets')
  @ApiOperation({ summary: 'Facettællinger for det aktuelle filter' })
  @ApiZodResponse(HttpStatus.OK, beverageFacetsSchema)
  facets(@ZodQuery(beverageListQuerySchema) query: BeverageListQuery) {
    return this.beverages.facets(query);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Hent én drikkevare med alle attributter' })
  @ApiZodResponse(HttpStatus.OK, beverageSchema)
  @ApiProblemResponses(404)
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.beverages.getByIdOrSlug(idOrSlug);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret en drikkevare med attributværdier' })
  @ApiZodBody(createBeverageSchema)
  @ApiZodResponse(HttpStatus.CREATED, beverageSchema)
  @ApiProblemResponses(401, 403, 409, 422)
  create(@ZodBody(createBeverageSchema) body: CreateBeverageInput) {
    return this.beverages.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opdatér en drikkevare' })
  @ApiZodBody(updateBeverageSchema)
  @ApiZodResponse(HttpStatus.OK, beverageSchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(@Param('id') id: string, @ZodBody(updateBeverageSchema) body: UpdateBeverageInput) {
    return this.beverages.update(id, body);
  }

  @Delete(':id')
  @MinRole('MODERATOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arkivér en drikkevare — anmeldelser bevares' })
  @ApiProblemResponses(401, 403, 404)
  remove(@Param('id') id: string): Promise<void> {
    return this.beverages.remove(id);
  }
}
