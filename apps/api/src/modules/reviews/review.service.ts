import { Injectable } from '@nestjs/common';
import {
  roleAtLeast,
  validateAnswer,
  type CreateReviewInput,
  type Paginated,
  type Review,
  type ReviewForm,
  type ReviewListQuery,
  type Role,
  type UpdateReviewInput,
} from '@maanslogen/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { paginate } from '../../common/pagination/cursor';
import { QuestionService } from '../questions/question.service';
import { writeAnswerValue, type AnswerColumns } from '../questions/question.mapper';
import { toReviewDto, type ReviewRow } from './review.mapper';

const INCLUDE = {
  user: { select: { id: true, displayName: true, avatar: { include: { renditions: true } } } },
  beverage: { select: { name: true, slug: true } },
  answers: { include: { question: true } },
} satisfies Prisma.ReviewInclude;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionService,
  ) {}

  async list(query: ReviewListQuery): Promise<Paginated<Review>> {
    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      ...(query.beverageId ? { beverageId: query.beverageId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.minRating === undefined && query.maxRating === undefined
        ? {}
        : {
            rating: {
              ...(query.minRating === undefined ? {} : { gte: query.minRating }),
              ...(query.maxRating === undefined ? {} : { lte: query.maxRating }),
            },
          }),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { body: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.review.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toReviewDto(row as ReviewRow),
      () => this.prisma.review.count({ where }),
    );
  }

  async get(id: string): Promise<Review> {
    const row = await this.prisma.review.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Anmeldelse', id);
    return toReviewDto(row);
  }

  /** Alt formularen skal bruge: spørgsmålene for typen og en evt. eksisterende anmeldelse. */
  async form(beverageIdOrSlug: string, userId: string | undefined): Promise<ReviewForm> {
    const beverage = await this.prisma.beverage.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(beverageIdOrSlug) },
      select: { id: true, name: true, typeId: true },
    });
    if (!beverage) throw AppError.notFound('Drikkevare', beverageIdOrSlug);

    const questions = await this.questions.forType(beverage.typeId);

    const existing = userId
      ? await this.prisma.review.findFirst({
          where: { beverageId: beverage.id, userId, deletedAt: null },
          include: INCLUDE,
        })
      : null;

    return {
      beverageId: beverage.id,
      beverageName: beverage.name,
      questions,
      existingReview: existing ? toReviewDto(existing) : null,
    };
  }

  async create(userId: string, input: CreateReviewInput): Promise<Review> {
    const beverage = await this.prisma.beverage.findFirst({
      where: { id: input.beverageId, deletedAt: null },
      select: { id: true, typeId: true },
    });
    if (!beverage) throw AppError.notFound('Drikkevare', input.beverageId);

    const duplicate = await this.prisma.review.findFirst({
      where: { beverageId: beverage.id, userId, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) {
      throw AppError.conflict(
        'Du har allerede anmeldt denne drikkevare. Redigér din eksisterende anmeldelse i stedet.',
      );
    }

    const answerRows = await this.validateAnswers(beverage.typeId, input.answers ?? [], true);

    const id = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId,
          beverageId: beverage.id,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body ?? null,
          answers: { create: answerRows },
        },
        select: { id: true },
      });

      // Samme transaktion: gennemsnittet kan aldrig komme ud af trit med anmeldelserne.
      await this.recomputeRating(tx, beverage.id);
      return review.id;
    });

    return this.get(id);
  }

  async update(
    id: string,
    actor: { userId: string; role: Role },
    input: UpdateReviewInput,
  ): Promise<Review> {
    const existing = await this.prisma.review.findFirst({
      where: { id, deletedAt: null },
      include: { beverage: { select: { id: true, typeId: true } } },
    });
    if (!existing) throw AppError.notFound('Anmeldelse', id);

    if (existing.userId !== actor.userId && !roleAtLeast(actor.role, 'MODERATOR')) {
      throw AppError.forbidden('Du kan kun redigere dine egne anmeldelser');
    }

    const answerRows =
      input.answers === undefined
        ? null
        : await this.validateAnswers(existing.beverage.typeId, input.answers, false);

    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id },
        data: {
          ...(input.rating === undefined ? {} : { rating: input.rating }),
          ...(input.title === undefined ? {} : { title: input.title ?? null }),
          ...(input.body === undefined ? {} : { body: input.body ?? null }),
          ...(answerRows === null
            ? {}
            : { answers: { deleteMany: {}, create: answerRows } }),
        },
      });

      if (input.rating !== undefined) {
        await this.recomputeRating(tx, existing.beverageId);
      }
    });

    return this.get(id);
  }

  async remove(id: string, actor: { userId: string; role: Role }): Promise<void> {
    const existing = await this.prisma.review.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Anmeldelse', id);

    if (existing.userId !== actor.userId && !roleAtLeast(actor.role, 'MODERATOR')) {
      throw AppError.forbidden('Du kan kun slette dine egne anmeldelser');
    }

    await this.prisma.$transaction(async (tx) => {
      // Hård sletning: en anmeldelse der skal væk skal ikke ligge og tælle med
      // i gennemsnittet, og unikhedskravet (bruger, drikkevare) skal frigives.
      await tx.review.delete({ where: { id } });
      await this.recomputeRating(tx, existing.beverageId);
    });
  }

  /**
   * Genberegner gennemsnit, antal og fordeling fra rækkerne.
   * 1.0 lagde til og trak fra i gennemsnittet ved hver ændring — én fejlet
   * opdatering, og tallet drev fra virkeligheden uden mulighed for at opdage det.
   */
  private async recomputeRating(tx: Prisma.TransactionClient, beverageId: string): Promise<void> {
    const grouped = await tx.review.groupBy({
      by: ['rating'],
      where: { beverageId, deletedAt: null },
      _count: { _all: true },
    });

    let total = 0;
    let count = 0;
    const buckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

    for (const group of grouped) {
      const rows = group._count._all;
      total += group.rating * rows;
      count += rows;
      const bucket = String(Math.round(group.rating));
      buckets[bucket] = (buckets[bucket] ?? 0) + rows;
    }

    await tx.beverage.update({
      where: { id: beverageId },
      data: {
        ratingAverage: count === 0 ? 0 : Number((total / count).toFixed(4)),
        ratingCount: count,
        ratingBuckets: buckets,
      },
    });
  }

  private async validateAnswers(
    typeId: string,
    answers: { questionId: string; value: unknown }[],
    enforceRequired: boolean,
  ): Promise<({ questionId: string } & AnswerColumns)[]> {
    const questions = await this.questions.forType(typeId);
    const byId = new Map(questions.map((question) => [question.id, question]));
    const errors: Record<string, string[]> = {};

    for (const answer of answers) {
      const question = byId.get(answer.questionId);
      if (!question) {
        (errors[`answers.${answer.questionId}`] ??= []).push(
          'Spørgsmålet stilles ikke for denne drikkevare',
        );
        continue;
      }
      const message = validateAnswer(question, answer.value as never);
      if (message) (errors[`answers.${question.id}`] ??= []).push(message);
    }

    if (enforceRequired) {
      const provided = new Map(answers.map((answer) => [answer.questionId, answer.value]));
      for (const question of questions) {
        if (!question.required) continue;
        const value = provided.get(question.id);
        const isEmpty =
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);
        if (isEmpty) (errors[`answers.${question.id}`] ??= []).push(`"${question.prompt}" skal besvares`);
      }
    }

    if (Object.keys(errors).length > 0) {
      throw AppError.validation('En eller flere besvarelser er ugyldige', errors);
    }

    return answers
      .filter((answer) => {
        const value = answer.value;
        return (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          !(Array.isArray(value) && value.length === 0)
        );
      })
      .map((answer) => {
        const question = byId.get(answer.questionId) as NonNullable<ReturnType<typeof byId.get>>;
        return {
          questionId: question.id,
          ...writeAnswerValue(question.answerType, answer.value as never),
        };
      });
  }
}
