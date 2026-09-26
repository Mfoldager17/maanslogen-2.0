import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser, resetDatabase, startHarness, type AuthedUser, type TestHarness } from './harness';

/**
 * Den dynamiske attributmodel er hele pointen med systemet, så den testes
 * hele vejen igennem: definition → værdi → validering → filtrering.
 */
describe('Drikkevarer og dynamiske attributter (e2e)', () => {
  let harness: TestHarness;
  let moderator: AuthedUser;

  let beerCategoryId: string;
  let wineCategoryId: string;
  let stoutTypeId: string;
  let ipaTypeId: string;
  let redWineTypeId: string;
  let brandId: string;
  let wineBrandId: string;
  let alcoholDefId: string;
  let ibuDefId: string;
  let colorDefId: string;

  beforeAll(async () => {
    harness = await startHarness();
  });
  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await resetDatabase(harness.prisma);
    moderator = await registerUser(harness, { role: 'MODERATOR' });

    const post = async (url: string, payload: Record<string, unknown>) => {
      const response = await harness.request({
        method: 'POST',
        url,
        headers: moderator.headers,
        payload,
      });
      if (response.statusCode >= 400) throw new Error(`${url}: ${response.body}`);
      return response.json();
    };

    beerCategoryId = (await post('/api/v1/categories', { name: 'Øl', icon: '🍺' })).id;
    wineCategoryId = (await post('/api/v1/categories', { name: 'Vin', icon: '🍷' })).id;
    stoutTypeId = (await post('/api/v1/types', { categoryId: beerCategoryId, name: 'Stout' })).id;
    ipaTypeId = (await post('/api/v1/types', { categoryId: beerCategoryId, name: 'IPA' })).id;
    redWineTypeId = (await post('/api/v1/types', { categoryId: wineCategoryId, name: 'Rødvin' })).id;
    brandId = (await post('/api/v1/brands', { name: 'Mikkeller', categoryIds: [beerCategoryId] })).id;
    wineBrandId = (await post('/api/v1/brands', { name: 'Dr. Loosen', categoryIds: [wineCategoryId] })).id;

    // Uden kategorier: gælder alle.
    alcoholDefId = (
      await post('/api/v1/attributes', {
        key: 'alcohol_percent',
        displayName: 'Alkoholprocent',
        dataType: 'NUMBER',
        unit: '%',
        required: true,
        filterable: true,
        highlighted: true,
        rules: { min: 0, max: 70 },
      })
    ).id;

    // Kun Øl.
    ibuDefId = (
      await post('/api/v1/attributes', {
        key: 'ibu',
        displayName: 'Bitterhed',
        dataType: 'NUMBER',
        unit: 'IBU',
        filterable: true,
        categoryIds: [beerCategoryId],
      })
    ).id;

    // Kun Stout.
    colorDefId = (
      await post('/api/v1/attributes', {
        key: 'color',
        displayName: 'Farve',
        dataType: 'ENUM',
        filterable: true,
        highlighted: true,
        options: [
          { value: 'dark', label: 'Mørk' },
          { value: 'light', label: 'Lys' },
        ],
        categoryIds: [beerCategoryId],
        typeIds: [stoutTypeId],
      })
    ).id;
  });

  async function createBeverage(payload: Record<string, unknown>, expectOk = true) {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/beverages',
      headers: moderator.headers,
      payload,
    });
    if (expectOk && response.statusCode !== 201) throw new Error(response.body);
    return response;
  }

  describe('attributternes gyldighedsområde', () => {
    it('giver en stout alle tre attributter', async () => {
      const response = await harness.request({
        method: 'GET',
        url: `/api/v1/attributes/for-type/${stoutTypeId}`,
      });
      expect(response.json().map((definition: { key: string }) => definition.key).sort()).toEqual([
        'alcohol_percent',
        'color',
        'ibu',
      ]);
    });

    it('udelader den stout-specifikke attribut for IPA', async () => {
      const response = await harness.request({
        method: 'GET',
        url: `/api/v1/attributes/for-type/${ipaTypeId}`,
      });
      expect(response.json().map((definition: { key: string }) => definition.key).sort()).toEqual([
        'alcohol_percent',
        'ibu',
      ]);
    });

    it('giver kun rødvin den ubegrænsede attribut', async () => {
      const response = await harness.request({
        method: 'GET',
        url: `/api/v1/attributes/for-type/${redWineTypeId}`,
      });
      expect(response.json().map((definition: { key: string }) => definition.key)).toEqual([
        'alcohol_percent',
      ]);
    });
  });

  describe('attributværdier', () => {
    it('gemmer og formaterer værdier på dansk', async () => {
      const response = await createBeverage({
        name: 'Beer Geek Breakfast',
        typeId: stoutTypeId,
        brandId,
        countryCode: 'dk',
        attributes: [
          { definitionId: alcoholDefId, value: 7.5 },
          { definitionId: ibuDefId, value: 42 },
          { definitionId: colorDefId, value: 'dark' },
        ],
      });

      const beverage = response.json();
      expect(beverage.slug).toBe('beer-geek-breakfast');
      expect(beverage.countryCode).toBe('DK');
      const byKey = Object.fromEntries(
        beverage.attributes.map((attribute: { key: string; displayValue: string }) => [
          attribute.key,
          attribute.displayValue,
        ]),
      );
      expect(byKey).toEqual({ alcohol_percent: '7,5 %', ibu: '42 IBU', color: 'Mørk' });
    });

    it('afviser en værdi uden for definitionens grænser', async () => {
      const response = await createBeverage(
        {
          name: 'Umuligt stærk',
          typeId: stoutTypeId,
          brandId,
          attributes: [{ definitionId: alcoholDefId, value: 96 }],
        },
        false,
      );
      expect(response.statusCode).toBe(422);
      expect(response.json().errors['attributes.alcohol_percent'][0]).toContain('højst være 70');
    });

    it('afviser en ukendt enum-værdi', async () => {
      const response = await createBeverage(
        {
          name: 'Pink stout',
          typeId: stoutTypeId,
          brandId,
          attributes: [
            { definitionId: alcoholDefId, value: 5 },
            { definitionId: colorDefId, value: 'lyserød' },
          ],
        },
        false,
      );
      expect(response.statusCode).toBe(422);
      expect(response.json().errors['attributes.color']).toBeDefined();
    });

    it('kræver de påkrævede attributter', async () => {
      const response = await createBeverage(
        { name: 'Uden alkoholprocent', typeId: stoutTypeId, brandId },
        false,
      );
      expect(response.statusCode).toBe(422);
      expect(response.json().errors['attributes.alcohol_percent'][0]).toContain('påkrævet');
    });

    it('afviser en attribut der ikke gælder for typen', async () => {
      const response = await createBeverage(
        {
          name: 'IPA med farve',
          typeId: ipaTypeId,
          brandId,
          attributes: [
            { definitionId: alcoholDefId, value: 6 },
            { definitionId: colorDefId, value: 'dark' },
          ],
        },
        false,
      );
      expect(response.statusCode).toBe(422);
    });

    it('ruller hele oprettelsen tilbage når en attribut er ugyldig', async () => {
      await createBeverage(
        {
          name: 'Skal ikke findes',
          typeId: stoutTypeId,
          brandId,
          attributes: [{ definitionId: alcoholDefId, value: 999 }],
        },
        false,
      );
      const count = await harness.prisma.beverage.count({ where: { name: 'Skal ikke findes' } });
      expect(count).toBe(0);
    });

    it('fjerner værdier der ikke længere gælder når typen ændres', async () => {
      const beverage = (
        await createBeverage({
          name: 'Skifter type',
          typeId: stoutTypeId,
          brandId,
          attributes: [
            { definitionId: alcoholDefId, value: 7 },
            { definitionId: colorDefId, value: 'dark' },
          ],
        })
      ).json();

      const updated = await harness.request({
        method: 'PATCH',
        url: `/api/v1/beverages/${beverage.id}`,
        headers: moderator.headers,
        payload: { typeId: ipaTypeId },
      });

      const keys = updated.json().attributes.map((attribute: { key: string }) => attribute.key);
      expect(keys).toContain('alcohol_percent');
      expect(keys).not.toContain('color');
    });
  });

  describe('filtrering', () => {
    beforeEach(async () => {
      await createBeverage({
        name: 'Mørk og stærk',
        typeId: stoutTypeId,
        brandId,
        countryCode: 'DK',
        attributes: [
          { definitionId: alcoholDefId, value: 9 },
          { definitionId: ibuDefId, value: 60 },
          { definitionId: colorDefId, value: 'dark' },
        ],
      });
      await createBeverage({
        name: 'Mørk og mild',
        typeId: stoutTypeId,
        brandId,
        countryCode: 'DK',
        attributes: [
          { definitionId: alcoholDefId, value: 4.2 },
          { definitionId: colorDefId, value: 'dark' },
        ],
      });
      await createBeverage({
        name: 'Lys og stærk',
        typeId: stoutTypeId,
        brandId,
        countryCode: 'IE',
        attributes: [
          { definitionId: alcoholDefId, value: 8 },
          { definitionId: colorDefId, value: 'light' },
        ],
      });
      await createBeverage({
        name: 'Riesling',
        typeId: redWineTypeId,
        brandId: wineBrandId,
        countryCode: 'DE',
        attributes: [{ definitionId: alcoholDefId, value: 11.5 }],
      });
    });

    const names = (body: { items: { name: string }[] }) => body.items.map((item) => item.name).sort();

    it('filtrerer på et talinterval', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages?attr[alcohol_percent]=5..10',
      });
      expect(names(response.json())).toEqual(['Lys og stærk', 'Mørk og stærk']);
    });

    it('filtrerer på et åbent interval', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages?attr[alcohol_percent]=..5',
      });
      expect(names(response.json())).toEqual(['Mørk og mild']);
    });

    it('filtrerer på enum-værdier', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages?attr[color]=dark',
      });
      expect(names(response.json())).toEqual(['Mørk og mild', 'Mørk og stærk']);
    });

    it('kombinerer flere attributfiltre med OG', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages?attr[color]=dark&attr[alcohol_percent]=5..10',
      });
      expect(names(response.json())).toEqual(['Mørk og stærk']);
    });

    it('filtrerer på kategori-slug', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages?categorySlug=vin',
      });
      expect(names(response.json())).toEqual(['Riesling']);
    });

    it('søger på tværs af navn og mærke', async () => {
      const response = await harness.request({ method: 'GET', url: '/api/v1/beverages?q=loosen' });
      expect(names(response.json())).toEqual(['Riesling']);
    });

    it('beregner facetter for det aktuelle filter', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/beverages/facets?categorySlug=oel',
      });
      const facets = response.json();
      expect(facets.types.find((bucket: { label: string }) => bucket.label === 'Stout').count).toBe(3);
      expect(facets.countries.map((bucket: { value: string }) => bucket.value).sort()).toEqual([
        'DK',
        'IE',
      ]);
    });
  });

  describe('dubletter', () => {
    it('afviser samme navn på samme mærke og årgang', async () => {
      const payload = {
        name: 'Samme navn',
        typeId: stoutTypeId,
        brandId,
        attributes: [{ definitionId: alcoholDefId, value: 5 }],
      };
      await createBeverage(payload);
      const duplicate = await createBeverage(payload, false);
      expect(duplicate.statusCode).toBe(409);
    });

    it('tillader samme navn på forskellige årgange', async () => {
      const base = {
        name: 'Årgangsvin',
        typeId: redWineTypeId,
        brandId: wineBrandId,
        attributes: [{ definitionId: alcoholDefId, value: 12 }],
      };
      expect((await createBeverage({ ...base, vintage: 2020 })).statusCode).toBe(201);
      expect((await createBeverage({ ...base, vintage: 2021 })).statusCode).toBe(201);
    });
  });
});
