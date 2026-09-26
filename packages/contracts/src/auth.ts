import { z } from 'zod';
import { emailSchema, passwordSchema, userSchema } from './user';

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Adgangskode er påkrævet').max(128),
  })
  .meta({ id: 'Login' });

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(60),
    password: passwordSchema,
  })
  .meta({ id: 'Register' });

export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshSchema = z
  .object({
    /** Udelades når refresh-token sendes som httpOnly-cookie (standard for web). */
    refreshToken: z.string().min(1).optional(),
  })
  .meta({ id: 'Refresh' });

export const authTokensSchema = z
  .object({
    accessToken: z.string(),
    /** Kun med i svaret for ikke-browser-klienter; web bruger httpOnly-cookie. */
    refreshToken: z.string().optional(),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().positive(),
  })
  .meta({ id: 'AuthTokens' });

export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authSessionSchema = z
  .object({
    user: userSchema,
    tokens: authTokensSchema,
  })
  .meta({ id: 'AuthSession' });

export type AuthSession = z.infer<typeof authSessionSchema>;

/** Payload i access-tokenet. */
export const accessTokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  role: userSchema.shape.role,
  /** Token-version — bumpes ved adgangskodeskift, så gamle tokens dør. */
  ver: z.number().int(),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const ACCESS_TOKEN_COOKIE = 'mlg_at';
export const REFRESH_TOKEN_COOKIE = 'mlg_rt';
