import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ConfigModule } from './config/config.module';
import { CONFIG, loadConfig, type AppConfig } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { ProblemDetailsFilter } from './common/http/problem-details.filter';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AttributeModule } from './modules/attributes/attribute.module';
import { BeverageModule } from './modules/beverages/beverage.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { QuestionModule } from './modules/questions/question.module';
import { ReviewModule } from './modules/reviews/review.module';
import { UserModule } from './modules/users/user.module';

/** `pino-pretty` hvis den er installeret, ellers almindelig JSON-logning. */
function prettyTransport(nodeEnv: AppConfig['NODE_ENV']) {
  if (nodeEnv === 'production') return undefined;
  try {
    require.resolve('pino-pretty');
    return { target: 'pino-pretty', options: { singleLine: true } };
  } catch {
    return undefined;
  }
}

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          genReqId: (request, reply) => {
            const existing = request.headers['x-request-id'];
            const id = typeof existing === 'string' ? existing : randomUUID();
            reply.setHeader('x-request-id', id);
            return id;
          },
          // Struktureret JSON i produktion; læsbart i udvikling.
          // pino-pretty er en devDependency og findes ikke i produktionsimaget,
          // så vi slår den kun til når den faktisk kan indlæses. Ellers ville
          // et image startet uden NODE_ENV=production gå ned på en manglende
          // transport i stedet for bare at logge JSON.
          transport: prettyTransport(config.NODE_ENV),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.newPassword',
              'req.body.currentPassword',
              'req.body.refreshToken',
            ],
            remove: true,
          },
          autoLogging: { ignore: (request) => request.url?.startsWith('/api/v1/health') ?? false },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ ttl: config.THROTTLE_TTL_SECONDS * 1_000, limit: config.THROTTLE_LIMIT }],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MediaModule,
    CatalogModule,
    AttributeModule,
    BeverageModule,
    QuestionModule,
    ReviewModule,
    UserModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Rækkefølgen betyder noget: rate limiting før autentificering,
    // så et brute force-forsøg ikke får lov at koste et argon2-opslag.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

export { loadConfig };
