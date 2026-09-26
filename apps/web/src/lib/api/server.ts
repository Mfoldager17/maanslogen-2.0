import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@maanslogen/contracts';
import { apiRequest, ApiError, type ApiRequest } from './client';

/**
 * API-kald fra server-komponenter. Cookien sendes videre, så RSC ser præcis
 * det den indloggede bruger ser — uden at tokenet nogensinde når browserens JS.
 */
export async function serverApi<T>(path: string, options: ApiRequest = {}): Promise<T> {
  const store = await cookies();
  const jar = [store.get(ACCESS_TOKEN_COOKIE), store.get(REFRESH_TOKEN_COOKIE)].filter(
    (entry): entry is NonNullable<typeof entry> => entry !== undefined,
  );

  return apiRequest<T>(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(jar.length
        ? { cookie: jar.map((entry) => `${entry.name}=${entry.value}`).join('; ') }
        : {}),
    },
  });
}

/** Som `serverApi`, men `null` i stedet for en 404-fejl. */
export async function serverApiOrNull<T>(
  path: string,
  options: ApiRequest = {},
): Promise<T | null> {
  try {
    return await serverApi<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
