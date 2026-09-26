import { z } from 'zod';
import { booleanWithDefault, intWithDefault, sortOrderSchema } from './primitives';

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export const pageInfoSchema = z
  .object({
    /** Opaque cursor til næste side. `null` når der ikke er flere. */
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    /** Samlet antal — kun med når klienten beder om det (`withTotal=true`). */
    total: z.number().int().nonnegative().nullable(),
  })
  .meta({ id: 'PageInfo' });

export type PageInfo = z.infer<typeof pageInfoSchema>;

/**
 * Alle lister bruger cursor-pagination. Det er stabilt under indsættelser,
 * i modsætning til offset, og gør uendelig scroll i frontend triviel.
 */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), pageInfo: pageInfoSchema });
}

export type Paginated<T> = { items: T[]; pageInfo: PageInfo };

export const baseListQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: intWithDefault({ min: 1, max: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE }),
  withTotal: booleanWithDefault(false),
  order: sortOrderSchema.default('asc'),
  /** Fritekstsøgning. Tolkes pr. ressource (navn, beskrivelse, mærke …). */
  q: z.string().trim().min(1).max(120).optional(),
});

export type BaseListQuery = z.infer<typeof baseListQuerySchema>;
