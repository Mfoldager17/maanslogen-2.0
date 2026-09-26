import type { ReadonlyURLSearchParams } from 'next/navigation';

export type SearchParams = Record<string, string | string[] | undefined>;

/** Første værdi af en query-parameter; arrays bliver til deres første element. */
export function first(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Plukker `attr[nøgle]`-parametrene ud som et almindeligt objekt. */
export function attributeParams(params: SearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const match = /^attr\[(.+)\]$/.exec(key);
    if (!match?.[1]) continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) result[match[1]] = single;
  }
  return result;
}

/**
 * Laver en ny query-streng ud fra den nuværende plus ændringer.
 * `null` fjerner en parameter. Cursoren nulstilles altid, fordi en ændret
 * filtrering gør den gamle cursor meningsløs.
 */
export function withParams(
  current: URLSearchParams | ReadonlyURLSearchParams,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  next.delete('cursor');
  const query = next.toString();
  return query ? `?${query}` : '';
}

/** Slår en værdi til/fra i en `|`-separeret liste (fx `attr[color]=dark|amber`). */
export function toggleInList(current: string | undefined, value: string): string | null {
  const values = new Set((current ?? '').split('|').filter(Boolean));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  const next = [...values].join('|');
  return next === '' ? null : next;
}
