/**
 * Arrangementerne har deres egen vært, fx `arrangement-maanslogen.…`.
 *
 * Det er den samme app og den samme Worker — et værtsnavn er ikke et andet
 * program, bare en anden dør ind. Kommer forespørgslen ind ad den dør, er `/`
 * arrangementslisten og `/{slug}` ét arrangement, så adressen man deler til en
 * smagning er kort og kun handler om den.
 *
 * Logikken ligger her frem for i `middleware.ts`, fordi den er en ren funktion
 * af vært og sti og kan afprøves uden at rejse en NextRequest.
 */

/**
 * Stier der betyder det samme på begge værter og derfor aldrig skrives om.
 *
 * `/log-ind` og `/opret` skal findes på arrangementsværten: sessionen er
 * host-only pr. vært, så man logger ind netop dér. `/api` er videresendt til
 * API'et af `next.config.ts`, og skrev vi den om, ville hvert eneste kald fra
 * browseren ende i en 404.
 */
const DELTE_STIER = [/^\/log-ind(\/|$)/, /^\/opret(\/|$)/, /^\/api(\/|$)/];

export interface VaertOpslag {
  /** `Host`-headeren, med portnummer hvis der er et. */
  vaert: string | null | undefined;
  pathname: string;
  /** `NEXT_PUBLIC_ARRANGEMENT_HOST`. Usat = kun én vært, og intet skrives om. */
  arrangementVaert: string | null | undefined;
}

/**
 * Stien arrangementsværten egentlig beder om, eller `null` når der ikke skal
 * skrives om.
 *
 * `/` bliver til `/arrangementer`, ikke `/arrangementer/`: Next ville ellers
 * viderestille for at fjerne skråstregen, og et rewrite der bliver til en
 * omdirigering viser den indre adresse i browserens adresselinje.
 */
export function erArrangementsVaert(
  vaert: string | null | undefined,
  arrangementVaert: string | null | undefined,
): boolean {
  if (!arrangementVaert || !vaert) return false;
  return vaert.toLowerCase() === arrangementVaert.toLowerCase();
}

export function arrangementsSti({ vaert, pathname, arrangementVaert }: VaertOpslag): string | null {
  if (!erArrangementsVaert(vaert, arrangementVaert)) return null;

  if (pathname === '/arrangementer' || pathname.startsWith('/arrangementer/')) return null;
  if (DELTE_STIER.some((moenster) => moenster.test(pathname))) return null;

  return pathname === '/' ? '/arrangementer' : `/arrangementer${pathname}`;
}
