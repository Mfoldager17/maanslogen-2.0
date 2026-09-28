import { z } from 'zod';

/**
 * Konfigurationen valideres én gang ved opstart. Fejler den, starter processen ikke —
 * i stedet for at fejle først når nogen rammer det endpoint der mangler en nøgle.
 */
const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Varighed skal være som 15m, 24h eller 30d');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL mangler'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET skal være mindst 32 tegn'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET skal være mindst 32 tegn'),
    ACCESS_TOKEN_TTL: durationSchema.default('15m'),
    REFRESH_TOKEN_TTL: durationSchema.default('30d'),

    /** Komma-separeret. Tom liste = ingen browser-origins tillades. */
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    /**
     * Det fælles navn ovenover sitet og API'et, fx `mathiasfoldager.com`.
     *
     * Den SKAL sættes når de to bor på hver sit værtsnavn. Uden den bliver
     * cookien host-only på API'ets vært, og så ser sitets server den aldrig:
     * `api/server.ts` og `middleware.ts` læser `cookies()` fra *sitets*
     * forespørgsel, ikke API'ets. Resultatet er at man logger ind og stadig
     * regnes for logget ud — en løkke mellem login og den beskyttede side.
     *
     * Det ses ikke lokalt, fordi cookies ikke skelner på portnummer:
     * localhost:3000 og localhost:4000 er samme vært. Derfor er den udeladt
     * her, hvor der ikke er noget fælles navn at pege på.
     *
     * Prisen er at cookien når alle underdomæner under navnet. Den er
     * afvejet mod at refresh-tokens roteres ved brug med familie-spærring
     * (auth.service.ts), så et lækket token spærrer sig selv ved genbrug.
     *
     * Tom streng tælles som fraværende: docker compose indsætter `""` for en
     * variabel der ikke står i env-filen, og den skulle nødig ende som et
     * tomt `Domain=` i Set-Cookie.
     */
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => value || undefined),

    THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

    /**
     * `r2` = Cloudflare R2 (produktion). `s3` = enhver S3-kompatibel tjeneste,
     * fx MinIO lokalt. Samme kode, forskellig endpoint- og URL-opbygning.
     */
    STORAGE_DRIVER: z.enum(['r2', 's3']).default('s3'),

    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    /** Offentligt domæne foran bucketen, fx https://media-maanslogen.mathiasfoldager.com */
    R2_PUBLIC_BASE_URL: z.string().optional(),

    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_PUBLIC_BASE_URL: z.string().optional(),

    UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3_600).default(900),
    /** Hvor længe en uafhentet upload får lov at ligge før oprydning. */
    PENDING_UPLOAD_TTL_MINUTES: z.coerce.number().int().positive().default(60),

    ENABLE_SWAGGER: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 'r2') {
      for (const key of [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET',
        'R2_PUBLIC_BASE_URL',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} er påkrævet når STORAGE_DRIVER=r2`,
          });
        }
      }
    } else {
      for (const key of [
        'S3_ENDPOINT',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_BUCKET',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} er påkrævet når STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    if (env.NODE_ENV === 'production') {
      const weak = ['change-me', 'dev-access-secret', 'dev-refresh-secret'];
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (weak.some((fragment) => env[key].includes(fragment))) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} bruger stadig en udviklingsværdi — sæt en rigtig hemmelighed i produktion`,
          });
        }
      }
      if (env.CORS_ORIGINS.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'CORS_ORIGINS skal sættes eksplicit i produktion',
        });
      }
    }

    /**
     * En cookie for `mathiasfoldager.com` når aldrig et site på
     * `maanslogen-web.workers.dev`. Er der et site i CORS-listen som ligger
     * uden for cookiens domæne, kan det site ikke læse sessionen — og fejlen
     * viser sig ikke som en fejl, men som en bruger der bliver ved med at
     * blive sendt til login.
     *
     * Derfor her, ved opstart, frem for i drift.
     */
    if (env.COOKIE_DOMAIN) {
      const domaene = env.COOKIE_DOMAIN.replace(/^\./, '');
      for (const origin of env.CORS_ORIGINS) {
        let vaert: string;
        try {
          vaert = new URL(origin).hostname;
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ORIGINS'],
            message: `"${origin}" er ikke en gyldig adresse`,
          });
          continue;
        }

        if (vaert !== domaene && !vaert.endsWith(`.${domaene}`)) {
          ctx.addIssue({
            code: 'custom',
            path: ['COOKIE_DOMAIN'],
            message:
              `${origin} ligger uden for COOKIE_DOMAIN=${env.COOKIE_DOMAIN}. ` +
              'Sitet ville aldrig modtage sessionscookien og ville sende brugeren ' +
              'til login i en løkke. Flyt sitet ind under domænet, eller ryd COOKIE_DOMAIN.',
          });
        }
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  • ${issue.path.join('.') || '(rod)'}: ${issue.message}`,
    );
    throw new Error(`Ugyldig konfiguration:\n${lines.join('\n')}`);
  }
  return result.data;
}

export const CONFIG = Symbol('APP_CONFIG');
