import type { Paginated } from '@maanslogen/contracts';
import { AppError } from '../http/app-error';

/**
 * Uigennemsigtig cursor. Indholdet er en implementationsdetalje, så klienten
 * ikke begynder at konstruere cursors selv.
 */
export function encodeCursor(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, string | number> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    return parsed as Record<string, string | number>;
  } catch {
    throw AppError.badRequest('Ugyldig cursor');
  }
}

export interface PaginateOptions {
  limit: number;
  cursor?: string;
  withTotal?: boolean;
}

/**
 * Henter `limit + 1` rækker for at afgøre om der er flere, uden en ekstra tælling.
 * `fetch` får den dekodede række-id som Prisma-cursor.
 */
export async function paginate<TRow extends { id: string }, TItem>(
  options: PaginateOptions,
  fetch: (take: number, cursorId?: string) => Promise<TRow[]>,
  map: (row: TRow) => TItem,
  count?: () => Promise<number>,
): Promise<Paginated<TItem>> {
  const cursorId = options.cursor ? String(decodeCursor(options.cursor).id ?? '') : undefined;
  if (options.cursor && !cursorId) throw AppError.badRequest('Ugyldig cursor');

  const rows = await fetch(options.limit + 1, cursorId);
  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(map),
    pageInfo: {
      nextCursor: hasMore && last ? encodeCursor({ id: last.id }) : null,
      hasMore,
      total: options.withTotal && count ? await count() : null,
    },
  };
}
