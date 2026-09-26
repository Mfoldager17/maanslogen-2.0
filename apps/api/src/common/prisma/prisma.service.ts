import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { CONFIG, type AppConfig } from '../../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(@Inject(CONFIG) config: AppConfig) {
    const pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.NODE_ENV === 'test' ? 5 : 20,
      idleTimeoutMillis: 30_000,
    });

    super({
      adapter: new PrismaPg(pool),
      log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Forbundet til databasen');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  /** Bruges af health-checket. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
