import { describe, expect, it, vi } from 'vitest';
import { decodeCursor, encodeCursor, paginate } from './cursor';
import { AppError } from '../http/app-error';

describe('cursor', () => {
  it('rundtur gennem encode/decode', () => {
    const cursor = encodeCursor({ id: 'abc', rank: 3 });
    expect(decodeCursor(cursor)).toEqual({ id: 'abc', rank: 3 });
  });

  it('cursoren er uigennemsigtig — ikke bare id’et', () => {
    expect(encodeCursor({ id: 'abc' })).not.toContain('abc');
  });

  it('afviser vrøvl i stedet for at fejle med en databasefejl', () => {
    expect(() => decodeCursor('ikke-base64!!')).toThrow(AppError);
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: `id-${index}`, value: index }));

  it('henter limit + 1 for at vide om der er flere, uden en ekstra tælling', async () => {
    const fetch = vi.fn(async (take: number) => rows.slice(0, take));

    const page = await paginate({ limit: 2 }, fetch, (row) => row.value);

    expect(fetch).toHaveBeenCalledWith(3, undefined);
    expect(page.items).toEqual([0, 1]);
    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).not.toBeNull();
    expect(page.pageInfo.total).toBeNull();
  });

  it('sætter hasMore=false og nextCursor=null på sidste side', async () => {
    const fetch = vi.fn(async () => rows.slice(0, 2));

    const page = await paginate({ limit: 5 }, fetch, (row) => row.value);

    expect(page.pageInfo.hasMore).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });

  it('giver cursorens id videre til fetch', async () => {
    const fetch = vi.fn(async () => []);
    await paginate({ limit: 10, cursor: encodeCursor({ id: 'id-2' }) }, fetch, (row) => row);
    expect(fetch).toHaveBeenCalledWith(11, 'id-2');
  });

  it('tæller kun når klienten beder om det', async () => {
    const count = vi.fn(async () => 42);
    const fetch = vi.fn(async () => rows.slice(0, 1));

    const withoutTotal = await paginate({ limit: 5 }, fetch, (row) => row, count);
    expect(withoutTotal.pageInfo.total).toBeNull();
    expect(count).not.toHaveBeenCalled();

    const withTotal = await paginate({ limit: 5, withTotal: true }, fetch, (row) => row, count);
    expect(withTotal.pageInfo.total).toBe(42);
  });
});
