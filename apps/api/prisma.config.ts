import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 flyttede forbindelses-URL'en ud af schema.prisma og hertil.
 * Runtime bruger driver-adapteren i `PrismaService`; denne URL er kun til CLI'en
 * (migrate, studio, seed).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
