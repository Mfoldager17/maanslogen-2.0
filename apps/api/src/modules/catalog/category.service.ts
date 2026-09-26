import { Injectable } from '@nestjs/common';
import type {
  Category,
  CategoryListQuery,
  CreateCategoryInput,
  Paginated,
  UpdateCategoryInput,
} from '@maanslogen/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { paginate } from '../../common/pagination/cursor';
import { uniqueSlug } from '../../common/utils/slug';
import { MediaService } from '../media/media.service';
import { toCategoryDto, type CategoryRow } from './catalog.mapper';

const INCLUDE = {
  media: { include: { renditions: true } },
} satisfies Prisma.BeverageCategoryInclude;

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: CategoryListQuery): Promise<Paginated<Category>> {
    const where: Prisma.BeverageCategoryWhereInput = {
      deletedAt: null,
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.BeverageCategoryOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.beverageCategory.findMany({
          where,
          include: { ...INCLUDE, types: { where: { deletedAt: null }, select: { id: true } } },
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toCategoryDto(row as CategoryRow),
      () => this.prisma.beverageCategory.count({ where }),
    );
  }

  /** Slår op på både id og slug, så frontend kan bruge pæne URL'er. */
  async getByIdOrSlug(idOrSlug: string): Promise<Category> {
    const row = await this.prisma.beverageCategory.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(idOrSlug) },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Kategori', idOrSlug);

    const beverageCount = await this.prisma.beverage.count({
      where: { deletedAt: null, type: { categoryId: row.id } },
    });
    return toCategoryDto({ ...row, beverageCount });
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const slug = await this.resolveSlug(input.slug ?? input.name);

    const created = await this.prisma.$transaction(async (tx) => {
      const mediaId = input.media
        ? await this.media.createAsset(tx, 'CATEGORY', input.media)
        : undefined;

      return tx.beverageCategory.create({
        data: {
          slug,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          accentColor: input.accentColor ?? null,
          sortOrder: input.sortOrder ?? 0,
          active: input.active ?? true,
          mediaId,
        },
        include: INCLUDE,
      });
    });

    return toCategoryDto(created);
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const existing = await this.prisma.beverageCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw AppError.notFound('Kategori', id);

    const slug =
      input.slug && input.slug !== existing.slug
        ? await this.resolveSlug(input.slug, id)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      let mediaId: string | null | undefined;
      if (input.media !== undefined) {
        await this.media.scheduleAssetDeletion(tx, existing.mediaId);
        mediaId = input.media ? await this.media.createAsset(tx, 'CATEGORY', input.media) : null;
      }

      return tx.beverageCategory.update({
        where: { id },
        data: {
          ...(slug ? { slug } : {}),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description ?? null }),
          ...(input.icon === undefined ? {} : { icon: input.icon ?? null }),
          ...(input.accentColor === undefined ? {} : { accentColor: input.accentColor ?? null }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(mediaId === undefined ? {} : { mediaId }),
        },
        include: INCLUDE,
      });
    });

    return toCategoryDto(updated);
  }

  /**
   * Blød sletning. En hård sletning ville efterlade typer og drikkevarer
   * uden forælder — eller kræve at anmeldelser blev slettet med.
   */
  async remove(id: string): Promise<void> {
    const category = await this.prisma.beverageCategory.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { types: true } } },
    });
    if (!category) throw AppError.notFound('Kategori', id);

    const activeTypes = await this.prisma.beverageType.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (activeTypes > 0) {
      throw AppError.conflict(
        `Kategorien har ${activeTypes} aktive typer. Flyt eller fjern dem først.`,
      );
    }

    await this.prisma.beverageCategory.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  private resolveSlug(desired: string, ignoreId?: string): Promise<string> {
    return uniqueSlug(desired, async (candidate) => {
      const found = await this.prisma.beverageCategory.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return found !== null && found.id !== ignoreId;
    });
  }
}
