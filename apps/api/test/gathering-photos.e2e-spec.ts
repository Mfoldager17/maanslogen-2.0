import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  registerUser,
  resetDatabase,
  startHarness,
  type AuthedUser,
  type TestHarness,
} from './harness';

/**
 * Billederne ligger i en privat bucket, og URL'en til dem er en signatur der
 * udstedes ved hvert svar. Testene herunder handler derfor mest om hvem der
 * kan få den signatur — det er dér en fejl ville betyde at et billede fra en
 * smagning kunne hentes af nogen der ikke var med.
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

async function opretArrangement() {
  const response = await harness.request({
    method: 'POST',
    url: '/api/v1/gatherings',
    headers: admin.headers,
    payload: { kind: 'FESTIVAL', title: 'Ginfestival' },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; slug: string }>();
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

async function presign(id: string, user: AuthedUser) {
  return harness.request({
    method: 'POST',
    url: `/api/v1/gatherings/${id}/photos/presign`,
    headers: user.headers,
    payload: { contentType: 'image/jpeg' },
  });
}

/** Presign + knyt, som klienten gør det efter selve uploaden. */
async function laegOp(id: string, user: AuthedUser, caption?: string) {
  const signeret = await presign(id, user);
  expect(signeret.statusCode).toBe(201);
  const { storageKey } = signeret.json<{ storageKey: string }>();

  const knyttet = await harness.request({
    method: 'POST',
    url: `/api/v1/gatherings/${id}/photos`,
    headers: user.headers,
    payload: { storageKey, ...(caption ? { caption } : {}) },
  });
  return { knyttet, storageKey };
}

describe('Arrangementsbilleder — hvem får en signatur', () => {
  it('giver ikke en uinviteret en upload-URL', async () => {
    const arrangement = await opretArrangement();
    const response = await presign(arrangement.id, udenfor);
    // 404, ikke 403: et 403 ville bekræfte at arrangementet findes.
    expect(response.statusCode).toBe(404);
  });

  it('lader en deltager lægge et billede op', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);

    const { knyttet } = await laegOp(arrangement.id, deltager, 'Opstillingen');
    expect(knyttet.statusCode).toBe(201);

    const body = knyttet.json<{ photos: { caption: string | null; url: string }[] }>();
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0]?.caption).toBe('Opstillingen');
  });

  it('svarer med en signeret URL, ikke en rå nøgle', async () => {
    const arrangement = await opretArrangement();
    const { knyttet } = await laegOp(arrangement.id, admin);

    const foto = knyttet.json<{ photos: { url: string; urlExpiresAt: string }[] }>().photos[0];
    // Uden signaturen ville adressen virke for enhver der fik den at se, og
    // så var den private bucket ikke privat.
    expect(foto?.url).toMatch(/X-Amz-Signature=/);
    expect(foto?.url).toMatch(/X-Amz-Expires=/);
    expect(new Date(foto?.urlExpiresAt ?? 0).getTime()).toBeGreaterThan(Date.now());
  });

  it('udleverer ikke nøglen i svaret', async () => {
    const arrangement = await opretArrangement();
    const { knyttet, storageKey } = await laegOp(arrangement.id, admin);

    // Nøglen står i URL'ens sti, men må ikke stå som sit eget felt: så ville
    // den kunne bruges til at konstruere adresser til andre objekter bagefter.
    const raekke = knyttet.json<{ photos: Record<string, unknown>[] }>().photos[0] ?? {};
    expect(Object.keys(raekke)).not.toContain('storageKey');
    expect(storageKey.startsWith('arrangementer/')).toBe(true);
  });
});

describe('Arrangementsbilleder — nøglen', () => {
  it('afviser en nøgle fra et andet arrangement', async () => {
    const et = await opretArrangement();
    const andet = await harness
      .request({
        method: 'POST',
        url: '/api/v1/gatherings',
        headers: admin.headers,
        payload: { kind: 'TASTING', title: 'Rom-aften' },
      })
      .then((r) => r.json<{ id: string }>());

    const signeret = await presign(andet.id, admin);
    const { storageKey } = signeret.json<{ storageKey: string }>();

    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${et.id}/photos`,
      headers: admin.headers,
      payload: { storageKey },
    });

    // Ellers kunne man knytte et billede fra et arrangement man er med i, til
    // et andet — og dermed få en signeret URL til noget man ikke måtte se.
    expect(response.statusCode).toBe(400);
  });

  it('afviser en nøgle klienten har fundet på selv', async () => {
    const arrangement = await opretArrangement();
    const response = await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/photos`,
      headers: admin.headers,
      payload: { storageKey: 'media/2026/01/noget-andet.jpg' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('Arrangementsbilleder — hvem må fjerne', () => {
  it('lader den der lagde det op fjerne det igen', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    const { knyttet } = await laegOp(arrangement.id, deltager);
    const photoId = knyttet.json<{ photos: { id: string }[] }>().photos[0]?.id;

    const response = await harness.request({
      method: 'DELETE',
      url: `/api/v1/gatherings/${arrangement.id}/photos/${photoId}`,
      headers: deltager.headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ photos: unknown[] }>().photos).toHaveLength(0);
  });

  it('lader ikke en deltager fjerne en andens billede', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    const { knyttet } = await laegOp(arrangement.id, admin);
    const photoId = knyttet.json<{ photos: { id: string }[] }>().photos[0]?.id;

    const response = await harness.request({
      method: 'DELETE',
      url: `/api/v1/gatherings/${arrangement.id}/photos/${photoId}`,
      headers: deltager.headers,
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('Arrangementsbilleder — udgivelse', () => {
  it('lukker for flere billeder når opslaget er udgivet', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/publish`,
      headers: admin.headers,
    });

    const response = await presign(arrangement.id, deltager);
    expect(response.statusCode).toBe(403);
  });

  it('fryser også deltagerens eget billede når opslaget er udgivet', async () => {
    const arrangement = await opretArrangement();
    await inviter(arrangement.id, deltager);
    const { knyttet } = await laegOp(arrangement.id, deltager);
    const photoId = knyttet.json<{ photos: { id: string }[] }>().photos[0]?.id;

    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/publish`,
      headers: admin.headers,
    });

    const response = await harness.request({
      method: 'DELETE',
      url: `/api/v1/gatherings/${arrangement.id}/photos/${photoId}`,
      headers: deltager.headers,
    });

    // Man må fjerne sit eget — men ikke efter at opslaget er sendt ud. Så er
    // det historik, på linje med noterne.
    expect(response.statusCode).toBe(409);
  });

  it('lader admin lægge til alligevel — admin kan jo låse op', async () => {
    const arrangement = await opretArrangement();
    await harness.request({
      method: 'POST',
      url: `/api/v1/gatherings/${arrangement.id}/publish`,
      headers: admin.headers,
    });

    const { knyttet } = await laegOp(arrangement.id, admin);
    expect(knyttet.statusCode).toBe(201);
  });
});
