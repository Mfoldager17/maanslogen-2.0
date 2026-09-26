import { Injectable } from '@nestjs/common';
import {
  validateAttributeValue,
  type AttributeDefinition,
  type AttributeDefinitionListQuery,
  type BeverageAttributeInput,
  type CreateAttributeDefinitionInput,
  type Paginated,
  type UpdateAttributeDefinitionInput,
} from '@maanslogen/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { paginate } from '../../common/pagination/cursor';
import {
  toAttributeDefinitionDto,
  writeAttributeValue,
  type AttributeDefinitionRow,
} from './attribute.mapper';

const INCLUDE = {
  categories: { select: { id: true } },
  types: { select: { id: true } },
} satisfies Prisma.AttributeDefinitionInclude;

@Injectable()
export class AttributeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AttributeDefinitionListQuery): Promise<Paginated<AttributeDefinition>> {
    const where: Prisma.AttributeDefinitionWhereInput = {
      deletedAt: null,
      ...(query.filterable === undefined ? {} : { filterable: query.filterable }),
      ...(query.dataTypes?.length ? { dataType: { in: query.dataTypes } } : {}),
      ...(query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: 'insensitive' } },
              { key: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      // Tom relation betyder "gælder alle", så et scope-filter skal også
      // få de ubegrænsede definitioner med.
      ...(query.categoryId
        ? { OR: [{ categories: { some: { id: query.categoryId } } }, { categories: { none: {} } }] }
        : {}),
      ...(query.typeId
        ? { AND: [{ OR: [{ types: { some: { id: query.typeId } } }, { types: { none: {} } }] }] }
        : {}),
    };

    const orderBy: Prisma.AttributeDefinitionOrderByWithRelationInput[] = [
      { [query.sort]: query.order },
      { id: 'asc' },
    ];

