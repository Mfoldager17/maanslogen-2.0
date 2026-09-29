import 'server-only';
import { headers } from 'next/headers';
import { erArrangementsVaert } from './arrangement-vaert';

/**
 * Er denne forespørgsel kommet ind ad arrangementsværtens dør?
 *
 * Siderne har brug for det til én ting: hvor "tilbage" fører hen. På
 * arrangementsværten er listen roden, og der er ikke noget ovenover; på
 * hovedværten er den en del af sitet, og vejen ud går til forsiden.
 *
 * Adskilt fra den rene funktion i `arrangement-vaert.ts`, så den kan afprøves
 * uden at rejse en forespørgsel.
 */
export async function paaArrangementsVaert(): Promise<boolean> {
  const vaert = (await headers()).get('host');
  return erArrangementsVaert(vaert, process.env.NEXT_PUBLIC_ARRANGEMENT_HOST);
}
