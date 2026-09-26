import { z } from 'zod';
import { roleSchema } from './enums';
import { baseListQuerySchema } from './pagination';
import { optionalBoolean, idSchema, isoDateTimeSchema } from './primitives';
import { mediaAssetSchema } from './media';

export const userSchema = z
  .object({
    id: idSchema,
    email: z.string(),
    displayName: z.string(),
    role: roleSchema,
    active: z.boolean(),
    avatar: mediaAssetSchema.nullable(),
    reviewCount: z.number().int().nonnegative().optional(),
    lastLoginAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .meta({ id: 'User' });

export type User = z.infer<typeof userSchema>;

/**
 * Adgangskodekrav. 1.0 havde ingen — brugere blev oprettet med `passwordHash: 'hashedpassword1'`.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Adgangskoden skal være mindst 12 tegn')
  .max(128, 'Adgangskoden må højst være 128 tegn')
  .refine((value) => /[a-zæøå]/.test(value), 'Adgangskoden skal indeholde et lille bogstav')
  .refine((value) => /[A-ZÆØÅ]/.test(value), 'Adgangskoden skal indeholde et stort bogstav')
  .refine((value) => /\d/.test(value), 'Adgangskoden skal indeholde et tal');

export const emailSchema = z.email().trim().toLowerCase().max(254);

export const createUserSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(60),
    password: passwordSchema,
    role: roleSchema.optional(),
  })
  .meta({ id: 'CreateUser' });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60).optional(),
    email: emailSchema.optional(),
    role: roleSchema.optional(),
    active: z.boolean().optional(),
  })
  .meta({ id: 'UpdateUser' });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60).optional(),
  })
  .meta({ id: 'UpdateProfile' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .meta({ id: 'ChangePassword' });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const userListQuerySchema = baseListQuerySchema.extend({
  sort: z.enum(['createdAt', 'displayName', 'email']).default('createdAt'),
  role: roleSchema.optional(),
  active: optionalBoolean(),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;
