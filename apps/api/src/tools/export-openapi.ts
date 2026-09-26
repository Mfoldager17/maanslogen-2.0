import 'reflect-metadata';
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createApp, setupOpenApi } from '../bootstrap';

/**
 * Skriver OpenAPI-dokumentet til disk uden at starte en server.
 * Bruges i CI, så et ændret API bliver synligt i diff'en.
 */
async function main(): Promise<void> {
  const app = await createApp();
  await app.init();

  const document = setupOpenApi(app);
  const target = path.resolve(process.cwd(), 'openapi.json');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI skrevet til ${target}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
