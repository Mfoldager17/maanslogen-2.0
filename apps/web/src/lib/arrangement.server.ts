import 'server-only';
import type { GatheringDetail } from '@maanslogen/contracts';
import { api } from './api/api.server';
import { ApiError } from './api/client';

/**
 * Ét arrangement, eller `null` hvis det ikke findes — eller ikke findes *for
 * dig*.
 *
 * API'et svarer 404, ikke 403, på et arrangement man ikke er inviteret til:
 * et 403 ville bekræfte at det findes, og hvem der holder hvad er også en
 * oplysning. Den skelnen skal siderne ikke lave om på, så begge dele bliver
 * til det samme `null` her, og siden kalder `notFound()`.
 *
 * Ligger i en fil for sig, fordi både arrangementssiden og styringen henter
 * det samme — og den dag den ene holdt op med at behandle 404 som "findes
 * ikke", ville kun den ene flade røbe det.
 */
export async function hentArrangement(slug: string): Promise<GatheringDetail | null> {
  try {
    return await api.gatherings.get(slug);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}
