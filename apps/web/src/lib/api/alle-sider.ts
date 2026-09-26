import type { Paginated } from '@maanslogen/contracts';
import type { QueryValue } from './client';

type Query = Record<string, QueryValue>;

/**
 * Henter alle sider af en liste.
 *
 * Admin har et par steder brug for den fulde liste — typer og mærker til en
 * dropdown, hvor en afkortet liste ville betyde at man ikke kunne vælge det
 * man ledte efter. Siderne bad derfor om `limit: 200` og `limit: 300`, men
 * API'et tillader højst 100 og svarer 422:
 *
 *     "limit": ["Too big: expected number to be <=100"]
 *
 * At sætte tallet ned til 100 ville skjule fejlen indtil kataloget voksede
 * forbi hundrede typer eller mærker, og så ville den komme igen som noget der
 * bare manglede i en dropdown. Derfor hentes siderne i stedet til ende.
 */
export async function alleSider<T>(
  hent: (query: Query) => Promise<Paginated<T>>,
  query: Query = {},
  maksSider = 50,
): Promise<T[]> {
  const alle: T[] = [];
  let cursor: string | undefined;

  for (let side = 0; side < maksSider; side += 1) {
    const svar = await hent({ ...query, limit: 100, ...(cursor ? { cursor } : {}) });
    alle.push(...svar.items);
    if (!svar.pageInfo.hasMore || !svar.pageInfo.nextCursor) return alle;
    cursor = svar.pageInfo.nextCursor;
  }

  // Grænsen findes for at en fejl i markøren ikke kan blive til en uendelig
  // løkke der henter den samme side igen og igen.
  return alle;
}
