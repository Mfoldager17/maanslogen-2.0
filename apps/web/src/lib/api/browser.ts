'use client';

import { apiRequest, API_BASE_SAMME_OPRINDELSE, type ApiRequest } from './client';

/**
 * API-kald fra browseren. To ting sker her, og de hænger sammen:
 *
 *  - Kaldet går til sidens egen vært (`/api/v1/...`), ikke til API'ets. Next
 *    sender det videre serverside. Se noten ved API_BASE_SAMME_OPRINDELSE.
 *  - `credentials: 'include'` sender httpOnly-cookien med — derfor findes
 *    access-tokenet aldrig i JavaScript og kan ikke læses af et XSS-fund.
 */
export function browserApi<T>(path: string, options: ApiRequest = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, credentials: 'include' }, API_BASE_SAMME_OPRINDELSE);
}
