import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  createQuestionSchema,
  paginated,
  questionListQuerySchema,
  questionSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type QuestionListQuery,
  type UpdateQuestionInput,
} from '@maanslogen/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { QuestionService } from './question.service';

@ApiTags('Spørgsmål')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over anmeldelsesspørgsmål' })
  @ApiZodResponse(HttpStatus.OK, paginated(questionSchema))
  list(@ZodQuery(questionListQuerySchema) query: QuestionListQuery) {
    return this.questions.list(query);
  }

  @Public()
  @Get('for-type/:typeId')
  @ApiOperation({ summary: 'De spørgsmål der stilles når man anmelder denne type' })
  @ApiZodResponse(HttpStatus.OK, z.array(questionSchema))
  @ApiProblemResponses(404)
  forType(@Param('typeId') typeId: string) {
    return this.questions.forType(typeId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Hent ét spørgsmål' })
  @ApiZodResponse(HttpStatus.OK, questionSchema)
  @ApiProblemResponses(404)
  get(@Param('id') id: string) {
    return this.questions.get(id);
  }

  @Post()
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opret et spørgsmål' })
  @ApiZodBody(createQuestionSchema)
  @ApiZodResponse(HttpStatus.CREATED, questionSchema)
  @ApiProblemResponses(401, 403, 422)
  create(@ZodBody(createQuestionSchema) body: CreateQuestionInput) {
    return this.questions.create(body);
  }

  @Patch(':id')
  @MinRole('MODERATOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opdatér et spørgsmål' })
  @ApiZodBody(updateQuestionSchema)
  @ApiZodResponse(HttpStatus.OK, questionSchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(@Param('id') id: string, @ZodBody(updateQuestionSchema) body: UpdateQuestionInput) {
    return this.questions.update(id, body);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Fjern et spørgsmål',
    description: 'Spørgsmål med besvarelser arkiveres i stedet for at blive slettet.',
  })
  @ApiProblemResponses(401, 403, 404)
  remove(@Param('id') id: string): Promise<void> {
    return this.questions.remove(id);
  }
}
