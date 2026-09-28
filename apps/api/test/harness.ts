import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/bootstrap';
import { PrismaService } from '../src/common/prisma/prisma.service';

export interface TestHarness {
  app: NestFastifyApplication;
  prisma: PrismaService;
  /** Fastify inject: ingen porte, ingen netværk — men hele middleware-kæden. */
  request: NestFastifyApplication['inject'];
  close: () => Promise<void>;
}

export async function startHarness(): Promise<TestHarness> {
  const app = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    request: app.inject.bind(app),
    close: async () => {
      await app.close();
    },
  };
}

/** Tømmer alle tabeller. Rækkefølgen følger fremmednøglerne. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      gathering_notes, gathering_items, gathering_attendees, gatherings,
      review_answers, reviews,
      beverage_attribute_values, beverages,
      attribute_definitions, questions,
      beverage_types, brands, beverage_categories,
      media_renditions, media_assets, pending_uploads,
      refresh_tokens, users
    RESTART IDENTITY CASCADE
  `);
}

export interface AuthedUser {
  id: string;
  email: string;
  accessToken: string;
  headers: Record<string, string>;
}

export async function registerUser(
  harness: TestHarness,
  overrides: {
    email?: string;
    displayName?: string;
    password?: string;
    role?: 'USER' | 'MODERATOR' | 'ADMIN';
  } = {},
): Promise<AuthedUser> {
  const email = overrides.email ?? `bruger-${Math.random().toString(36).slice(2, 10)}@test.dk`;
  const password = overrides.password ?? 'Korrekt-Hest-7';

  const response = await harness.request({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, displayName: overrides.displayName ?? 'Testbruger', password },
  });
  const body = response.json<{ user: { id: string }; tokens: { accessToken: string } }>();

  // Roller tildeles ikke via registrering — den vej ind findes ikke.
  if (overrides.role && overrides.role !== 'USER') {
    await harness.prisma.user.update({
      where: { id: body.user.id },
      data: { role: overrides.role },
    });
    const relogin = await harness.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const fresh = relogin.json<{ tokens: { accessToken: string } }>();
    return {
      id: body.user.id,
      email,
      accessToken: fresh.tokens.accessToken,
      headers: { authorization: `Bearer ${fresh.tokens.accessToken}` },
    };
  }

  return {
    id: body.user.id,
    email,
    accessToken: body.tokens.accessToken,
    headers: { authorization: `Bearer ${body.tokens.accessToken}` },
  };
}
