import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  registerUser,
  resetDatabase,
  startHarness,
  type AuthedUser,
  type TestHarness,
} from './harness';

/**
 * En note fra en aften kan blive til skriverens anmeldelse af drikkevaren.
 *
 * Den regel der betyder noget, er den der *ikke* gør noget: har man allerede
 * anmeldt drikkevaren, bliver den gamle anmeldelse stående. `Review` har
 * @@unique([userId, beverageId]), så der kan kun være én, og den er en stående
 * dom — ikke en enkelt aften. Det kan en typecheck ikke sige noget om, og en
 * mock heller ikke: det er constraint'et og rækkefølgen der skal bevises.
 */
let harness: TestHarness;
let admin: AuthedUser;
let jonas: AuthedUser;
let sara: AuthedUser;

let beverageId: string;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(async () => {
  await resetDatabase(harness.prisma);
  admin = await registerUser(harness, { role: 'ADMIN', displayName: 'Vært' });
  jonas = await registerUser(harness, { displayName: 'Jonas' });
  sara = await registerUser(harness, { displayName: 'Sara' });

  const kategoriId = (await post('/api/v1/categories', { name: 'Spiritus' })).id;
  const typeId = (await post('/api/v1/types', { categoryId: kategoriId, name: 'Gin' })).id;
  const brandId = (await post('/api/v1/brands', { name: 'Hernö' })).id;
  beverageId = (await post('/api/v1/beverages', { name: 'Hernö Old Tom', typeId, brandId })).id;
});

async function post(url: string, payload: Record<string, unknown>, bruger?: AuthedUser) {
  const response = await harness.request({
    method: 'POST',
    url,
    headers: (bruger ?? admin).headers,
    payload,
  });
  if (response.statusCode >= 400) throw new Error(`${url}: ${response.body}`);
  return response.json<{ id: string; slug: string }>();
}

async function patch(url: string, payload: Record<string, unknown>) {
  const response = await harness.request({
    method: 'PATCH',
    url,
    headers: admin.headers,
    payload,
  });
  if (response.statusCode >= 400) throw new Error(`${url}: ${response.body}`);
  return response.json();
}

interface Post {
  id: string;
  notes: { attendeeId: string; rating: number; reviewId: string | null }[];
}

interface Arrangement {
  id: string;
  items: Post[];
  attendees: { id: string; userId: string }[];
}

/**
 * Et arrangement der er i gang, med Jonas og Sara med, og én post.
 * `medDrikkevare` afgør om posten er knyttet til kataloget fra start.
 */
async function arrangementIGang(medDrikkevare: boolean): Promise<Arrangement> {
  const oprettet = await post('/api/v1/gatherings', {
    kind: 'FESTIVAL',
    title: 'Ginsmagning i kælderen',
  });
  for (const bruger of [jonas, sara]) {
    await post(`/api/v1/gatherings/${oprettet.id}/attendees`, { userId: bruger.id });
  }
  await patch(`/api/v1/gatherings/${oprettet.id}`, { status: 'LIVE' });
  await post(
    `/api/v1/gatherings/${oprettet.id}/items`,
    medDrikkevare ? { beverageId } : { label: 'Nummer to' },
  );
  return hent(oprettet.id);
}

async function hent(id: string): Promise<Arrangement> {
  const response = await harness.request({
    method: 'GET',
    url: `/api/v1/gatherings/${id}`,
    headers: admin.headers,
  });
  expect(response.statusCode).toBe(200);
  return response.json<Arrangement>();
}

function foersteTing(arrangement: Arrangement): Post {
  const [foerste] = arrangement.items;
  if (foerste === undefined) throw new Error('Arrangementet har ingen poster');
  return foerste;
}

async function skrivNote(gatheringId: string, itemId: string, bruger: AuthedUser, rating: number) {
  const response = await harness.request({
    method: 'PUT',
    url: `/api/v1/gatherings/${gatheringId}/items/${itemId}/note`,
    headers: bruger.headers,
    payload: { rating, body: `Noten fra ${bruger.id}` },
  });
  if (response.statusCode >= 400) throw new Error(`note: ${response.body}`);
}

async function udgiv(gatheringId: string) {
  const response = await harness.request({
    method: 'POST',
    url: `/api/v1/gatherings/${gatheringId}/publish`,
    headers: admin.headers,
  });
  expect(response.statusCode).toBe(200);
}

async function anmeldelserFor(userId: string) {
  return harness.prisma.review.findMany({ where: { userId, beverageId } });
}

