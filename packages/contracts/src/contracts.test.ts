import { describe, expect, it } from 'vitest';
import {
  beverageListQuerySchema,
  booleanWithDefault,
  optionalBoolean,
  createAttributeDefinitionSchema,
  createReviewSchema,
  formatAttributeValue,
  parseAttributeFilters,
  passwordSchema,
  roleAtLeast,
  slugify,
  validateAnswer,
  validateAttributeValue,
} from './index';

describe('slugify', () => {
  it('håndterer danske tegn', () => {
    expect(slugify('Hvedeøl fra Århus')).toBe('hvedeoel-fra-aarhus');
    expect(slugify('  Blå Ænder!! ')).toBe('blaa-aender');
  });

  it('kollapser separatorer og trimmer bindestreger', () => {
    expect(slugify('IPA -- 2024 //')).toBe('ipa-2024');
  });
});

describe('boolean-query-hjælpere', () => {
  it('behandler "false" som false i stedet for som en sandt-agtig streng', () => {
    const schema = booleanWithDefault(true);
    expect(schema.parse('false')).toBe(false);
    expect(schema.parse('0')).toBe(false);
    expect(schema.parse('true')).toBe(true);
    expect(schema.parse(undefined)).toBe(true);
  });

  it('lader en udeladt værdi blive undefined når der ingen standard er', () => {
    const schema = optionalBoolean();
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse('')).toBeUndefined();
    expect(schema.parse('false')).toBe(false);
  });
});

describe('beverageListQuerySchema', () => {
  it('coercer query-strenge til rigtige typer', () => {
    const parsed = beverageListQuerySchema.parse({
      limit: '50',
      withTotal: 'true',
      minRating: '4.5',
      typeIds: 'b3f1c2d4-0000-4000-8000-000000000001,b3f1c2d4-0000-4000-8000-000000000002',
    });
    expect(parsed.limit).toBe(50);
    expect(parsed.withTotal).toBe(true);
    expect(parsed.minRating).toBe(4.5);
    expect(parsed.typeIds).toHaveLength(2);
    expect(parsed.sort).toBe('createdAt');
  });

  it('tager imod de slugs facetterne selv svarer med', () => {
    // Facetterne returnerer slugs som `bucket.value`, ikke id'er. Da
    // sidebaren sendte dem videre som `typeIds` — en UUID-liste — svarede
    // API'et 400 på et filter brugeren lige havde fået tilbudt.
    const parsed = beverageListQuerySchema.parse({
      categorySlug: 'whisky',
      typeSlugs: 'whisky-skotsk-single-malt,whisky-irsk',
      brandSlugs: 'lagavulin',
    });
    expect(parsed.typeSlugs).toEqual(['whisky-skotsk-single-malt', 'whisky-irsk']);
    expect(parsed.brandSlugs).toEqual(['lagavulin']);
  });

  it('holder stadig typeIds til id\'er alene', () => {
    // Slug-vejen er en tilføjelse, ikke en opblødning: et `typeIds` med en
    // slug i er stadig en fejl, så gamle links ikke stille begynder at
    // matche noget andet end de plejede.
    expect(() =>
      beverageListQuerySchema.parse({ typeIds: 'whisky-skotsk-single-malt' }),
    ).toThrow();
  });

  it('afviser limit over maks', () => {
    expect(() => beverageListQuerySchema.parse({ limit: '5000' })).toThrow();
  });
});

describe('parseAttributeFilters', () => {
  it('forstår range, liste og boolean', () => {
    expect(parseAttributeFilters({ alcohol_percent: '4.5..6' })).toEqual([
      { key: 'alcohol_percent', kind: 'range', min: 4.5, max: 6 },
    ]);
    expect(parseAttributeFilters({ alcohol_percent: '4.5..' })).toEqual([
      { key: 'alcohol_percent', kind: 'range', min: 4.5, max: undefined },
    ]);
    expect(parseAttributeFilters({ color: 'dark|amber' })).toEqual([
      { key: 'color', kind: 'values', values: ['dark', 'amber'] },
    ]);
    expect(parseAttributeFilters({ organic: 'true' })).toEqual([
      { key: 'organic', kind: 'boolean', value: true },
    ]);
  });
});

