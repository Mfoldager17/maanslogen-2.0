import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addGatheringItemSchema,
  createGatheringSchema,
  gatheringDetailSchema,
  gatheringListQuerySchema,
  gatheringSchema,
  inviteAttendeeSchema,
  paginated,
  updateGatheringItemSchema,
  updateGatheringSchema,
  upsertGatheringNoteSchema,
  type AccessTokenClaims,
  type AddGatheringItemInput,
  type CreateGatheringInput,
  type GatheringListQuery,
  type InviteAttendeeInput,
  type UpdateGatheringInput,
  type UpdateGatheringItemInput,
  type UpsertGatheringNoteInput,
} from '@maanslogen/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { GatheringService } from './gathering.service';

/**
 * Ingen rute her er `@Public()`. Arrangementer er logens eget rum: admin og de
 * inviterede, og ingen andre. Et arrangement man ikke er inviteret til svarer
 * 404 frem for 403 — se GatheringService.
 */
@ApiTags('Arrangementer')
@ApiBearerAuth()
@Controller('gatherings')
export class GatheringController {
  constructor(private readonly gatherings: GatheringService) {}

  @Get()
  @ApiOperation({
    summary: 'Arrangementer du har adgang til',
    description: 'Admin ser alle. Alle andre ser kun dem de er inviteret til.',
  })
  @ApiZodResponse(HttpStatus.OK, paginated(gatheringSchema))
  list(
    @ZodQuery(gatheringListQuerySchema) query: GatheringListQuery,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.list(query, viewer);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Ét arrangement med ting, deltagere og noter' })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(404)
  detail(@Param('idOrSlug') idOrSlug: string, @CurrentUser() viewer: AccessTokenClaims) {
    return this.gatherings.detail(idOrSlug, viewer);
  }

  @Post()
  @MinRole('ADMIN')
  @ApiOperation({
    summary: 'Opret arrangement',
    description: 'Værten bliver automatisk deltager — ellers kunne vedkommende ikke skrive noter.',
  })
  @ApiZodBody(createGatheringSchema)
  @ApiZodResponse(HttpStatus.CREATED, gatheringDetailSchema)
  @ApiProblemResponses(403)
  create(
    @ZodBody(createGatheringSchema) input: CreateGatheringInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.create(input, viewer);
  }

  @Patch(':idOrSlug')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Ret arrangementet, herunder opslagets tekst' })
  @ApiZodBody(updateGatheringSchema)
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  update(
    @Param('idOrSlug') idOrSlug: string,
    @ZodBody(updateGatheringSchema) input: UpdateGatheringInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.update(idOrSlug, input, viewer);
  }

  @Delete(':idOrSlug')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Slet arrangementet med alt hvad der hører til' })
  @ApiProblemResponses(403, 404)
  async remove(@Param('idOrSlug') idOrSlug: string, @CurrentUser() viewer: AccessTokenClaims) {
    await this.gatherings.remove(idOrSlug, viewer);
  }

  @Post(':idOrSlug/publish')
  @MinRole('ADMIN')
  @ApiOperation({
    summary: 'Udgiv opslaget til deltagerne',
    description: 'Låser samtidig noterne. Uden det kunne aftenen skrives om bagefter.',
  })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  publish(@Param('idOrSlug') idOrSlug: string, @CurrentUser() viewer: AccessTokenClaims) {
    return this.gatherings.publish(idOrSlug, viewer);
  }

  @Post(':idOrSlug/unpublish')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Lås op igen, så noter og tekst kan rettes' })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  unpublish(@Param('idOrSlug') idOrSlug: string, @CurrentUser() viewer: AccessTokenClaims) {
    return this.gatherings.unpublish(idOrSlug, viewer);
  }

  // ---- Deltagere ----------------------------------------------------------

  @Post(':idOrSlug/attendees')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Inviter en bruger' })
  @ApiZodBody(inviteAttendeeSchema)
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  invite(
    @Param('idOrSlug') idOrSlug: string,
    @ZodBody(inviteAttendeeSchema) input: InviteAttendeeInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.invite(idOrSlug, input, viewer);
  }

