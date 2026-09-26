import { Injectable } from '@nestjs/common';
import type {
  BeverageType,
  BeverageTypeListQuery,
  CreateBeverageTypeInput,
  Paginated,
  UpdateBeverageTypeInput,
} from '@maanslogen/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { paginate } from '../../common/pagination/cursor';
import { uniqueSlug } from '../../common/utils/slug';
import { toBeverageTypeDto, type BeverageTypeRow } from './catalog.mapper';

const INCLUDE = {
  category: { select: { id: true, slug: true, name: true, icon: true } },
  _count: { select: { beverages: true } },
} satisfies Prisma.BeverageTypeInclude;

@Injectable()
export class BeverageTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: BeverageTypeListQuery): Promise<Paginated<BeverageType>> {
    const where: Prisma.BeverageTypeWhereInput = {
      deletedAt: null,
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.BeverageTypeOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.beverageType.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toBeverageTypeDto(row as BeverageTypeRow),
      () => this.prisma.beverageType.count({ where }),
    );
  }

  async getByIdOrSlug(idOrSlug: string): Promise<BeverageType> {
    const row = await this.prisma.beverageType.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(idOrSlug) },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Type', idOrSlug);
    return toBeverageTypeDto(row);
  }

  async create(input: CreateBeverageTypeInput): Promise<BeverageType> {
    await this.assertCategoryExists(input.categoryId);

    const duplicate = await this.prisma.beverageType.findFirst({
      where: { categoryId: input.categoryId, name: input.name, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) {
      throw AppError.conflict('Der findes allerede en type med det navn i kategorien', {
        name: ['Navnet er optaget i denne kategori'],
      });
    }

    const row = await this.prisma.beverageType.create({
      data: {
        slug: await this.resolveSlug(input.slug ?? input.name),
        categoryId: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
      include: INCLUDE,
    });
    return toBeverageTypeDto(row);
  }

  async update(id: string, input: UpdateBeverageTypeInput): Promise<BeverageType> {
    const existing = await this.prisma.beverageType.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Type', id);
    if (input.categoryId) await this.assertCategoryExists(input.categoryId);

    const slug =
      input.slug && input.slug !== existing.slug
        ? await this.resolveSlug(input.slug, id)
        : undefined;

    const row = await this.prisma.beverageType.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.active === undefined ? {} : { active: input.active }),
      },
      include: INCLUDE,
    });
    return toBeverageTypeDto(row);
  }

  async remove(id: string): Promise<void> {
    const type = await this.prisma.beverageType.findFirst({ where: { id, deletedAt: null } });
    if (!type) throw AppError.notFound('Type', id);

    const beverages = await this.prisma.beverage.count({ where: { typeId: id, deletedAt: null } });
    if (beverages > 0) {
      throw AppError.conflict(
        `Typen bruges af ${beverages} drikkevarer. Flyt dem til en anden type først.`,
      );
    }

    await this.prisma.beverageType.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.beverageCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw AppError.validation('Kategorien findes ikke', { categoryId: ['Ukendt kategori'] });
    }
  }

  private resolveSlug(desired: string, ignoreId?: string): Promise<string> {
    return uniqueSlug(desired, async (candidate) => {
      const found = await this.prisma.beverageType.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return found !== null && found.id !== ignoreId;
    });
  }
}
