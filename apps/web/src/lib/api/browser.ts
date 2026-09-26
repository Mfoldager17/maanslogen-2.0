'use client';

import { apiRequest, type ApiRequest } from './client';

/**
 * API-kald fra browseren. `credentials: 'include'` sender httpOnly-cookien med
 * til API-oprindelsen — derfor findes access-tokenet aldrig i JavaScript og
 * kan ikke læses af et XSS-fund.
 */
export function browserApi<T>(path: string, options: ApiRequest = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, credentials: 'include' });
}
