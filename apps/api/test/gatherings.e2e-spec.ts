import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  registerUser,
  resetDatabase,
  startHarness,
  type AuthedUser,
  type TestHarness,
} from './harness';

/**
 * Arrangementer er logens eget rum. Testene herunder handler mest om hvem der
 * må se og røre hvad — det er dér en fejl ville gøre ondt, og det er ikke
 * noget typesystemet fanger.
 */
let harness: TestHarness;
let admin: AuthedUser;
let deltager: AuthedUser;
let udenfor: AuthedUser;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(async () => {
  await resetDatabase(harness.prisma);
  admin = await registerUser(harness, { role: 'ADMIN', displayName: 'Vært' });
  deltager = await registerUser(harness, { displayName: 'Deltager' });
  udenfor = await registerUser(harness, { displayName: 'Udenforstående' });
});

async function opretArrangement(kind = 'FESTIVAL', title = 'Ginfestival i Øksnehallen') {
  const response = await harness.request({
    method: 'POST',
    url: '/api/v1/gatherings',
    headers: admin.headers,
    payload: { kind, title },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; slug: string; attendees: { userId: string }[] }>();
}

async function inviter(id: string, user: AuthedUser) {
  const response = await harness.request({
    method: 'POST',
    url: `/api/v1/gatherings/${id}/attendees`,
    headers: admin.headers,
    payload: { userId: user.id },
  });
  expect(response.statusCode).toBe(201);
}

describe('Arrangementer — adgang', () => {
  it('svarer 404, ikke 403, til en der ikke er inviteret', async () => {
    const arrangement = await opretArrangement();

    const response = await harness.request({
      method: 'GET',
      url: `/api/v1/gatherings/${arrangement.slug}`,
      headers: udenfor.headers,
    });

    // 403 ville bekræfte at arrangementet findes. Hvem der holder hvad er
    // også en oplysning, så svaret skal være det samme som for noget der
    // slet ikke eksisterer.
    expect(response.statusCode).toBe(404);
  });

  it('holder det ude af listen for en der ikke er inviteret', async () => {
    await opretArrangement();

    const response = await harness.request({
      method: 'GET',
      url: '/api/v1/gatherings',
      headers: udenfor.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ items: unknown[] }>().items).toHaveLength(0);
  });

  it('lukker den inviterede ind', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);

    const response = await harness.request({
      method: 'GET',
      url: `/api/v1/gatherings/${arrangement.slug}`,
      headers: deltager.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json<{ viewer: { attendeeId: string | null } }>().viewer.attendeeId,
    ).not.toBeNull();
  });

  it('gør værten til deltager ved oprettelsen', async () => {
    const arrangement = await opretArrangement();
    // Ellers skulle den der holder smagningen invitere sig selv for at kunne
    // skrive en note.
    expect(arrangement.attendees.map((a) => a.userId)).toContain(admin.id);
  });

  it('lader ikke en almindelig bruger oprette arrangementer', async () => {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/gatherings',
      headers: deltager.headers,
      payload: { kind: 'TASTING', title: 'Min egen smagning' },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('Arrangementer — ting på listen', () => {
  it('tager imod en post der kun har et navn', async () => {
    const arrangement = await opretArrangement();
    await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { status: 'LIVE' },
    });

    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: admin.headers,
      // Til en festival smager man ting der ikke findes i kataloget endnu.
      payload: { label: 'Nordisk Gin, batch 4' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<{ items: { displayName: string; beverage: unknown }[] }>();
    expect(body.items[0].displayName).toBe('Nordisk Gin, batch 4');
    expect(body.items[0].beverage).toBeNull();
  });

  it('afviser en post uden både drikkevare og navn', async () => {
    const arrangement = await opretArrangement();
    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: admin.headers,
      payload: { blind: true },
    });
    expect(response.statusCode).toBe(422);
  });

  it('lader en deltager tilføje til en festival der er i gang', async () => {
    const arrangement = await opretArrangement('FESTIVAL');
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { status: 'LIVE' },
    });

    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: deltager.headers,
      payload: { label: 'Noget jeg fik stukket i hånden' },
    });

    expect(response.statusCode).toBe(201);
  });

  it('lader ikke en deltager tilføje til en smagning', async () => {
    const arrangement = await opretArrangement('TASTING', 'Rom-aften');
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { status: 'LIVE' },
    });

    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: deltager.headers,
      payload: { label: 'Min egen flaske' },
    });

    // Ved en smagning er rækkefølgen bestemt i forvejen; det er værten der
    // skænker.
    expect(response.statusCode).toBe(403);
  });
});

