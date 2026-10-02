import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Browserens API-kald skal gå til sidens egen vært, ikke til API'ets.
 *
 * Hele sessionen hænger på det. Talte browseren direkte med API'et, ville
 * `Set-Cookie` lande host-only på API'ets vært, og sidens server ville aldrig
 * se den — `middleware.ts` og `lib/api/server.ts` læser cookies fra sidens
 * forespørgsel. Man ville logge ind og blive sendt til login igen.
 *
 * Det er umuligt at se i en typecheck: et kald til den forkerte adresse er
 * gyldig kode der gør præcis hvad der står. Og det viser sig ikke lokalt
 * heller, fordi cookies ikke skelner på portnummer — localhost:3000 og
 * localhost:4000 er samme vært. Derfor står det her.
 */

const ROD = path.resolve(__dirname, '..');
const KLIENT = path.join(ROD, 'lib/api/client.ts');
const BROWSER = path.join(ROD, 'lib/api/browser.ts');
const NEXT_CONFIG = path.resolve(ROD, '../next.config.ts');

function alleKildefiler(mappe: string): string[] {
  return readdirSync(mappe).flatMap((navn) => {
    const sti = path.join(mappe, navn);
    if (statSync(sti).isDirectory()) return alleKildefiler(sti);
    return /\.tsx?$/.test(navn) && !/\.test\.tsx?$/.test(navn) ? [sti] : [];
  });
}

/** Præfikset browseren kalder, som det står i client.ts. */
function sammeOprindelsePraefiks(): string {
  const fund = readFileSync(KLIENT, 'utf8').match(
    /export const API_BASE_SAMME_OPRINDELSE = '([^']+)'/,
  );
  if (!fund?.[1]) throw new Error('API_BASE_SAMME_OPRINDELSE findes ikke i client.ts');
  return fund[1];
}

/** `source`-mønstrene i next.config.ts's rewrites(). */
function rewriteKilder(): string[] {
  const konfig = readFileSync(NEXT_CONFIG, 'utf8');
  const blok = konfig.match(/async rewrites\(\)[\s\S]*?\n {2}},/);
  if (!blok) throw new Error('next.config.ts har ingen rewrites()');
  return [...blok[0].matchAll(/source: '([^']+)'/g)].map((fund) => fund[1] as string);
}

describe('samme oprindelse', () => {
  it('har et rewrite der dækker det præfiks browseren kalder', () => {
    const praefiks = sammeOprindelsePraefiks();
    const kilder = rewriteKilder();

    expect(
      kilder.some((kilde) => kilde.startsWith(praefiks)),
      `Browseren kalder "${praefiks}", men next.config.ts videresender kun ` +
        `${JSON.stringify(kilder)}. Uden et rewrite der dækker præfikset rammer ` +
        `hvert eneste API-kald fra browseren en 404 på sidens egen vært.`,
    ).toBe(true);
  });

  it('lader browserApi gå gennem det relative præfiks', () => {
    // Kun koden. Navnet står også i filens doc-kommentar, og en test der
    // læste hele filen ville bestå selvom kaldet manglede argumentet.
    const kode = readFileSync(BROWSER, 'utf8')
      .split('\n')
      .filter((linje) => {
        const trimmet = linje.trimStart();
        return !trimmet.startsWith('*') && !trimmet.startsWith('//') && !trimmet.startsWith('/*');
      })
      .join('\n');

    expect(
      /apiRequest<T>\([\s\S]*?API_BASE_SAMME_OPRINDELSE[\s\S]*?\);/.test(kode),
      'browser.ts skal give apiRequest API_BASE_SAMME_OPRINDELSE som base. ' +
        'Uden det argument falder den tilbage til API_BASE og taler direkte ' +
        'med API’et, og sessionen lander et sted sidens server ikke kan læse den.',
    ).toBe(true);
  });

  it('kalder aldrig den absolutte API-adresse fra browserkode', () => {
    const overtraedelser: string[] = [];

    for (const fil of alleKildefiler(ROD)) {
      const indhold = readFileSync(fil, 'utf8');
      if (!/^\s*['"]use client['"]/m.test(indhold)) continue;

      indhold.split('\n').forEach((linje, i) => {
        const trimmet = linje.trimStart();
        if (trimmet.startsWith('*') || trimmet.startsWith('//')) return;
        if (/\bAPI_BASE\b|\bAPI_URL\b/.test(linje)) {
          overtraedelser.push(`${path.relative(ROD, fil)}:${i + 1}: ${trimmet}`);
        }
      });
    }

    expect(
      overtraedelser,
      'Browserkode må ikke kalde API’ets egen vært — så lander sessionscookien ' +
        'et sted sidens server ikke kan læse den. Brug browserApi():\n' +
        overtraedelser.join('\n'),
    ).toEqual([]);
  });
});