describe('Noter bliver til anmeldelser', () => {
  it('gør noten til en anmeldelse ved udgivelsen', async () => {
    const arrangement = await arrangementIGang(true);
    await skrivNote(arrangement.id, foersteTing(arrangement).id, jonas, 4.5);

    // Før udgivelsen: ingenting. Noten kan stadig rettes, og en anmeldelse
    // man ikke kan stå ved, er ikke en anmeldelse.
    expect(await anmeldelserFor(jonas.id)).toHaveLength(0);

    await udgiv(arrangement.id);

    const anmeldelser = await anmeldelserFor(jonas.id);
    expect(anmeldelser).toHaveLength(1);
    expect(anmeldelser[0]?.rating).toBe(4.5);

    // Noten peger på anmeldelsen, så fladen kan se forskel på de to tilfælde.
    const efter = await hent(arrangement.id);
    expect(foersteTing(efter).notes[0]?.reviewId).toBe(anmeldelser[0]?.id);
  });

  it('lader den stående anmeldelse være i fred, og noten blive en note', async () => {
    // Jonas har allerede sagt hvad han mener om den.
    await post('/api/v1/reviews', { beverageId, rating: 2, body: 'Ikke min kop te' }, jonas);

    const arrangement = await arrangementIGang(true);
    await skrivNote(arrangement.id, foersteTing(arrangement).id, jonas, 5);
    await udgiv(arrangement.id);

    const anmeldelser = await anmeldelserFor(jonas.id);
    expect(anmeldelser).toHaveLength(1);
    // Stadig toeren. En aften skriver ikke en stående dom om.
    expect(anmeldelser[0]?.rating).toBe(2);
    expect(anmeldelser[0]?.body).toBe('Ikke min kop te');

    const efter = await hent(arrangement.id);
    const note = foersteTing(efter).notes.find((n) => n.rating === 5);
    expect(note?.reviewId).toBeNull();
  });

  it('rører ikke poster der ikke er i kataloget', async () => {
    const arrangement = await arrangementIGang(false);
    await skrivNote(arrangement.id, foersteTing(arrangement).id, jonas, 4);
    await udgiv(arrangement.id);

    expect(await harness.prisma.review.count({ where: { userId: jonas.id } })).toBe(0);
    const efter = await hent(arrangement.id);
    expect(foersteTing(efter).notes[0]?.reviewId).toBeNull();
  });

  it('tager noterne med når posten knyttes til kataloget bagefter', async () => {
    // Det almindelige forløb: man skrev «Nummer to» på skiltet og finder
    // først drikkevaren frem hjemme i sofaen.
    const arrangement = await arrangementIGang(false);
    const ting = foersteTing(arrangement);
    await skrivNote(arrangement.id, ting.id, jonas, 4);
    await skrivNote(arrangement.id, ting.id, sara, 3.5);
    await udgiv(arrangement.id);

    expect(await harness.prisma.review.count()).toBe(0);

    await patch(`/api/v1/gatherings/${arrangement.id}/items/${ting.id}`, { beverageId });

    expect(await anmeldelserFor(jonas.id)).toHaveLength(1);
    expect(await anmeldelserFor(sara.id)).toHaveLength(1);
  });

  it('laver ikke dubletter når der udgives igen', async () => {
    const arrangement = await arrangementIGang(true);
    await skrivNote(arrangement.id, foersteTing(arrangement).id, jonas, 4);
    await udgiv(arrangement.id);

    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/unpublish`,
      headers: admin.headers,
    });
    expect(response.statusCode).toBe(200);
    await udgiv(arrangement.id);

    // Unikhedskravet ville kaste hvis vi prøvede igen. At der stadig er én,
    // er beviset på at `reviewId: null` i filteret gør den idempotent.
    expect(await anmeldelserFor(jonas.id)).toHaveLength(1);
  });

  it('tæller de omdannede noter med i drikkevarens bedømmelse', async () => {
    const arrangement = await arrangementIGang(true);
    const ting = foersteTing(arrangement);
    await skrivNote(arrangement.id, ting.id, jonas, 5);
    await skrivNote(arrangement.id, ting.id, sara, 4);
    await udgiv(arrangement.id);

    const drikkevare = await harness.prisma.beverage.findUniqueOrThrow({
      where: { id: beverageId },
      select: { ratingAverage: true, ratingCount: true },
    });
    expect(drikkevare.ratingCount).toBe(2);
    expect(drikkevare.ratingAverage).toBe(4.5);
  });
});
