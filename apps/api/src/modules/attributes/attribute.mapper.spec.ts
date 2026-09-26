import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  readAttributeValue,
  toBeverageAttributeDto,
  writeAttributeValue,
  type AttributeDefinitionRow,
} from './attribute.mapper';

function definition(overrides: Partial<AttributeDefinitionRow> = {}): AttributeDefinitionRow {
  return {
    id: 'def-1',
    key: 'alcohol_percent',
    displayName: 'Alkoholprocent',
    description: null,
    dataType: 'NUMBER',
    unit: '%',
    required: false,
    filterable: true,
    highlighted: true,
    sortOrder: 10,
    rules: null,
    options: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('writeAttributeValue', () => {
  it('skriver kun i kolonnen der passer til datatypen', () => {
    expect(writeAttributeValue('NUMBER', 7.5)).toEqual({
      valueText: null,
      valueNumber: 7.5,
      valueBoolean: null,
      valueJson: Prisma.DbNull,
    });
    expect(writeAttributeValue('BOOLEAN', true).valueBoolean).toBe(true);
    expect(writeAttributeValue('ENUM', 'dark').valueText).toBe('dark');
    expect(writeAttributeValue('MULTI_ENUM', ['a', 'b']).valueJson).toEqual(['a', 'b']);
  });

  it('bruger Prisma.DbNull frem for null, så JSON-kolonnen bliver SQL-null', () => {
    // Med `null` ville Prisma skrive JSON-værdien `null` i stedet for SQL NULL.
    expect(writeAttributeValue('TEXT', 'x').valueJson).toBe(Prisma.DbNull);
  });
});

describe('readAttributeValue', () => {
  it('læser fra kolonnen der svarer til datatypen', () => {
    const row = {
      definitionId: 'def-1',
      valueText: 'ignoreres',
      valueNumber: 7.5,
      valueBoolean: null,
      valueJson: null,
      definition: definition(),
    };
    expect(readAttributeValue(row)).toBe(7.5);
  });

  it('giver en tom liste for MULTI_ENUM uden værdi', () => {
    const row = {
      definitionId: 'def-1',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      valueJson: null,
      definition: definition({ dataType: 'MULTI_ENUM' }),
    };
    expect(readAttributeValue(row)).toEqual([]);
  });
});

describe('toBeverageAttributeDto', () => {
  it('formaterer på dansk med enhed', () => {
    const dto = toBeverageAttributeDto({
      definitionId: 'def-1',
      valueText: null,
      valueNumber: 7.5,
      valueBoolean: null,
      valueJson: null,
      definition: definition(),
    });
    expect(dto?.displayValue).toBe('7,5 %');
  });

  it('springer attributter uden værdi over', () => {
    const dto = toBeverageAttributeDto({
      definitionId: 'def-1',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      valueJson: null,
      definition: definition(),
    });
    expect(dto).toBeNull();
  });

  it('oversætter enum-nøgler til labels', () => {
    const dto = toBeverageAttributeDto({
      definitionId: 'def-2',
      valueText: 'dark',
      valueNumber: null,
      valueBoolean: null,
      valueJson: null,
      definition: definition({
        dataType: 'ENUM',
        unit: null,
        options: [{ value: 'dark', label: 'Mørk' }],
      }),
    });
    expect(dto?.displayValue).toBe('Mørk');
  });
});
