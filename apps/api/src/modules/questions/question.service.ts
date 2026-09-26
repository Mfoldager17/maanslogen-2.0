import { Injectable } from '@nestjs/common';
import type {
  CreateQuestionInput,
  Paginated,
  Question,
  QuestionListQuery,
  UpdateQuestionInput,
} from '@maanslogen/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { paginate } from '../../common/pagination/cursor';
import { toQuestionDto, type QuestionRow } from './question.mapper';

const INCLUDE = {
  categories: { select: { id: true } },
  types: { select: { id: true } },
} satisfies Prisma.QuestionInclude;

@Injectable()
export class QuestionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QuestionListQuery): Promise<Paginated<Question>> {
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      ...(query.q ? { prompt: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.categoryId
        ? {
            OR: [{ categories: { none: {} } }, { categories: { some: { id: query.categoryId } } }],
          }
        : {}),
      ...(query.typeId
        ? { AND: [{ OR: [{ types: { none: {} } }, { types: { some: { id: query.typeId } } }] }] }
        : {}),
    };

    const orderBy: Prisma.QuestionOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.question.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toQuestionDto(row as QuestionRow),
      () => this.prisma.question.count({ where }),
    );
  }

  async get(id: string): Promise<Question> {
    const row = await this.prisma.question.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Spørgsmål', id);
    return toQuestionDto(row);
  }

  /** De spørgsmål der skal stilles når man anmelder en drikkevare af denne type. */
  async forType(typeId: string): Promise<Question[]> {
    const type = await this.prisma.beverageType.findFirst({
      where: { id: typeId, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!type) throw AppError.notFound('Type', typeId);

    const rows = await this.prisma.question.findMany({
      where: {
        deletedAt: null,
        active: true,
        AND: [
          { OR: [{ categories: { none: {} } }, { categories: { some: { id: type.categoryId } } }] },
          { OR: [{ types: { none: {} } }, { types: { some: { id: type.id } } }] },
        ],
      },
      include: INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => toQuestionDto(row as QuestionRow));
  }

  async create(input: CreateQuestionInput): Promise<Question> {
    await this.assertScopeExists(input.categoryIds, input.typeIds);

    const row = await this.prisma.question.create({
      data: {
        prompt: input.prompt,
        helpText: input.helpText ?? null,
        answerType: input.answerType,
        required: input.required ?? false,
        sortOrder: input.sortOrder ?? 0,
        options: input.options ?? undefined,
        scale: input.scale ?? undefined,
        active: input.active ?? true,
        ...(input.categoryIds?.length
          ? { categories: { connect: input.categoryIds.map((id) => ({ id })) } }
          : {}),
        ...(input.typeIds?.length
          ? { types: { connect: input.typeIds.map((id) => ({ id })) } }
          : {}),
      },
      include: INCLUDE,
    });

    return toQuestionDto(row);
  }

  async update(id: string, input: UpdateQuestionInput): Promise<Question> {
    const existing = await this.prisma.question.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Spørgsmål', id);
    await this.assertScopeExists(input.categoryIds, input.typeIds);

    const row = await this.prisma.question.update({
      where: { id },
      data: {
        ...(input.prompt === undefined ? {} : { prompt: input.prompt }),
        ...(input.helpText === undefined ? {} : { helpText: input.helpText ?? null }),
        ...(input.required === undefined ? {} : { required: input.required }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.options === undefined
          ? {}
          : { options: (input.options ?? Prisma.DbNull) as Prisma.InputJsonValue }),
        ...(input.scale === undefined
          ? {}
          : { scale: (input.scale ?? Prisma.DbNull) as Prisma.InputJsonValue }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.categoryIds === undefined
          ? {}
          : { categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) } }),
        ...(input.typeIds === undefined
          ? {}
          : { types: { set: input.typeIds.map((typeId) => ({ id: typeId })) } }),
      },
      include: INCLUDE,
    });

    return toQuestionDto(row);
  }

  /**
   * Spørgsmål med besvarelser arkiveres i stedet for at blive slettet.
   * Ellers ville gamle anmeldelser miste den kontekst de blev skrevet i.
   */
  async remove(id: string): Promise<void> {
    const question = await this.prisma.question.findFirst({ where: { id, deletedAt: null } });
    if (!question) throw AppError.notFound('Spørgsmål', id);

    const answers = await this.prisma.reviewAnswer.count({ where: { questionId: id } });
    if (answers > 0) {
      await this.prisma.question.update({
        where: { id },
        data: { active: false, deletedAt: new Date() },
      });
      return;
    }

    await this.prisma.question.delete({ where: { id } });
  }

  private async assertScopeExists(
    categoryIds: string[] | undefined,
    typeIds: string[] | undefined,
  ): Promise<void> {
    if (categoryIds?.length) {
      const found = await this.prisma.beverageCategory.count({
        where: { id: { in: categoryIds }, deletedAt: null },
      });
      if (found !== categoryIds.length) {
        throw AppError.validation('En eller flere kategorier findes ikke', {
          categoryIds: ['Ukendt kategori'],
        });
      }
    }
    if (typeIds?.length) {
      const found = await this.prisma.beverageType.count({
        where: { id: { in: typeIds }, deletedAt: null },
      });
      if (found !== typeIds.length) {
        throw AppError.validation('En eller flere typer findes ikke', { typeIds: ['Ukendt type'] });
      }
    }
  }
}
