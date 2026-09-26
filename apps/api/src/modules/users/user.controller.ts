import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createUserSchema,
  paginated,
  updateProfileSchema,
  updateUserSchema,
  userListQuerySchema,
  userSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListQuery,
} from '@maanslogen/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MinRole } from '../../common/decorators/roles.decorator';
import { ZodBody, ZodQuery } from '../../common/http/zod.pipe';
import { ApiProblemResponses, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi';
import { UserService } from './user.service';

@ApiTags('Brugere')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Opdatér din egen profil' })
  @ApiZodBody(updateProfileSchema)
  @ApiZodResponse(HttpStatus.OK, userSchema)
  @ApiProblemResponses(401, 422)
  updateProfile(
    @CurrentUser('sub') userId: string,
    @ZodBody(updateProfileSchema) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.users.updateProfile(userId, body);
  }

  @Get()
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Liste over brugere' })
  @ApiZodResponse(HttpStatus.OK, paginated(userSchema))
  @ApiProblemResponses(401, 403)
  list(@ZodQuery(userListQuerySchema) query: UserListQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Hent én bruger' })
  @ApiZodResponse(HttpStatus.OK, userSchema)
  @ApiProblemResponses(401, 403, 404)
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Opret en bruger' })
  @ApiZodBody(createUserSchema)
  @ApiZodResponse(HttpStatus.CREATED, userSchema)
  @ApiProblemResponses(401, 403, 409, 422)
  create(@ZodBody(createUserSchema) body: CreateUserInput) {
    return this.users.create(body);
  }

  @Patch(':id')
  @MinRole('ADMIN')
  @ApiOperation({ summary: 'Opdatér rolle, e-mail eller status' })
  @ApiZodBody(updateUserSchema)
  @ApiZodResponse(HttpStatus.OK, userSchema)
  @ApiProblemResponses(400, 401, 403, 404, 409, 422)
  update(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
    @ZodBody(updateUserSchema) body: UpdateUserInput,
  ) {
    return this.users.update(id, body, actorId);
  }

  @Delete(':id')
  @MinRole('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deaktivér en bruger' })
  @ApiProblemResponses(400, 401, 403, 404)
  remove(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.users.remove(id, actorId);
  }
}
