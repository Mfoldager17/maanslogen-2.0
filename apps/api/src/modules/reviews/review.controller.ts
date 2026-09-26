import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createReviewSchema,
  paginated,
  reviewFormSchema,
  reviewListQuerySchema,
  reviewSchema,
  updateReviewSchema,
  type AccessTokenClaims,
  type CreateReviewInput,
  type ReviewListQuery,
  type UpdateReviewInput,
} from '@maanslogen/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { ReviewService } from './review.service';

@ApiTags('Anmeldelser')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liste over anmeldelser' })
  @ApiZodResponse(HttpStatus.OK, paginated(reviewSchema))
  list(@ZodQuery(reviewListQuerySchema) query: ReviewListQuery) {
    return this.reviews.list(query);
  }

  @Public()
  @Get('form/:beverageIdOrSlug')
  @ApiOperation({
    summary: 'Anmeldelsesformularen for en drikkevare',
    description:
      'Returnerer de spørgsmål der gælder for drikkevarens type, og brugerens egen anmeldelse hvis der er en.',
  })
  @ApiZodResponse(HttpStatus.OK, reviewFormSchema)
  @ApiProblemResponses(404)
  form(
    @Param('beverageIdOrSlug') beverageIdOrSlug: string,
    @CurrentUser() user: AccessTokenClaims | undefined,
  ) {
    return this.reviews.form(beverageIdOrSlug, user?.sub);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Hent én anmeldelse' })
  @ApiZodResponse(HttpStatus.OK, reviewSchema)
  @ApiProblemResponses(404)
  get(@Param('id') id: string) {
    return this.reviews.get(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Skriv en anmeldelse — én pr. bruger pr. drikkevare' })
  @ApiZodBody(createReviewSchema)
  @ApiZodResponse(HttpStatus.CREATED, reviewSchema)
  @ApiProblemResponses(401, 404, 409, 422)
  create(
    @CurrentUser('sub') userId: string,
    @ZodBody(createReviewSchema) body: CreateReviewInput,
  ) {
    return this.reviews.create(userId, body);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redigér en anmeldelse — din egen, eller enhver som MODERATOR' })
  @ApiZodBody(updateReviewSchema)
  @ApiZodResponse(HttpStatus.OK, reviewSchema)
  @ApiProblemResponses(401, 403, 404, 422)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @ZodBody(updateReviewSchema) body: UpdateReviewInput,
  ) {
    return this.reviews.update(id, { userId: user.sub, role: user.role }, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Slet en anmeldelse' })
  @ApiProblemResponses(401, 403, 404)
  remove(@Param('id') id: string, @CurrentUser() user: AccessTokenClaims): Promise<void> {
    return this.reviews.remove(id, { userId: user.sub, role: user.role });
  }
}
