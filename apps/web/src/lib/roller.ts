import type { Role } from '@maanslogen/contracts';

/**
 * Rollerne hedder noget på dansk i brugerfladen; VERSAL-enum'en er API'ets
 * og hører ikke hjemme på skærmen. Ét sted, så admin-tabellen og profilen
 * aldrig kommer til at skrive hver sit.
 */
export const ROLLE_ETIKETTER: Record<Role, string> = {
  USER: 'Bruger',
  MODERATOR: 'Moderator',
  ADMIN: 'Administrator',
};
