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
  S3_PRIVATE_BUCKET: 'maanslogen-privat-dev',
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

  it('behandler en tom COOKIE_DOMAIN som fraværende', () => {
    // docker compose indsætter "" for en variabel der ikke står i env-filen.
    // Den må ikke ende som et tomt `Domain=` i Set-Cookie.
    expect(loadConfig({ ...BASE, COOKIE_DOMAIN: '' }).COOKIE_DOMAIN).toBeUndefined();
    expect(loadConfig(BASE).COOKIE_DOMAIN).toBeUndefined();
    expect(loadConfig({ ...BASE, COOKIE_DOMAIN: '.eksempel.dk' }).COOKIE_DOMAIN).toBe(
      '.eksempel.dk',
    );
  });

  describe('COOKIE_DOMAIN og CORS skal passe sammen', () => {
    /**
     * COOKIE_DOMAIN er normalt usat, og så er sessionen host-only pr. vært.
     * Sættes den for at dele sessionen mellem værter, skal hvert site ligge
     * under domænet — ellers modtager sitet aldrig sessionen, og brugeren
     * bliver sendt til login igen og igen uden at noget fejler synligt.
     * Billigere at opdage ved opstart.
     */
    it('afviser et site uden for cookiens domæne', () => {
      expect(() =>
        loadConfig({
          ...BASE,
          COOKIE_DOMAIN: 'maanslogen.com',
          CORS_ORIGINS: 'https://maanslogen-web.eksempel.workers.dev',
        }),
      ).toThrowError(/uden for COOKIE_DOMAIN/);
    });

    it('accepterer værter under domænet', () => {
      const config = loadConfig({
        ...BASE,
        COOKIE_DOMAIN: 'maanslogen.com',
        CORS_ORIGINS: 'https://maanslogen.com,https://arrangement.maanslogen.com',
      });
      expect(config.COOKIE_DOMAIN).toBe('maanslogen.com');
    });

    it('accepterer domænet selv, og en indledende prik', () => {
      expect(() =>
        loadConfig({
          ...BASE,
          COOKIE_DOMAIN: '.maanslogen.com',
          CORS_ORIGINS: 'https://maanslogen.com',
        }),
      ).not.toThrow();
    });

    it('lader sig ikke narre af et domæne der blot ender ens', () => {
      // "ikke-maanslogen.com" ender på "maanslogen.com" som streng, men er et
      // andet domæne. Uden prikken i sammenligningen ville det slippe igennem.
      expect(() =>
        loadConfig({
          ...BASE,
          COOKIE_DOMAIN: 'maanslogen.com',
          CORS_ORIGINS: 'https://ikke-maanslogen.com',
        }),
      ).toThrowError(/uden for COOKIE_DOMAIN/);
    });

    it('rører ikke ved noget når COOKIE_DOMAIN ikke er sat', () => {
      expect(() =>
        loadConfig({ ...BASE, CORS_ORIGINS: 'https://hvad-som-helst.example' }),
      ).not.toThrow();
    });
  });

  it('kræver R2-nøgler når STORAGE_DRIVER=r2', () => {
    expect(() => loadConfig({ ...BASE, STORAGE_DRIVER: 'r2' })).toThrowError(/R2_ACCOUNT_ID/);
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
      R2_PRIVATE_BUCKET: 'maanslogen-privat',
    });
    expect(config.STORAGE_DRIVER).toBe('r2');
  });

  it('afviser korte JWT-hemmeligheder', () => {
    expect(() => loadConfig({ ...BASE, JWT_ACCESS_SECRET: 'kort' })).toThrowError(/mindst 32 tegn/);
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
    expect(() => loadConfig({ ...BASE, NODE_ENV: 'production' })).toThrowError(/CORS_ORIGINS/);
  });

  it('afviser ugyldige varigheder', () => {
    expect(() => loadConfig({ ...BASE, ACCESS_TOKEN_TTL: '15 minutter' })).toThrowError(/Varighed/);
  });
});
