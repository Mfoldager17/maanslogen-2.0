import { Prisma } from '@prisma/client';
import {
  formatAttributeValue,
  type AttributeDataType,
  type AttributeDefinition,
  type AttributeOption,
  type AttributeRules,
  type AttributeValue,
  type BeverageAttribute,
} from '@maanslogen/contracts';

export interface AttributeDefinitionRow {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  dataType: AttributeDataType;
  unit: string | null;
  required: boolean;
  filterable: boolean;
  highlighted: boolean;
  sortOrder: number;
  rules: unknown;
  options: unknown;
  createdAt: Date;
  updatedAt: Date;
  categories?: { id: string }[];
  types?: { id: string }[];
}

export function toAttributeDefinitionDto(row: AttributeDefinitionRow): AttributeDefinition {
  return {
    id: row.id,
    key: row.key,
    displayName: row.displayName,
    description: row.description,
    dataType: row.dataType,
    unit: row.unit,
    required: row.required,
    filterable: row.filterable,
    highlighted: row.highlighted,
    sortOrder: row.sortOrder,
    rules: (row.rules as AttributeRules | null) ?? null,
    options: (row.options as AttributeOption[] | null) ?? null,
    categoryIds: row.categories?.map((category) => category.id) ?? [],
    typeIds: row.types?.map((type) => type.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface AttributeValueRow {
  definitionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  definition: AttributeDefinitionRow;
}

/** Læser den ene udfyldte kolonne ud fra definitionens datatype. */
export function readAttributeValue(row: AttributeValueRow): AttributeValue | null {
  switch (row.definition.dataType) {
    case 'NUMBER':
      return row.valueNumber;
    case 'BOOLEAN':
      return row.valueBoolean;
    case 'MULTI_ENUM':
      return Array.isArray(row.valueJson) ? (row.valueJson as string[]) : [];
    default:
      return row.valueText;
  }
}

export interface AttributeValueColumns {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  /** Prisma skelner mellem JSON-null og SQL-null; vi vil altid have SQL-null. */
  valueJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

/** Skriver en værdi ned i den rigtige kolonne; de øvrige nulstilles. */
export function writeAttributeValue(
  dataType: AttributeDataType,
  value: AttributeValue,
): AttributeValueColumns {
  const empty = {
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueJson: Prisma.DbNull,
  };
  switch (dataType) {
    case 'NUMBER':
      return { ...empty, valueNumber: typeof value === 'number' ? value : Number(value) };
    case 'BOOLEAN':
      return { ...empty, valueBoolean: Boolean(value) };
    case 'MULTI_ENUM':
      return { ...empty, valueJson: Array.isArray(value) ? value : [] };
    default:
      return { ...empty, valueText: String(value) };
  }
}

export function toBeverageAttributeDto(row: AttributeValueRow): BeverageAttribute | null {
  const value = readAttributeValue(row);
  if (value === null || value === undefined) return null;

  const definition = row.definition;
  return {
    definitionId: definition.id,
    key: definition.key,
    displayName: definition.displayName,
    dataType: definition.dataType,
    unit: definition.unit,
    highlighted: definition.highlighted,
    sortOrder: definition.sortOrder,
    value,
    displayValue: formatAttributeValue(
      {
        dataType: definition.dataType,
        unit: definition.unit,
        options: (definition.options as AttributeOption[] | null) ?? null,
      },
      value,
    ),
  };
}
