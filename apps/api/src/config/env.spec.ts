import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';

const BASE = {
  DATABASE_URL: 'postgresql://localhost:5432/maanslogen',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_BUCKET: 'maanslogen-dev',
};

describe('loadConfig', () => {
  it('udfylder standardværdier', () => {
    const config = loadConfig(BASE);
    expect(config.PORT).toBe(4000);
    expect(config.ACCESS_TOKEN_TTL).toBe('15m');
    expect(config.CORS_ORIGINS).toEqual([]);
  });

  it('deler CORS_ORIGINS på komma', () => {
    const config = loadConfig({
      ...BASE,
      CORS_ORIGINS: 'http://localhost:3000, https://maanslogen.dk ',
    });
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://maanslogen.dk']);
  });

  it('kræver R2-nøgler når STORAGE_DRIVER=r2', () => {
    expect(() =>
      loadConfig({ ...BASE, STORAGE_DRIVER: 'r2' }),
    ).toThrowError(/R2_ACCOUNT_ID/);
  });

  it('accepterer en fuld R2-konfiguration', () => {
    const config = loadConfig({
      ...BASE,
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'maanslogen',
      R2_PUBLIC_BASE_URL: 'https://cdn.maanslogen.dk',
    });
    expect(config.STORAGE_DRIVER).toBe('r2');
  });

  it('afviser korte JWT-hemmeligheder', () => {
    expect(() =>
      loadConfig({ ...BASE, JWT_ACCESS_SECRET: 'kort' }),
    ).toThrowError(/mindst 32 tegn/);
  });

  it('afviser udviklingshemmeligheder i produktion', () => {
    expect(() =>
      loadConfig({
        ...BASE,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://maanslogen.dk',
        JWT_ACCESS_SECRET: `dev-access-secret-${'x'.repeat(30)}`,
      }),
    ).toThrowError(/udviklingsværdi/);
  });

  it('kræver eksplicit CORS i produktion', () => {
    expect(() =>
      loadConfig({ ...BASE, NODE_ENV: 'production' }),
    ).toThrowError(/CORS_ORIGINS/);
  });

  it('afviser ugyldige varigheder', () => {
    expect(() =>
      loadConfig({ ...BASE, ACCESS_TOKEN_TTL: '15 minutter' }),
    ).toThrowError(/Varighed/);
  });
});