  @Delete(':idOrSlug/attendees/:attendeeId')
  @MinRole('ADMIN')
  @ApiOperation({
    summary: 'Fjern en deltager',
    description:
      'Afvises hvis deltageren har skrevet noter — historikken slettes ikke ved et uheld.',
  })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404, 409)
  uninvite(
    @Param('idOrSlug') idOrSlug: string,
    @Param('attendeeId') attendeeId: string,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.uninvite(idOrSlug, attendeeId, viewer);
  }

  // ---- Ting på listen -----------------------------------------------------

  @Post(':idOrSlug/items')
  @ApiOperation({
    summary: 'Tilføj noget der blev drukket',
    description:
      'Ved en smagning kun værten. Ved de øvrige enhver deltager, mens arrangementet er i gang. Enten en drikkevare fra kataloget eller bare et navn.',
  })
  @ApiZodBody(addGatheringItemSchema)
  @ApiZodResponse(HttpStatus.CREATED, gatheringDetailSchema)
  @ApiProblemResponses(403, 404, 422)
  addItem(
    @Param('idOrSlug') idOrSlug: string,
    @ZodBody(addGatheringItemSchema) input: AddGatheringItemInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.addItem(idOrSlug, input, viewer);
  }

  @Patch(':idOrSlug/items/:itemId')
  @MinRole('ADMIN')
  @ApiOperation({
    summary: 'Ret en post',
    description: 'Blandt andet til at knytte en post skrevet i farten til kataloget bagefter.',
  })
  @ApiZodBody(updateGatheringItemSchema)
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404, 422)
  updateItem(
    @Param('idOrSlug') idOrSlug: string,
    @Param('itemId') itemId: string,
    @ZodBody(updateGatheringItemSchema) input: UpdateGatheringItemInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.updateItem(idOrSlug, itemId, input, viewer);
  }

  @Delete(':idOrSlug/items/:itemId')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Fjern en post og dens noter' })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  removeItem(
    @Param('idOrSlug') idOrSlug: string,
    @Param('itemId') itemId: string,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.removeItem(idOrSlug, itemId, viewer);
  }

  @Post(':idOrSlug/items/:itemId/serve')
  @MinRole('ADMIN')
  @ApiOperation({
    summary: 'Skænk posten nu',
    description:
      'Sætter tidspunktet og starter arrangementet. Tidspunkterne bliver opslagets tidslinje.',
  })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404)
  serveItem(
    @Param('idOrSlug') idOrSlug: string,
    @Param('itemId') itemId: string,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.serveItem(idOrSlug, itemId, viewer);
  }

  // ---- Noter --------------------------------------------------------------

  @Put(':idOrSlug/items/:itemId/note')
  @ApiOperation({
    summary: 'Skriv eller ret din egen note',
    description: 'Kun din egen. Ingen skriver noter på andres vegne, og udgivelse låser dem.',
  })
  @ApiZodBody(upsertGatheringNoteSchema)
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404, 409)
  upsertNote(
    @Param('idOrSlug') idOrSlug: string,
    @Param('itemId') itemId: string,
    @ZodBody(upsertGatheringNoteSchema) input: UpsertGatheringNoteInput,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.upsertNote(idOrSlug, itemId, input, viewer);
  }

  @Delete(':idOrSlug/items/:itemId/note')
  @ApiOperation({ summary: 'Slet din egen note' })
  @ApiZodResponse(HttpStatus.OK, gatheringDetailSchema)
  @ApiProblemResponses(403, 404, 409)
  removeNote(
    @Param('idOrSlug') idOrSlug: string,
    @Param('itemId') itemId: string,
    @CurrentUser() viewer: AccessTokenClaims,
  ) {
    return this.gatherings.removeNote(idOrSlug, itemId, viewer);
  }
}
