import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  registerUser,
  resetDatabase,
  startHarness,
  type AuthedUser,
  type TestHarness,
} from './harness';

describe('Katalog (e2e)', () => {
  let harness: TestHarness;
  let admin: AuthedUser;
  let moderator: AuthedUser;
  let member: AuthedUser;

  beforeAll(async () => {
    harness = await startHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await resetDatabase(harness.prisma);
    admin = await registerUser(harness, { role: 'ADMIN' });
    moderator = await registerUser(harness, { role: 'MODERATOR' });
    member = await registerUser(harness);
  });

  async function createCategory(name = 'Øl', headers = moderator.headers) {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/categories',
      headers,
      payload: { name, icon: '🍺', sortOrder: 1 },
    });
    return response;
  }

  describe('adgangskontrol', () => {
    it('lader alle læse kataloget', async () => {
      const response = await harness.request({ method: 'GET', url: '/api/v1/categories' });
      expect(response.statusCode).toBe(200);
    });

    it('afviser anonym oprettelse', async () => {
      const response = await harness.request({
        method: 'POST',
        url: '/api/v1/categories',
        payload: { name: 'Hack' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('afviser en almindelig bruger', async () => {
      const response = await createCategory('Vin', member.headers);
      expect(response.statusCode).toBe(403);
      expect(response.json().detail).toContain('MODERATOR');
    });

    it('tillader en moderator', async () => {
      expect((await createCategory()).statusCode).toBe(201);
    });

    it('kræver ADMIN for sletning', async () => {
      const category = (await createCategory()).json();
      const asModerator = await harness.request({
        method: 'DELETE',
        url: `/api/v1/categories/${category.id}`,
        headers: moderator.headers,
      });
      expect(asModerator.statusCode).toBe(403);

      const asAdmin = await harness.request({
        method: 'DELETE',
        url: `/api/v1/categories/${category.id}`,
        headers: admin.headers,
      });
      expect(asAdmin.statusCode).toBe(204);
    });
  });

  describe('slugs', () => {
    it('udleder et slug fra navnet og håndterer danske tegn', async () => {
      const response = await harness.request({
        method: 'POST',
        url: '/api/v1/categories',
        headers: moderator.headers,
        payload: { name: 'Hvedeøl fra Århus' },
      });
      expect(response.json().slug).toBe('hvedeoel-fra-aarhus');
    });

    it('tilføjer et suffiks når slug’et er optaget', async () => {
      await createCategory('Øl');
      const second = await harness.request({
        method: 'POST',
        url: '/api/v1/categories',
        headers: moderator.headers,
        payload: { name: 'Øl' },
      });
      expect(second.json().slug).toBe('oel-2');
    });

    it('kan slås op på både id og slug', async () => {
      const category = (await createCategory()).json();
      const bySlug = await harness.request({ method: 'GET', url: '/api/v1/categories/oel' });
      const byId = await harness.request({
        method: 'GET',
        url: `/api/v1/categories/${category.id}`,
      });
      expect(bySlug.statusCode).toBe(200);
      expect(byId.statusCode).toBe(200);
      expect(bySlug.json().id).toBe(byId.json().id);
    });

    it('giver 404 — ikke 500 — for et ukendt slug', async () => {
      // Et ikke-UUID mod en uuid-kolonne får ellers Postgres til at fejle på castet.
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/categories/findes-ikke',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().type).toContain('not-found');
    });
  });

  describe('referentiel integritet', () => {
    it('nægter at arkivere en kategori med aktive typer', async () => {
      const category = (await createCategory()).json();
      await harness.request({
        method: 'POST',
        url: '/api/v1/types',
        headers: moderator.headers,
        payload: { categoryId: category.id, name: 'Stout' },
      });

      const response = await harness.request({
        method: 'DELETE',
        url: `/api/v1/categories/${category.id}`,
        headers: admin.headers,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().detail).toContain('aktive typer');
    });

    it('afviser en type i en ukendt kategori', async () => {
      const response = await harness.request({
        method: 'POST',
        url: '/api/v1/types',
        headers: moderator.headers,
        payload: { categoryId: '00000000-0000-4000-8000-000000000000', name: 'Stout' },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().errors.categoryId).toBeDefined();
    });

    it('afviser to typer med samme navn i samme kategori', async () => {
      const category = (await createCategory()).json();
      const payload = { categoryId: category.id, name: 'Stout' };
      await harness.request({
        method: 'POST',
        url: '/api/v1/types',
        headers: moderator.headers,
        payload,
      });
      const duplicate = await harness.request({
        method: 'POST',
        url: '/api/v1/types',
        headers: moderator.headers,
        payload,
      });
      expect(duplicate.statusCode).toBe(409);
    });
  });

  describe('paginering', () => {
    beforeEach(async () => {
      for (let index = 0; index < 7; index += 1) {
        await harness.request({
          method: 'POST',
          url: '/api/v1/categories',
          headers: moderator.headers,
          payload: { name: `Kategori ${index}`, sortOrder: index },
        });
      }
    });

    it('bladrer gennem alle rækker uden dubletter', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 10; page += 1) {
        const url: string = `/api/v1/categories?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const response = await harness.request({ method: 'GET', url });
        const body = response.json();
        seen.push(...body.items.map((item: { id: string }) => item.id));
        cursor = body.pageInfo.nextCursor;
        if (!cursor) break;
      }

      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
    });

    it('udelader total med mindre der spørges om den', async () => {
      const without = await harness.request({ method: 'GET', url: '/api/v1/categories?limit=2' });
      expect(without.json().pageInfo.total).toBeNull();

      const withTotal = await harness.request({
        method: 'GET',
        url: '/api/v1/categories?limit=2&withTotal=true',
      });
      expect(withTotal.json().pageInfo.total).toBe(7);
    });

    it('afviser en limit over maksimum', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/categories?limit=5000',
      });
      expect(response.statusCode).toBe(422);
    });

    it('afviser en ødelagt cursor med 400, ikke 500', async () => {
      const response = await harness.request({
        method: 'GET',
        url: '/api/v1/categories?cursor=%%%',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
