import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REFRESH_TOKEN_COOKIE } from '@maanslogen/contracts';
import { registerUser, resetDatabase, startHarness, type TestHarness } from './harness';

describe('Auth (e2e)', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await startHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await resetDatabase(harness.prisma);
  });

  it('opretter en konto og logger ind med det samme', async () => {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'ny@test.dk', displayName: 'Ny Bruger', password: 'Korrekt-Hest-7' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user.email).toBe('ny@test.dk');
    expect(body.user.role).toBe('USER');
    expect(body.tokens.accessToken).toBeTruthy();
    // Adgangskodehashen må aldrig forlade serveren.
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('afviser svage adgangskoder med feltfejl', async () => {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'svag@test.dk', displayName: 'Svag', password: 'kort' },
    });

    expect(response.statusCode).toBe(422);
    const problem = response.json();
    expect(problem.type).toContain('validation-failed');
    expect(problem.errors.password).toBeDefined();
  });

  it('afviser en e-mail der allerede er i brug', async () => {
    await registerUser(harness, { email: 'optaget@test.dk' });
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'optaget@test.dk', displayName: 'Anden', password: 'Korrekt-Hest-7' },
    });
    expect(response.statusCode).toBe(409);
  });

  it('giver samme fejl uanset om e-mailen findes', async () => {
    await registerUser(harness, { email: 'findes@test.dk', password: 'Korrekt-Hest-7' });

    const wrongPassword = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'findes@test.dk', password: 'Forkert-Hest-7' },
    });
    const unknownEmail = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'findes-ikke@test.dk', password: 'Forkert-Hest-7' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json().detail).toBe(unknownEmail.json().detail);
  });

  it('sætter tokens som httpOnly-cookies', async () => {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'cookie@test.dk', displayName: 'Cookie', password: 'Korrekt-Hest-7' },
    });

    const cookies = response.cookies as { name: string; httpOnly?: boolean }[];
    const refresh = cookies.find((cookie) => cookie.name === REFRESH_TOKEN_COOKIE);
    expect(refresh?.httpOnly).toBe(true);
  });

  it('roterer refresh-tokenet og invaliderer familien ved genbrug', async () => {
    const user = await registerUser(harness, { email: 'rotation@test.dk' });

    const login = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'Korrekt-Hest-7' },
    });
    const firstRefresh = login.json().tokens.refreshToken as string;

    const rotated = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: firstRefresh },
    });
    expect(rotated.statusCode).toBe(200);
    const secondRefresh = rotated.json().tokens.refreshToken as string;
    expect(secondRefresh).not.toBe(firstRefresh);

    // Genbrug af det gamle token betyder tyveri: hele familien dør.
    const replay = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: firstRefresh },
    });
    expect(replay.statusCode).toBe(401);

    const afterReplay = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: secondRefresh },
    });
    expect(afterReplay.statusCode).toBe(401);
  });

  it('invaliderer alle sessioner når adgangskoden skiftes', async () => {
    const user = await registerUser(harness, { email: 'skift@test.dk' });

    const change = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      headers: user.headers,
      payload: { currentPassword: 'Korrekt-Hest-7', newPassword: 'Helt-Nyt-Kodeord-9' },
    });
    expect(change.statusCode).toBe(204);

    // tokenVersion er bumpet, så det gamle access-token er værdiløst.
    const me = await harness.request({ method: 'GET', url: '/api/v1/auth/me', headers: user.headers });
    expect(me.statusCode).toBe(401);

    const login = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: 'Helt-Nyt-Kodeord-9' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('afviser /me uden token', async () => {
    const response = await harness.request({ method: 'GET', url: '/api/v1/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});
