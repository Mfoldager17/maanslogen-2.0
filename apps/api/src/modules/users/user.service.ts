import { Injectable } from '@nestjs/common';
import type {
  CreateUserInput,
  Paginated,
  UpdateUserInput,
  User,
  UserListQuery,
} from '@maanslogen/contracts';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { paginate } from '../../common/pagination/cursor';
import { toUserDto, type UserRow } from './user.mapper';

const INCLUDE = {
  avatar: { include: { renditions: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.UserInclude;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQuery): Promise<Paginated<User>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.user.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toUserDto(row as UserRow),
      () => this.prisma.user.count({ where }),
    );
  }

  async get(id: string): Promise<User> {
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Bruger', id);
    return toUserDto(row);
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw AppError.conflict('E-mailen er optaget', { email: ['E-mailen er optaget'] });
    }

    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
        role: input.role ?? 'USER',
      },
      include: INCLUDE,
    });
    return toUserDto(row);
  }

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<User> {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Bruger', id);

    // At kunne fjerne sin egen admin-rolle, eller deaktivere sig selv, er
    // den mest almindelige måde at låse sig ude af sit eget system på.
    if (id === actorId) {
      if (input.role && input.role !== existing.role) {
        throw AppError.badRequest('Du kan ikke ændre din egen rolle');
      }
      if (input.active === false) {
        throw AppError.badRequest('Du kan ikke deaktivere din egen konto');
      }
    }

    if (input.email && input.email !== existing.email) {
      const taken = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (taken) throw AppError.conflict('E-mailen er optaget', { email: ['E-mailen er optaget'] });
    }

    // Rolleskift og deaktivering skal slå igennem med det samme på eksisterende tokens.
    const invalidatesTokens =
      (input.role !== undefined && input.role !== existing.role) || input.active === false;

    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.role === undefined ? {} : { role: input.role }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(invalidatesTokens ? { tokenVersion: { increment: 1 } } : {}),
      },
      include: INCLUDE,
    });

    if (invalidatesTokens) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return toUserDto(row);
  }

  async updateProfile(id: string, input: { displayName?: string }): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { ...(input.displayName === undefined ? {} : { displayName: input.displayName }) },
      include: INCLUDE,
    });
    return toUserDto(row);
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw AppError.badRequest('Du kan ikke slette din egen konto herfra');

    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Bruger', id);

    await this.prisma.$transaction(async (tx) => {
      // Anmeldelser bevares, men anonymiseres ikke automatisk — det ville
      // ændre indhold andre har forholdt sig til. Kontoen deaktiveres i stedet.
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), active: false, tokenVersion: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
