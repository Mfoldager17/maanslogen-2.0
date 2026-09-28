import type { GatheringKind, GatheringStatus } from '@maanslogen/contracts';

/**
 * VERSAL-enum'erne er API'ets og hører ikke hjemme på skærmen. Ét sted, så
 * listen, arrangementssiden og admin aldrig kommer til at skrive hver sit —
 * det gik galt med rollerne i 1.0.
 */
export const ARRANGEMENT_ETIKETTER: Record<GatheringKind, string> = {
  TASTING: 'Smagning',
  FESTIVAL: 'Festival',
  VISIT: 'Besøg',
  DINNER: 'Middag',
  OTHER: 'Andet',
};

/** Vises under typen, så man ved hvad man vælger når man opretter. */
export const ARRANGEMENT_FORKLARINGER: Record<GatheringKind, string> = {
  TASTING: 'Rækkefølgen er bestemt i forvejen. Værten skænker og styrer listen.',
  FESTIVAL: 'Alle går rundt og prøver ting. Enhver deltager kan skrive på listen.',
  VISIT: 'Et destilleri, et bryggeri, en vingård.',
  DINNER: 'Maden er hovedsagen, men der blev også drukket noget.',
  OTHER: 'Alt det der ikke passer i kasserne ovenfor.',
};

export const STATUS_ETIKETTER: Record<GatheringStatus, string> = {
  PLANNED: 'Planlagt',
  LIVE: 'I gang',
  DONE: 'Slut',
};

export const STATUS_TONER: Record<GatheringStatus, 'neutral' | 'accent' | 'positive'> = {
  PLANNED: 'neutral',
  LIVE: 'accent',
  DONE: 'positive',
};
