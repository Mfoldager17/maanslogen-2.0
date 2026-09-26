import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  attributeDefinitionListQuerySchema,
  attributeDefinitionSchema,
  createAttributeDefinitionSchema,
  paginated,
  updateAttributeDefinitionSchema,
  type AttributeDefinitionListQuery,
  type CreateAttributeDefinitionInput,
  type UpdateAttributeDefinitionInput,
} from '@maanslogen/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { AttributeService } from './attribute.service';

@ApiTags('Attributter')
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributes: AttributeService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over attributdefinitioner' })
  @ApiZodResponse(HttpStatus.OK, paginated(attributeDefinitionSchema))
  list(@ZodQuery(attributeDefinitionListQuerySchema) query: AttributeDefinitionListQuery) {
    return this.attributes.list(query);
  }

  @Public()
  @Get('for-type/:typeId')
  @ApiOperation({
    summary: 'Alle attributter der gælder for en type',
    description:
      'Bruges af både drikkevare-formularen og katalogets facetfiltre, så de to aldrig er uenige om hvilke felter der findes.',
  })
  @ApiZodResponse(HttpStatus.OK, z.array(attributeDefinitionSchema))
  @ApiProblemResponses(404)
  forType(@Param('typeId') typeId: string) {
    return this.attributes.forType(typeId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Hent én attributdefinition' })
  @ApiZodResponse(HttpStatus.OK, attributeDefinitionSchema)
  @ApiProblemResponses(404)
  get(@Param('id') id: string) {
    return this.attributes.get(id);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret en attributdefinition' })
  @ApiZodBody(createAttributeDefinitionSchema)
  @ApiZodResponse(HttpStatus.CREATED, attributeDefinitionSchema)
  @ApiProblemResponses(401, 403, 409, 422)
  create(@ZodBody(createAttributeDefinitionSchema) body: CreateAttributeDefinitionInput) {
    return this.attributes.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Opdatér en attributdefinition',
    description: 'Nøglen kan ikke ændres — den binder alle gemte værdier.',
  })
  @ApiZodBody(updateAttributeDefinitionSchema)
  @ApiZodResponse(HttpStatus.OK, attributeDefinitionSchema)
  @ApiProblemResponses(401, 403, 404, 409, 422)
  update(
    @Param('id') id: string,
    @ZodBody(updateAttributeDefinitionSchema) body: UpdateAttributeDefinitionInput,
  ) {
    return this.attributes.update(id, body);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arkivér en attributdefinition' })
  @ApiProblemResponses(401, 403, 404, 409)
  remove(@Param('id') id: string): Promise<void> {
    return this.attributes.remove(id);
  }
}
