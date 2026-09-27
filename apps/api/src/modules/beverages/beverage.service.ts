import { Injectable } from '@nestjs/common';
import {
  parseAttributeFilters,
  type Beverage,
  type BeverageFacets,
  type BeverageListQuery,
  type BeverageSummary,
  type CreateBeverageInput,
  type Paginated,
  type UpdateBeverageInput,
} from '@maanslogen/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';
import { paginate } from '../../common/pagination/cursor';
import { uniqueSlug } from '../../common/utils/slug';
import { AttributeService } from '../attributes/attribute.service';
import { MediaService } from '../media/media.service';
import { toBeverageDto, toBeverageSummaryDto, type BeverageRow } from './beverage.mapper';

const DETAIL_INCLUDE = {
  media: { include: { renditions: true } },
  brand: { select: { id: true, slug: true, name: true } },
  type: {
    select: {
      id: true,
      slug: true,
      name: true,
      categoryId: true,
      category: { select: { id: true, slug: true, name: true, icon: true } },
    },
  },
  attributeValues: { include: { definition: true } },
} satisfies Prisma.BeverageInclude;

const LIST_INCLUDE = {
  media: { include: { renditions: true } },
  brand: { select: { id: true, slug: true, name: true } },
  type: {
    select: {
      id: true,
      slug: true,
      name: true,
      categoryId: true,
      category: { select: { id: true, slug: true, name: true, icon: true } },
    },
  },
  attributeValues: {
    where: { definition: { highlighted: true, deletedAt: null } },
    include: { definition: true },
  },
} satisfies Prisma.BeverageInclude;

