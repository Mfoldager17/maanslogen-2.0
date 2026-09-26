import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IMMUTABLE_CACHE_CONTROL, MEDIA_VARIANT_SIZES } from '@maanslogen/contracts';
import {
  registerUser,
  resetDatabase,
  startHarness,
  type AuthedUser,
  type TestHarness,
} from './harness';

describe('Medier og upload (e2e)', () => {
  let harness: TestHarness;
  let user: AuthedUser;

  beforeAll(async () => {
    harness = await startHarness();
  });
  afterAll(async () => {
    await harness.close();
  });
  beforeEach(async () => {
    await resetDatabase(harness.prisma);
    user = await registerUser(harness);
  });

  async function presign(payload: Record<string, unknown>, headers = user.headers) {
    return harness.request({ method: 'POST', url: '/api/v1/media/presign', headers, payload });
  }

  it('kræver login', async () => {
    const response = await harness.request({
      method: 'POST',
      url: '/api/v1/media/presign',
      payload: { ownerType: 'BEVERAGE', variants: ['CARD'], contentType: 'image/webp' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('udsteder én URL pr. variant med de rigtige mål', async () => {
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['THUMB', 'CARD', 'FULL'],
      contentType: 'image/webp',
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.uploads).toHaveLength(3);

    for (const upload of body.uploads) {
      const expected = MEDIA_VARIANT_SIZES[upload.variant as keyof typeof MEDIA_VARIANT_SIZES];
      expect(upload.width).toBe(expected.width);
      expect(upload.height).toBe(expected.height);
    }
  });

  it('beder klienten sætte en uforanderlig Cache-Control på hvert upload', async () => {
    // Uden denne header serverer R2 filen uden cache-instruks, og hver eneste
    // visning bliver en Class B-operation i stedet for et cache-hit.
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['CARD'],
      contentType: 'image/webp',
    });

    const upload = response.json().uploads[0];
    expect(upload.headers['cache-control']).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(upload.headers['content-type']).toBe('image/webp');
    // Et år, og markeret immutable: nøglen overskrives aldrig.
    expect(upload.headers['cache-control']).toContain('immutable');
    expect(upload.headers['cache-control']).toContain('max-age=31536000');
  });

  it('lader klienten bestemme hverken bucket eller sti', async () => {
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['CARD'],
      contentType: 'image/webp',
    });

    const upload = response.json().uploads[0];
    // Nøglen dannes i backenden: ejer-type / år / måned / asset-uuid / variant.
    expect(upload.storageKey).toMatch(/^beverage\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/card\.webp$/);
  });

  it('giver alle varianter samme asset-mappe', async () => {
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['THUMB', 'CARD'],
      contentType: 'image/webp',
    });

    const folders = response
      .json()
      .uploads.map((upload: { storageKey: string }) =>
        upload.storageKey.split('/').slice(0, -1).join('/'),
      );
    expect(new Set(folders).size).toBe(1);
  });

  it('afviser filtyper vi ikke serverer', async () => {
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['CARD'],
      contentType: 'image/gif',
    });
    expect(response.statusCode).toBe(422);
  });

  it('registrerer nøglerne som afventende, så uafhentede uploads kan ryddes op', async () => {
    const response = await presign({
      ownerType: 'BEVERAGE',
      variants: ['THUMB', 'CARD'],
      contentType: 'image/webp',
    });

    const keys = response.json().uploads.map((upload: { storageKey: string }) => upload.storageKey);
    const pending = await harness.prisma.pendingUpload.findMany({
      where: { storageKey: { in: keys } },
    });
    expect(pending).toHaveLength(2);
    expect(pending.every((row) => row.expiresAt.getTime() > Date.now())).toBe(true);
  });
});
