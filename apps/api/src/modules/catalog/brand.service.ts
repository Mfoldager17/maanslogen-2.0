import { Injectable } from '@nestjs/common';
import type {
  Brand,
  BrandListQuery,
  CreateBrandInput,
  Paginated,
  UpdateBrandInput,
} from '@maanslogen/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { paginate } from '../../common/pagination/cursor';
import { uniqueSlug } from '../../common/utils/slug';
import { MediaService } from '../media/media.service';
import { toBrandDto, type BrandRow } from './catalog.mapper';

const INCLUDE = {
  media: { include: { renditions: true } },
  categories: { select: { id: true } },
  _count: { select: { beverages: true } },
} satisfies Prisma.BrandInclude;

@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(query: BrandListQuery): Promise<Paginated<Brand>> {
    const categoryIds = [
      ...(query.categoryId ? [query.categoryId] : []),
      ...(query.categoryIds ?? []),
    ];

    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(categoryIds.length ? { categories: { some: { id: { in: categoryIds } } } } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const orderBy: Prisma.BrandOrderByWithRelationInput[] =
      query.sort === 'beverageCount'
        ? [{ beverages: { _count: query.order } }, { id: 'asc' }]
        : [{ [query.sort]: query.order }, { id: 'asc' }];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.brand.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toBrandDto(row as BrandRow),
      () => this.prisma.brand.count({ where }),
    );
  }

  async getByIdOrSlug(idOrSlug: string): Promise<Brand> {
    const row = await this.prisma.brand.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(idOrSlug) },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Mærke', idOrSlug);
    return toBrandDto(row);
  }

  async create(input: CreateBrandInput): Promise<Brand> {
    await this.assertCategoriesExist(input.categoryIds);
    const slug = await this.resolveSlug(input.slug ?? input.name);

    const row = await this.prisma.$transaction(async (tx) => {
      const mediaId = input.media
        ? await this.media.createAsset(tx, 'BRAND', input.media)
        : undefined;
      return tx.brand.create({
        data: {
          slug,
          name: input.name,
          description: input.description ?? null,
          countryCode: input.countryCode ?? null,
          websiteUrl: input.websiteUrl ?? null,
          active: input.active ?? true,
          mediaId,
          ...(input.categoryIds?.length
            ? { categories: { connect: input.categoryIds.map((id) => ({ id })) } }
            : {}),
        },
        include: INCLUDE,
      });
    });

    return toBrandDto(row);
  }

  async update(id: string, input: UpdateBrandInput): Promise<Brand> {
    const existing = await this.prisma.brand.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Mærke', id);
    await this.assertCategoriesExist(input.categoryIds);

    const slug =
      input.slug && input.slug !== existing.slug
        ? await this.resolveSlug(input.slug, id)
        : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      let mediaId: string | null | undefined;
      if (input.media !== undefined) {
        await this.media.scheduleAssetDeletion(tx, existing.mediaId);
        mediaId = input.media ? await this.media.createAsset(tx, 'BRAND', input.media) : null;
      }

      return tx.brand.update({
        where: { id },
        data: {
          ...(slug ? { slug } : {}),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description ?? null }),
          ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode ?? null }),
          ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl ?? null }),
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(mediaId === undefined ? {} : { mediaId }),
          ...(input.categoryIds === undefined
            ? {}
            : { categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) } }),
        },
        include: INCLUDE,
      });
    });

    return toBrandDto(row);
  }

  async remove(id: string): Promise<void> {
    const brand = await this.prisma.brand.findFirst({ where: { id, deletedAt: null } });
    if (!brand) throw AppError.notFound('Mærke', id);

    const beverages = await this.prisma.beverage.count({ where: { brandId: id, deletedAt: null } });
    if (beverages > 0) {
      throw AppError.conflict(`Mærket bruges af ${beverages} drikkevarer og kan ikke fjernes.`);
    }

    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  private async assertCategoriesExist(categoryIds: string[] | undefined): Promise<void> {
    if (!categoryIds?.length) return;
    const found = await this.prisma.beverageCategory.findMany({
      where: { id: { in: categoryIds }, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(found.map((row) => row.id));
    const unknown = categoryIds.filter((id) => !known.has(id));
    if (unknown.length) {
      throw AppError.validation('En eller flere kategorier findes ikke', { categoryIds: unknown });
    }
  }

  private resolveSlug(desired: string, ignoreId?: string): Promise<string> {
    return uniqueSlug(desired, async (candidate) => {
      const found = await this.prisma.brand.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return found !== null && found.id !== ignoreId;
    });
  }
}
