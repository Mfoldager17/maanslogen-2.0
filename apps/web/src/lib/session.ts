import 'server-only';
import { cache } from 'react';
import { roleAtLeast, type Role, type User } from '@maanslogen/contracts';
import { ApiError } from './api/client';
import { api } from './api/api.server';

/**
 * `cache` gør at flere komponenter i samme render deler ét opslag —
 * layout, header og siden selv spørger om den samme bruger én gang.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    return await api.auth.me();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
});

export async function hasRole(role: Role): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null && roleAtLeast(user.role, role);
}
