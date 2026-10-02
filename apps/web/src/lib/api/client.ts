import { problemDetailsSchema, type ProblemDetails } from '@maanslogen/contracts';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);
export const API_BASE = `${API_URL}/api/v1`;

/**
 * Fejl fra API'et kommer som RFC 9457 Problem Details. Vi pakker dem i en
 * rigtig Error, så et kald enten returnerer data eller kaster — i stedet for
 * 1.0's `{ data?, error? }`, hvor hvert eneste kaldssted skulle huske at
 * tjekke `error` (og nogle gjorde det ikke).
 */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.problem.status;
  }

  /** Feltfejl klar til react-hook-form. */
  get fieldErrors(): Record<string, string> {
    const entries = Object.entries(this.problem.errors ?? {}).map(([field, messages]) => [
      field,
      messages.join(' '),
    ]);
    return Object.fromEntries(entries) as Record<string, string>;
  }

  get isUnauthorized(): boolean {
    return this.problem.status === 401;
  }
}

export type QueryValue =
  string | number | boolean | undefined | null | string[] | Record<string, string | undefined>;

/**
 * Bygger query-strengen. Objekter bliver til `attr[nøgle]=værdi`, som er det
 * format API'ets attributfiltre forventer.
 */
export function buildQuery(params: Record<string, QueryValue> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    if (typeof value === 'object') {
      for (const [nested, nestedValue] of Object.entries(value)) {
        if (nestedValue === undefined || nestedValue === '') continue;
        search.set(`${key}[${nested}]`, nestedValue);
      }
      continue;
    }
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Next.js caching. RSC-kald sætter denne; browser-kald ignorerer den. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
}

export async function apiRequest<T>(path: string, options: ApiRequest = {}): Promise<T> {
  const { method = 'GET', query, body, headers = {}, next, cache, signal, credentials } = options;

  const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(next ? { next } : {}),
    ...(cache ? { cache } : {}),
    ...(signal ? { signal } : {}),
    ...(credentials ? { credentials } : {}),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const parsed = problemDetailsSchema.safeParse(payload);
    throw new ApiError(
      parsed.success
        ? parsed.data
        : {
            type: 'about:blank',
            title: 'Uventet fejl',
            status: response.status,
            detail: response.statusText || 'API’et svarede med en fejl',
          },
    );
  }

  return payload as T;
}