    return paginate(
      query,
      (take, cursorId) =>
        this.prisma.attributeDefinition.findMany({
          where,
          include: INCLUDE,
          orderBy,
          take,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        }),
      (row) => toAttributeDefinitionDto(row as AttributeDefinitionRow),
      () => this.prisma.attributeDefinition.count({ where }),
    );
  }

  async get(id: string): Promise<AttributeDefinition> {
    const row = await this.prisma.attributeDefinition.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    if (!row) throw AppError.notFound('Attributdefinition', id);
    return toAttributeDefinitionDto(row);
  }

  /**
   * Alle definitioner der gælder for en given type. Tom kategori- eller type-relation
   * betyder "gælder alle" — samme regel som i 1.0, men nu evalueret i databasen
   * i stedet for i en `.filter()` i browseren.
   */
  async forType(typeId: string): Promise<AttributeDefinition[]> {
    const type = await this.prisma.beverageType.findFirst({
      where: { id: typeId, deletedAt: null },
      select: { id: true, categoryId: true },
    });
    if (!type) throw AppError.notFound('Type', typeId);

    const rows = await this.prisma.attributeDefinition.findMany({
      where: {
        deletedAt: null,
        AND: [
          { OR: [{ categories: { none: {} } }, { categories: { some: { id: type.categoryId } } }] },
          { OR: [{ types: { none: {} } }, { types: { some: { id: type.id } } }] },
        ],
      },
      include: INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    });

    return rows.map((row) => toAttributeDefinitionDto(row as AttributeDefinitionRow));
  }

  async create(input: CreateAttributeDefinitionInput): Promise<AttributeDefinition> {
    const existing = await this.prisma.attributeDefinition.findUnique({
      where: { key: input.key },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict(`Nøglen "${input.key}" er allerede i brug`, {
        key: ['Nøglen er optaget'],
      });
    }

    await this.assertScopeExists(input.categoryIds, input.typeIds);

    const row = await this.prisma.attributeDefinition.create({
      data: {
        key: input.key,
        displayName: input.displayName,
        description: input.description ?? null,
        dataType: input.dataType,
        unit: input.unit ?? null,
        required: input.required ?? false,
        filterable: input.filterable ?? false,
        highlighted: input.highlighted ?? false,
        sortOrder: input.sortOrder ?? 0,
        rules: input.rules ?? undefined,
        options: input.options ?? undefined,
        ...(input.categoryIds?.length
          ? { categories: { connect: input.categoryIds.map((id) => ({ id })) } }
          : {}),
        ...(input.typeIds?.length
          ? { types: { connect: input.typeIds.map((id) => ({ id })) } }
          : {}),
      },
      include: INCLUDE,
    });

    return toAttributeDefinitionDto(row);
  }

  async update(id: string, input: UpdateAttributeDefinitionInput): Promise<AttributeDefinition> {
    const existing = await this.prisma.attributeDefinition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw AppError.notFound('Attributdefinition', id);

    await this.assertScopeExists(input.categoryIds, input.typeIds);

    // At fjerne en valgmulighed der er i brug ville gøre eksisterende værdier ugyldige.
    if (input.options !== undefined && input.options !== null) {
      const allowed = new Set(input.options.map((option) => option.value));
      const used = await this.prisma.beverageAttributeValue.findMany({
        where: { definitionId: id, valueText: { not: null } },
        select: { valueText: true },
        distinct: ['valueText'],
      });
      const orphaned = used
        .map((row) => row.valueText)
        .filter((value): value is string => value !== null && !allowed.has(value));
      if (orphaned.length > 0) {
        throw AppError.conflict(
          `Valgmulighederne ${orphaned.join(', ')} er i brug på eksisterende drikkevarer`,
          { options: orphaned.map((value) => `"${value}" er i brug`) },
        );
      }
    }

    const row = await this.prisma.attributeDefinition.update({
      where: { id },
      data: {
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.unit === undefined ? {} : { unit: input.unit ?? null }),
        ...(input.required === undefined ? {} : { required: input.required }),
        ...(input.filterable === undefined ? {} : { filterable: input.filterable }),
        ...(input.highlighted === undefined ? {} : { highlighted: input.highlighted }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.rules === undefined
          ? {}
          : { rules: (input.rules ?? Prisma.DbNull) as Prisma.InputJsonValue }),
        ...(input.options === undefined
          ? {}
          : { options: (input.options ?? Prisma.DbNull) as Prisma.InputJsonValue }),
        ...(input.categoryIds === undefined
          ? {}
          : { categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) } }),
        ...(input.typeIds === undefined
          ? {}
          : { types: { set: input.typeIds.map((typeId) => ({ id: typeId })) } }),
      },
      include: INCLUDE,
    });

    return toAttributeDefinitionDto(row);
  }

  async remove(id: string): Promise<void> {
    const definition = await this.prisma.attributeDefinition.findFirst({
      where: { id, deletedAt: null },
    });
    if (!definition) throw AppError.notFound('Attributdefinition', id);

    const inUse = await this.prisma.beverageAttributeValue.count({ where: { definitionId: id } });
    if (inUse > 0) {
      throw AppError.conflict(
        `Attributten har værdier på ${inUse} drikkevarer. Fjern værdierne først, eller deaktivér attributten i stedet.`,
      );
    }

    await this.prisma.attributeDefinition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Validerer og gemmer attributværdier for en drikkevare. Kaldes inde i samme
   * transaktion som drikkevaren selv, så en ugyldig værdi ruller hele skrivningen tilbage.
   */
  async applyValues(
    tx: Prisma.TransactionClient,
    beverageId: string,
    typeId: string,
    inputs: BeverageAttributeInput[],
  ): Promise<void> {
    const type = await tx.beverageType.findUniqueOrThrow({
      where: { id: typeId },
      select: { categoryId: true },
    });

    const definitions = await tx.attributeDefinition.findMany({
      where: {
        deletedAt: null,
        AND: [
          { OR: [{ categories: { none: {} } }, { categories: { some: { id: type.categoryId } } }] },
          { OR: [{ types: { none: {} } }, { types: { some: { id: typeId } } }] },
        ],
      },
    });
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));

    const errors: Record<string, string[]> = {};
    for (const input of inputs) {
      const definition = byId.get(input.definitionId);
      if (!definition) {
        (errors[`attributes.${input.definitionId}`] ??= []).push(
          'Attributten gælder ikke for denne type',
        );
        continue;
      }
      const message = validateAttributeValue(
        {
          dataType: definition.dataType,
          displayName: definition.displayName,
          rules: (definition.rules as never) ?? null,
          options: (definition.options as never) ?? null,
        },
        input.value,
      );
      if (message) (errors[`attributes.${definition.key}`] ??= []).push(message);
    }

    // Påkrævede attributter skal have en værdi — enten en ny eller en allerede gemt.
    const provided = new Map(inputs.map((input) => [input.definitionId, input.value]));
    const stored = await tx.beverageAttributeValue.findMany({
      where: { beverageId },
      select: { definitionId: true },
    });
    const storedIds = new Set(stored.map((row) => row.definitionId));

    for (const definition of definitions) {
      if (!definition.required) continue;
      const incoming = provided.get(definition.id);
      const hasIncoming = provided.has(definition.id) && incoming !== null && incoming !== '';
      const willBeCleared = provided.has(definition.id) && !hasIncoming;
      if (!hasIncoming && (willBeCleared || !storedIds.has(definition.id))) {
        (errors[`attributes.${definition.key}`] ??= []).push(
          `${definition.displayName} er påkrævet`,
        );
      }
    }

    if (Object.keys(errors).length > 0) {
      throw AppError.validation('En eller flere attributværdier er ugyldige', errors);
    }

    for (const input of inputs) {
      const definition = byId.get(input.definitionId);
      if (!definition) continue;

      if (input.value === null || input.value === '') {
        await tx.beverageAttributeValue.deleteMany({
          where: { beverageId, definitionId: definition.id },
        });
        continue;
      }

      const columns = writeAttributeValue(definition.dataType, input.value);
      await tx.beverageAttributeValue.upsert({
        where: { beverageId_definitionId: { beverageId, definitionId: definition.id } },
        create: { beverageId, definitionId: definition.id, ...columns },
        update: columns,
      });
    }
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
