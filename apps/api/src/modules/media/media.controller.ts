import { Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  presignRequestSchema,
  presignResponseSchema,
  type PresignRequest,
} from '@maanslogen/contracts';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { MediaService } from './media.service';

@ApiTags('Medier')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  @MinRole('USER')
  @ApiOperation({
    summary: 'Få presigned upload-URL’er',
    description:
      'Bucket og nøgle bestemmes af backenden. Klienten uploader hver variant med PUT og sender bagefter nøglerne med, når entiteten gemmes.',
  })
  @ApiZodBody(presignRequestSchema)
  @ApiZodResponse(HttpStatus.CREATED, presignResponseSchema, 'Upload-URL’er udstedt')
  @ApiProblemResponses(401, 422)
  presign(@ZodBody(presignRequestSchema) body: PresignRequest) {
    return this.media.presign(body);
  }
}
