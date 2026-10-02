import 'reflect-metadata';

/**
 * E2E kører mod en rigtig Postgres, ikke mocks. Det er netop transaktionerne,
 * constraint'ene og Prisma-forespørgslerne vi vil have bevist — dem kan en mock
 * ikke sige noget om.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/maanslogen_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-der-er-lang-nok-til-validering';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-der-er-lang-nok-til-validering';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL = '30d';
process.env.STORAGE_DRIVER = 's3';
process.env.S3_ENDPOINT = 'http://127.0.0.1:9000';
process.env.S3_BUCKET = 'maanslogen-test';
process.env.S3_ACCESS_KEY_ID = 'test';
process.env.S3_SECRET_ACCESS_KEY = 'test';
process.env.S3_PUBLIC_BASE_URL = 'http://127.0.0.1:9000/maanslogen-test';
// Arrangementernes billeder. Testene signerer kun URL'er — det sker lokalt
// uden at røre bucketen — så den behøver ikke findes for at de kan køre.
process.env.S3_PRIVATE_BUCKET = 'maanslogen-privat-test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
process.env.ENABLE_SWAGGER = 'false';
// Rate limiting ville ellers slå testkørslen ihjel.
process.env.THROTTLE_LIMIT = '100000';