describe('validateAttributeValue', () => {
  const numberDef = {
    dataType: 'NUMBER' as const,
    displayName: 'Alkohol',
    rules: { min: 0, max: 70 },
    options: null,
  };

  it('accepterer tal i intervallet', () => {
    expect(validateAttributeValue(numberDef, 5.6)).toBeNull();
  });

  it('afviser tal uden for intervallet', () => {
    expect(validateAttributeValue(numberDef, 90)).toMatch(/højst være 70/);
  });

  it('afviser ukendte enum-værdier', () => {
    const enumDef = {
      dataType: 'ENUM' as const,
      displayName: 'Farve',
      rules: null,
      options: [{ value: 'dark', label: 'Mørk' }],
    };
    expect(validateAttributeValue(enumDef, 'pink')).toMatch(/ikke en gyldig værdi/);
    expect(validateAttributeValue(enumDef, 'dark')).toBeNull();
  });
});

describe('formatAttributeValue', () => {
  it('formaterer tal på dansk med enhed', () => {
    expect(formatAttributeValue({ dataType: 'NUMBER', unit: '%', options: null }, 5.6)).toBe(
      '5,6 %',
    );
  });

  it('oversætter enum-værdier til labels', () => {
    expect(
      formatAttributeValue(
        { dataType: 'ENUM', unit: null, options: [{ value: 'dark', label: 'Mørk' }] },
        'dark',
      ),
    ).toBe('Mørk');
  });
});

describe('createAttributeDefinitionSchema', () => {
  it('kræver valgmuligheder på ENUM', () => {
    const result = createAttributeDefinitionSchema.safeParse({
      key: 'color',
      displayName: 'Farve',
      dataType: 'ENUM',
    });
    expect(result.success).toBe(false);
  });

  it('afviser nøgler der ikke er snake_case', () => {
    const result = createAttributeDefinitionSchema.safeParse({
      key: 'Alcohol Percent',
      displayName: 'Alkohol',
      dataType: 'NUMBER',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateAnswer', () => {
  const scale = {
    answerType: 'SCALE' as const,
    prompt: 'Hvor bitter?',
    options: null,
    scale: { min: 1, max: 5 },
    required: true,
  };

  it('kræver svar på påkrævede spørgsmål', () => {
    expect(validateAnswer(scale, null)).toMatch(/skal besvares/);
  });

  it('holder skalaen inden for grænserne', () => {
    expect(validateAnswer(scale, 7)).toMatch(/mellem 1 og 5/);
    expect(validateAnswer(scale, 3)).toBeNull();
  });
});

describe('createReviewSchema', () => {
  const beverageId = 'b3f1c2d4-0000-4000-8000-000000000001';

  it('tillader halve stjerner', () => {
    expect(createReviewSchema.safeParse({ beverageId, rating: 3.5 }).success).toBe(true);
  });

  it('afviser kvarte stjerner', () => {
    expect(createReviewSchema.safeParse({ beverageId, rating: 3.25 }).success).toBe(false);
  });

  it('afviser bedømmelser uden for 1-5', () => {
    expect(createReviewSchema.safeParse({ beverageId, rating: 0 }).success).toBe(false);
    expect(createReviewSchema.safeParse({ beverageId, rating: 6 }).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('afviser svage adgangskoder', () => {
    expect(passwordSchema.safeParse('kort').success).toBe(false);
    expect(passwordSchema.safeParse('alleredesmåbogstaver').success).toBe(false);
  });

  it('accepterer en stærk adgangskode', () => {
    expect(passwordSchema.safeParse('Korrekt-Hest-7').success).toBe(true);
  });
});

describe('roleAtLeast', () => {
  it('respekterer rollehierarkiet', () => {
    expect(roleAtLeast('ADMIN', 'MODERATOR')).toBe(true);
    expect(roleAtLeast('MODERATOR', 'ADMIN')).toBe(false);
    expect(roleAtLeast('USER', 'USER')).toBe(true);
  });
});
