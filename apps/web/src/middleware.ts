import { NextResponse, type NextRequest } from 'next/server';
import { arrangementsSti } from '@/lib/arrangement-vaert';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  roleAtLeast,
  type Role,
} from '@maanslogen/contracts';

/**
 * Adgangskontrollen ligger i flere lag, og kun det sidste beskytter data:
 *
 *  1. Denne middleware kører før noget som helst renderes. Den forny'r en
 *     udløbet session og sender folk uden adgang videre, så en beskyttet side
 *     aldrig begynder at streame. Et `redirect()` i et layout er ikke nok:
 *     layout og page renderer sideløbende, så sidens indhold kan nå at blive
 *     sendt af sted, før layoutet får afvist adgangen.
 *  2. Layoutet henter brugeren og tjekker rollen igen.
 *  3. API'et håndhæver det hele ved hvert kald. Det er dér adgangen faktisk
 *     afgøres; de to første lag er til for oplevelsens skyld.
 *
 * Rollen her læses ud af access-tokenet **uden** at verificere signaturen.
 * Det er bevidst: middleware skal ikke dele API'ets hemmelighed, og et forfalsket
 * token kommer ingen vegne — API'et afviser det, og siden viser en fejl i stedet
 * for data.
 */

const RULES: { pattern: RegExp; minRole: Role }[] = [
  { pattern: /^\/admin\/brugere(\/|$)/, minRole: 'ADMIN' },
  { pattern: /^\/admin(\/|$)/, minRole: 'MODERATOR' },
  { pattern: /^\/profil(\/|$)/, minRole: 'USER' },
  { pattern: /^\/arrangementer(\/|$)/, minRole: 'USER' },
  { pattern: /^\/drikkevarer\/[^/]+\/anmeld$/, minRole: 'USER' },
];

const API_BASE = `${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')}/api/v1`;

/** `NEXT_PUBLIC_ARRANGEMENT_HOST`. Usat = kun én vært, og intet skrives om. */
const ARRANGEMENT_VAERT = process.env.NEXT_PUBLIC_ARRANGEMENT_HOST;

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // Adgangen afgøres på den side der faktisk bliver vist. Kiggede vi på den
  // adresse browseren skrev, ville `/{slug}` på arrangementsværten se ud som
  // en offentlig side og slippe uden om reglerne herunder.
  const omskrevet = arrangementsSti({
    vaert: request.headers.get('host'),
    pathname,
    arrangementVaert: ARRANGEMENT_VAERT,
  });
  const effektivSti = omskrevet ?? pathname;

  const fortsaet = (): NextResponse => {
    if (omskrevet === null) return NextResponse.next();
    const maal = request.nextUrl.clone();
    maal.pathname = omskrevet;
    return NextResponse.rewrite(maal);
  };

  const rule = RULES.find((entry) => entry.pattern.test(effektivSti));
  if (!rule) return fortsaet();

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // Access-tokens lever 15 minutter. Uden dette ville en bruger blive smidt ud
  // midt i en session, selvom refresh-tokenet er gyldigt en måned endnu.
  let refreshed: { accessToken: string; setCookies: string[] } | null = null;
  if (!accessToken && refreshToken) {
    refreshed = await renewSession(refreshToken);
    accessToken = refreshed?.accessToken;
  }

  if (!accessToken) return redirectToLogin(request, pathname, search);

  const role = roleFromToken(accessToken);
  if (role && !roleAtLeast(role, rule.minRole)) {
    // Logget ind, men ikke adgang til netop denne del.
    const fallback = rule.minRole === 'ADMIN' ? '/admin' : '/';
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  const response = fortsaet();
  for (const cookie of refreshed?.setCookies ?? []) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}

function redirectToLogin(request: NextRequest, pathname: string, search: string): NextResponse {
  const login = new URL('/log-ind', request.url);
  login.searchParams.set('retur', `${pathname}${search}`);
  const response = NextResponse.redirect(login);
  // Ryd et refresh-token der ikke længere virker, så vi ikke prøver igen
  // ved hver eneste navigation.
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

async function renewSession(
  refreshToken: string,
): Promise<{ accessToken: string; setCookies: string[] } | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const session = (await response.json()) as { tokens?: { accessToken?: string } };
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) return null;

    return { accessToken, setCookies: response.headers.getSetCookie() };
  } catch {
    return null;
  }
}

/** Læser `role` ud af JWT-payloaden. Signaturen verificeres ikke — se noten øverst. */
function roleFromToken(token: string): Role | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { role?: string; exp?: number };
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
    return claims.role === 'ADMIN' || claims.role === 'MODERATOR' || claims.role === 'USER'
      ? claims.role
      : null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/profil/:path*',
    '/arrangementer/:path*',
    '/drikkevarer/:slug/anmeld',
    /*
     * De tre sidste findes for arrangementsværten: dér er `/` listen,
     * `/{slug}` ét arrangement og `/{slug}/styring` dets styring. På
     * hovedværten falder de samme stier igennem uden at blive rørt —
     * `arrangementsSti` svarer `null`, og middlewaren returnerer
     * `NextResponse.next()` som før.
     *
     * Styringen står her for sig: `/:slug` dækker kun ét led, så uden den
     * ville den korte adresse på arrangementsværten ikke blive skrevet om,
     * og man ville få en 404 på den ene vært og siden på den anden.
     */
    '/',
    '/:slug',
    '/:slug/styring',
  ],
};