@Injectable()
export class BeverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attributes: AttributeService,
    private readonly media: MediaService,
  ) {}

  async list(query: BeverageListQuery): Promise<Paginated<BeverageSummary>> {
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.beverage.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toBeverageSummaryDto(row as BeverageRow),
      () => this.prisma.beverage.count({ where }),
    );
  }

  /**
   * Facetter for det aktuelle filter, så sidebaren kan vise "Stout (48)"
   * og gråne de valg der ikke giver resultater.
   *
   * Hver dimension beregnes uden sit *eget* filter. Med ét fælles `where` til
   * alle fire fjernede et valgt mærke alle andre mærker fra mærkefacetten, og
   * kombinationen mærke + bedømmelse tømte Type, Mærke og Land helt: sidebaren
   * mistede de felter man skulle bruge for at komme ud igen, og chip-rækken
   * faldt tilbage til at vise slug'en, fordi navnet kom fra netop de facetter
   * der nu var tomme. Målt på `?brandSlugs=…&minRating=4`: ét afkrydsningsfelt
   * tilbage i hele sidebaren.
   *
   * Sådan opfører facetteret søgning sig også alle andre steder: at vælge
   * "Balbegie" ændrer tællingerne i de *øvrige* dimensioner, men lader
   * mærkelisten stå, så man kan skifte mærke med ét klik.
   */
  async facets(query: BeverageListQuery): Promise<BeverageFacets> {
    const udenEgetFilter = (udeladt: Partial<BeverageListQuery>) =>
      this.buildWhere({ ...query, ...udeladt });

    const typeWhere = udenEgetFilter({
      typeId: undefined,
      typeIds: undefined,
      typeSlugs: undefined,
    });
    const brandWhere = udenEgetFilter({
      brandId: undefined,
      brandIds: undefined,
      brandSlugs: undefined,
    });
    const countryWhere = udenEgetFilter({ countryCodes: undefined });
    // Kategorifacetten skal kunne skiftes lige så frit, og kategorien er en
    // egenskab ved typen — så både kategori- og typevalget udelades her.
    const categoryWhere = udenEgetFilter({
      categoryId: undefined,
      categorySlug: undefined,
      typeId: undefined,
      typeIds: undefined,
      typeSlugs: undefined,
    });

    const [byType, byBrand, byCountry, byTypeForCategories] = await Promise.all([
      this.prisma.beverage.groupBy({
        by: ['typeId'],
        where: typeWhere,
        _count: { _all: true },
      }),
      this.prisma.beverage.groupBy({
        by: ['brandId'],
        where: brandWhere,
        _count: { _all: true },
      }),
      this.prisma.beverage.groupBy({
        by: ['countryCode'],
        where: countryWhere,
        _count: { _all: true },
      }),
      this.prisma.beverage.groupBy({
        by: ['typeId'],
        where: categoryWhere,
        _count: { _all: true },
      }),
    ]);

    const alleTypeIds = [...new Set([...byType, ...byTypeForCategories].map((row) => row.typeId))];

    const [types, brands] = await Promise.all([
      this.prisma.beverageType.findMany({
        where: { id: { in: alleTypeIds } },
        select: { id: true, name: true, slug: true, categoryId: true },
      }),
      this.prisma.brand.findMany({
        where: { id: { in: byBrand.map((row) => row.brandId) } },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const typeById = new Map(types.map((type) => [type.id, type]));
    const brandById = new Map(brands.map((brand) => [brand.id, brand]));

    const categoryCounts = new Map<string, number>();
    for (const row of byTypeForCategories) {
      const type = typeById.get(row.typeId);
      if (!type) continue;
      categoryCounts.set(
        type.categoryId,
        (categoryCounts.get(type.categoryId) ?? 0) + row._count._all,
      );
    }

    const categories = await this.prisma.beverageCategory.findMany({
      where: { id: { in: [...categoryCounts.keys()] } },
      select: { id: true, name: true, slug: true },
    });

    const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;

    return {
      categories: categories
        .map((category) => ({
          value: category.slug,
          label: category.name,
          count: categoryCounts.get(category.id) ?? 0,
        }))
        .sort(byCount),
      types: byType
        .map((row) => ({
          value: typeById.get(row.typeId)?.slug ?? row.typeId,
          label: typeById.get(row.typeId)?.name ?? 'Ukendt',
          count: row._count._all,
        }))
        .sort(byCount),
      brands: byBrand
        .map((row) => ({
          value: brandById.get(row.brandId)?.slug ?? row.brandId,
          label: brandById.get(row.brandId)?.name ?? 'Ukendt',
          count: row._count._all,
        }))
        .sort(byCount),
      countries: byCountry
        .filter((row) => row.countryCode !== null)
        .map((row) => ({
          value: row.countryCode as string,
          label: row.countryCode as string,
          count: row._count._all,
        }))
        .sort(byCount),
    };
  }

  async getByIdOrSlug(idOrSlug: string): Promise<Beverage> {
    const row = await this.prisma.beverage.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(idOrSlug) },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw AppError.notFound('Drikkevare', idOrSlug);
    return toBeverageDto(row);
  }

  async create(input: CreateBeverageInput): Promise<Beverage> {
    await this.assertReferences(input.typeId, input.brandId);

    const duplicate = await this.prisma.beverage.findFirst({
      where: {
        brandId: input.brandId,
        name: input.name,
        vintage: input.vintage ?? null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw AppError.conflict('Mærket har allerede en drikkevare med det navn og den årgang', {
        name: ['Navnet er optaget for dette mærke'],
      });
    }

    const slug = await this.resolveSlug(
      input.slug ?? [input.name, input.vintage].filter(Boolean).join(' '),
    );

    const id = await this.prisma.$transaction(async (tx) => {
      const mediaId = input.media
        ? await this.media.createAsset(tx, 'BEVERAGE', input.media)
        : undefined;

      const beverage = await tx.beverage.create({
        data: {
          slug,
          name: input.name,
          description: input.description ?? null,
          countryCode: input.countryCode ?? null,
          vintage: input.vintage ?? null,
          active: input.active ?? true,
          typeId: input.typeId,
          brandId: input.brandId,
          mediaId,
        },
        select: { id: true },
      });

      await this.attributes.applyValues(tx, beverage.id, input.typeId, input.attributes ?? []);
      return beverage.id;
    });

    return this.getByIdOrSlug(id);
  }

  async update(id: string, input: UpdateBeverageInput): Promise<Beverage> {
    const existing = await this.prisma.beverage.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Drikkevare', id);
    await this.assertReferences(input.typeId, input.brandId);

    const slug =
      input.slug && input.slug !== existing.slug
        ? await this.resolveSlug(input.slug, id)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      let mediaId: string | null | undefined;
      if (input.media !== undefined) {
        await this.media.scheduleAssetDeletion(tx, existing.mediaId);
        mediaId = input.media ? await this.media.createAsset(tx, 'BEVERAGE', input.media) : null;
      }

      await tx.beverage.update({
        where: { id },
        data: {
          ...(slug ? { slug } : {}),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description ?? null }),
          ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode ?? null }),
          ...(input.vintage === undefined ? {} : { vintage: input.vintage ?? null }),
          ...(input.active === undefined ? {} : { active: input.active }),
          ...(input.typeId === undefined ? {} : { typeId: input.typeId }),
          ...(input.brandId === undefined ? {} : { brandId: input.brandId }),
          ...(mediaId === undefined ? {} : { mediaId }),
        },
      });

      const typeId = input.typeId ?? existing.typeId;

      // Skifter drikkevaren type, giver værdier fra den gamle types attributter
      // ikke længere mening — de fjernes i samme transaktion.
      if (input.typeId && input.typeId !== existing.typeId) {
        const stillValid = await tx.attributeDefinition.findMany({
          where: {
            deletedAt: null,
            AND: [
              {
                OR: [
                  { categories: { none: {} } },
                  { categories: { some: { types: { some: { id: typeId } } } } },
                ],
              },
              { OR: [{ types: { none: {} } }, { types: { some: { id: typeId } } }] },
            ],
          },
          select: { id: true },
        });
        await tx.beverageAttributeValue.deleteMany({
          where: { beverageId: id, definitionId: { notIn: stillValid.map((row) => row.id) } },
        });
      }

      if (input.attributes !== undefined) {
        await this.attributes.applyValues(tx, id, typeId, input.attributes);
      }
    });

    return this.getByIdOrSlug(id);
  }

  /** Blød sletning: anmeldelser bevares, og billedfilerne ryddes op af cron-jobbet. */
  async remove(id: string): Promise<void> {
    const beverage = await this.prisma.beverage.findFirst({ where: { id, deletedAt: null } });
    if (!beverage) throw AppError.notFound('Drikkevare', id);

    await this.prisma.$transaction(async (tx) => {
      await this.media.scheduleAssetDeletion(tx, beverage.mediaId);
      await tx.beverage.update({
        where: { id },
        data: { deletedAt: new Date(), active: false, mediaId: null },
      });
    });
  }

  private buildWhere(query: BeverageListQuery): Prisma.BeverageWhereInput {
    const typeIds = [...(query.typeId ? [query.typeId] : []), ...(query.typeIds ?? [])];
    const brandIds = [...(query.brandId ? [query.brandId] : []), ...(query.brandIds ?? [])];
    const attributeFilters = parseAttributeFilters(query.attr);

    // Ét samlet filter på relationen. Kategori og type-slug peger begge på
    // `type`, og som separate nøgler i samme objekt overskrev den sidste
    // den første — `?categoryId=…&categorySlug=…` tabte lydløst det ene
    // filter. Samlet her AND'es de i stedet, som man ville forvente.
    const typeWhere: Prisma.BeverageTypeWhereInput = {
      ...(query.typeSlugs?.length ? { slug: { in: query.typeSlugs } } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
    };

    return {
      deletedAt: null,
      // Standarden er kun aktive: en skjult drikkevare skal ikke dukke op
      // i kataloget, bare fordi et filter blev udeladt.
      ...(query.includeInactive ? {} : { active: query.active ?? true }),
      ...(typeIds.length ? { typeId: { in: typeIds } } : {}),
      ...(brandIds.length ? { brandId: { in: brandIds } } : {}),
      ...(query.brandSlugs?.length ? { brand: { slug: { in: query.brandSlugs } } } : {}),
      ...(Object.keys(typeWhere).length ? { type: typeWhere } : {}),
      ...(query.countryCodes?.length
        ? { countryCode: { in: query.countryCodes.map((code) => code.toUpperCase()) } }
        : {}),
      ...(query.minRating === undefined ? {} : { ratingAverage: { gte: query.minRating } }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { brand: { name: { contains: query.q, mode: 'insensitive' } } },
              { type: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(attributeFilters.length
        ? {
            AND: attributeFilters.map((filter) => ({
              attributeValues: {
                some: {
                  definition: { key: filter.key, filterable: true, deletedAt: null },
                  ...(filter.kind === 'range'
                    ? {
                        valueNumber: {
                          ...(filter.min === undefined ? {} : { gte: filter.min }),
                          ...(filter.max === undefined ? {} : { lte: filter.max }),
                        },
                      }
                    : filter.kind === 'boolean'
                      ? { valueBoolean: filter.value }
                      : { valueText: { in: filter.values } }),
                },
              },
            })),
          }
        : {}),
    };
  }

  private buildOrderBy(query: BeverageListQuery): Prisma.BeverageOrderByWithRelationInput[] {
    const column: Record<BeverageListQuery['sort'], keyof Prisma.BeverageOrderByWithRelationInput> =
      {
        name: 'name',
        createdAt: 'createdAt',
        rating: 'ratingAverage',
        reviewCount: 'ratingCount',
      };
    // Sekundær sortering på id gør cursor-paginationen deterministisk,
    // også når to rækker har samme bedømmelse.
    return [{ [column[query.sort]]: query.order }, { id: 'asc' }];
  }

  private async assertReferences(typeId?: string, brandId?: string): Promise<void> {
    if (typeId) {
      const type = await this.prisma.beverageType.count({ where: { id: typeId, deletedAt: null } });
      if (type === 0) throw AppError.validation('Typen findes ikke', { typeId: ['Ukendt type'] });
    }
    if (brandId) {
      const brand = await this.prisma.brand.count({ where: { id: brandId, deletedAt: null } });
      if (brand === 0)
        throw AppError.validation('Mærket findes ikke', { brandId: ['Ukendt mærke'] });
    }
  }

  private resolveSlug(desired: string, ignoreId?: string): Promise<string> {
    return uniqueSlug(desired, async (candidate) => {
      const found = await this.prisma.beverage.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return found !== null && found.id !== ignoreId;
    });
  }
}
