import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 flyttede forbindelses-URL'en ud af schema.prisma og hertil.
 * Runtime bruger driver-adapteren i `PrismaService`; denne URL er kun til CLI'en
 * (migrate, studio, seed).
 *
 * Datasource-blokken udelades når DATABASE_URL ikke er sat. Grunden er
 * `prisma generate`, som ikke har brug for en database overhovedet: den kører
 * som postinstall, og i CI og i Docker-builds findes der ingen .env. Med
 * `env('DATABASE_URL')` fejler konfigurationen allerede ved indlæsning, så
 * hele installationen falder — og det gjorde den.
 *
 * Kommandoer der faktisk skal bruge en database (migrate, studio, seed) fejler
 * stadig, men med Prismas egen besked om at datasource-URL'en mangler.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
