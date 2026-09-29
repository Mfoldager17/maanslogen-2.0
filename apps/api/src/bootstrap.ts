import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import qs from 'qs';
import { AppModule } from './app.module';
import { CONFIG, type AppConfig } from './config/env';

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Fastify genererer ellers sine egne id'er; pino-loggeren sætter vores.
      genReqId: () => crypto.randomUUID(),
      bodyLimit: 2 * 1024 * 1024,
      trustProxy: true,
      routerOptions: {
        /**
         * Standardparseren forstår ikke `attr[alcohol_percent]=5..9` og ville
         * aflevere det som én flad nøgle — hvorefter attributfiltrene stiltiende
         * ikke gjorde noget. `depth: 2` er rigeligt til `attr[nøgle]` og holder
         * samtidig dybt indlejrede input ude.
         */
        querystringParser: (search) =>
          qs.parse(search, { depth: 2, parameterLimit: 100, arrayLimit: 50 }),
      },
    }),
    { bufferLogs: true },
  );

  const config = app.get<AppConfig>(CONFIG);
  app.useLogger(app.get(Logger));

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // API'et serverer ikke HTML ud over Swagger-UI.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(fastifyCompress, { encodings: ['br', 'gzip'] });
  await app.register(fastifyCookie);

  app.enableCors({
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    credentials: true,
    // Skal dække hver metode webklienten kan sende (ApiRequest i
    // apps/web/src/lib/api/client.ts). Mangler en, blokerer browseren kaldet i
    // preflight, og fejlen når aldrig frem som et HTTP-svar — den ser ud som
    // om serveren er nede. Holdes i sync af cors-metoder.spec.ts.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  });

  // Versionering fra dag ét: /api/v1/... En breaking change kan udgives
  // side om side i stedet for at kræve at alle klienter opdaterer samtidig.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Ingen global ValidationPipe: al validering går gennem ZodValidationPipe med
  // de delte skemaer. To valideringssystemer side om side betyder to steder at
  // glemme en regel — og class-validator ville være en afhængighed uden formål.

  app.enableShutdownHooks();
  return app;
}

export function setupOpenApi(
  app: NestFastifyApplication,
): ReturnType<typeof SwaggerModule.createDocument> {
  const documentConfig = new DocumentBuilder()
    .setTitle('Maanslogen API')
    .setDescription(
      [
        'API til Maanslogen 2.0 — anmeldelser af drikkevarer med dynamiske attributter og spørgsmål.',
        '',
        '**Autentificering**: `POST /api/v1/auth/login` giver et access-token (Bearer) og sætter et httpOnly refresh-cookie.',
        '**Fejl**: alle fejl returneres som RFC 9457 Problem Details (`application/problem+json`).',
        '**Paginering**: alle lister bruger cursor-paginering — send `pageInfo.nextCursor` tilbage som `cursor`.',
      ].join('\n'),
    )
    .setVersion('2.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addServer('http://localhost:4000', 'Lokal udvikling')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });
  return document;
}