describe('Arrangementer — noter', () => {
  async function liveMedPost() {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: admin.headers,
      payload: { label: 'Nordisk Gin, batch 4' },
    });
    const live = await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { status: 'LIVE' },
    });
    const body = live.json<{ items: { id: string }[] }>();
    return { arrangement, itemId: body.items[0].id };
  }

  it('gemmer deltagerens note og markerer at vedkommende var med', async () => {
    const { arrangement, itemId } = await liveMedPost();

    const response = await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: deltager.headers,
      payload: { rating: 4.5, body: 'Overraskende blød' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      items: { averageRating: number | null; notes: { rating: number }[] }[];
      attendees: { userId: string; joinedAt: string | null }[];
    }>();
    expect(body.items[0].notes).toHaveLength(1);
    expect(body.items[0].averageRating).toBe(4.5);
    // joinedAt sættes ved første note — det er sådan "var med" adskiller sig
    // fra "blev inviteret, men kom ikke".
    expect(body.attendees.find((a) => a.userId === deltager.id)?.joinedAt).not.toBeNull();
  });

  it('afviser en note fra en der ikke er inviteret', async () => {
    const { arrangement, itemId } = await liveMedPost();

    const response = await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: udenfor.headers,
      payload: { rating: 5 },
    });

    expect(response.statusCode).toBe(404);
  });

  it('afviser noter før arrangementet er begyndt', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    const tilfoej = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/items`,
      headers: admin.headers,
      payload: { label: 'For tidligt' },
    });
    const itemId = tilfoej.json<{ items: { id: string }[] }>().items[0].id;

    const response = await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: deltager.headers,
      payload: { rating: 3 },
    });

    expect(response.statusCode).toBe(409);
  });

  it('afviser en bedømmelse der ikke er et halvt trin', async () => {
    const { arrangement, itemId } = await liveMedPost();
    const response = await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: deltager.headers,
      payload: { rating: 3.3 },
    });
    expect(response.statusCode).toBe(422);
  });

  it('fryser noterne når opslaget er udgivet', async () => {
    const { arrangement, itemId } = await liveMedPost();
    await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: deltager.headers,
      payload: { rating: 4 },
    });

    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/publish`,
      headers: admin.headers,
    });

    const response = await harness.request({
      method: 'PUT',
      url: `/api/v1/gatherings/${arrangement.id}/items/${itemId}/note`,
      headers: deltager.headers,
      payload: { rating: 1 },
    });

    // Uden den regel kunne "hvad vi syntes den aften" skrives om bagefter,
    // og så betyder opslaget ingenting.
    expect(response.statusCode).toBe(409);
  });
});

describe('Arrangementer — opslaget', () => {
  it('skjuler et uudgivet udkast for deltagerne, men ikke for admin', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { story: 'Sytten gin på fire timer.' },
    });

    const somDeltager = await harness.request({
      method: 'GET',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: deltager.headers,
    });
    expect(somDeltager.json<{ story: string | null }>().story).toBeNull();

    const somAdmin = await harness.request({
      method: 'GET',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
    });
    expect(somAdmin.json<{ story: string | null }>().story).toBe('Sytten gin på fire timer.');
  });

  it('viser teksten til deltagerne når den er udgivet', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'PATCH',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: admin.headers,
      payload: { story: 'Sytten gin på fire timer.' },
    });
    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/publish`,
      headers: admin.headers,
    });

    const response = await harness.request({
      method: 'GET',
      url: `/api/v1/gatherings/${arrangement.id}`,
      headers: deltager.headers,
    });
    expect(response.json<{ story: string | null }>().story).toBe('Sytten gin på fire timer.');
  });
});
