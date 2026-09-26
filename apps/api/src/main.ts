import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { createApp, setupOpenApi } from './bootstrap';
import { CONFIG, type AppConfig } from './config/env';

async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get<AppConfig>(CONFIG);

  if (config.ENABLE_SWAGGER) setupOpenApi(app);

  await app.listen({ port: config.PORT, host: config.HOST });

  const logger = new Logger('Bootstrap');
  logger.log(`Maanslogen API kører på http://${config.HOST}:${config.PORT}/api/v1`);
  if (config.ENABLE_SWAGGER) {
    logger.log(`Dokumentation: http://${config.HOST}:${config.PORT}/docs`);
  }
}

main().catch((error: unknown) => {
  // Konfigurationsfejl skal være læsbare, ikke et stacktrace fra Nests DI.
  console.error('\nKunne ikke starte API’et:\n');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
