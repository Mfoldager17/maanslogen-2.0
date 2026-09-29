import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Arrangementerne bruges stående, på en telefon, med et glas i den anden
 * hånd. To fejl kom ind i fladerne netop fordi de blev skrevet ved et
 * skrivebord med en mus:
 *
 *  - Hver knap var `size="sm"` — 36px — selvom projektets egen `button.tsx`
 *    skriver at 44px er den mindste komfortable berøringsflade.
 *  - Knappen til at fjerne sit eget billede lå bag `group-hover:opacity-100`.
 *    Telefoner har ikke hover, så på netop den enhed billederne bliver taget
 *    med, kunne man hverken se eller ramme den.
 *
 * Ingen af delene ville en typecheck eller en e2e fange: begge dele er
 * gyldig kode der gør præcis hvad der står. Derfor den her.
 */
const WEB = path.resolve(__dirname, '..');

const MAPPER = ['components/gathering', 'app/(public)/arrangementer'];

function filerUnder(mappe: string): string[] {
  const rod = path.join(WEB, mappe);
  return readdirSync(rod).flatMap((navn) => {
    const sti = path.join(rod, navn);
    if (statSync(sti).isDirectory()) return filerUnder(path.join(mappe, navn));
    return /\.tsx$/.test(navn) ? [sti] : [];
  });
}

const FILER = MAPPER.flatMap(filerUnder).map((sti) => ({
  navn: path.relative(WEB, sti),
  indhold: readFileSync(sti, 'utf8'),
}));

describe('arrangementsfladerne er til en telefon', () => {
  it('finder filerne', () => {
    // Uden denne ville testen bestå ved at kigge på ingenting.
    expect(FILER.length).toBeGreaterThan(4);
  });

  it.each(FILER.map((f) => f.navn))('%s: ingen knap under 44px', (navn) => {
    const fil = FILER.find((f) => f.navn === navn);
    // `size="sm"` er 36px. StarRating har sin egen size-prop og er ikke et
    // tryk-mål, så kun Button-linjer tæller.
    const linjer = (fil?.indhold ?? '').split('\n');
    const smaa = linjer.filter(
      (linje, i) =>
        /size="sm"/.test(linje) &&
        !/StarRating/.test(linje) &&
        !/StarRating/.test(linjer[i - 1] ?? '') &&
        !/StarRating/.test(linjer[i - 2] ?? ''),
    );
    expect(
      smaa,
      `${navn} bruger size="sm" (36px). Husets egen button.tsx siger 44px er ` +
        'den mindste komfortable berøringsflade — brug "md" eller "lg".',
    ).toEqual([]);
  });

  it.each(FILER.map((f) => f.navn))('%s: intet interaktivt bag hover', (navn) => {
    const fil = FILER.find((f) => f.navn === navn);
    const linjer = (fil?.indhold ?? '').split('\n');
    // Kommentarer må gerne nævne det; det er klassenavnet der er problemet.
    const skjult = linjer.filter(
      (linje) =>
        !linje.trimStart().startsWith('*') &&
        !linje.trimStart().startsWith('//') &&
        /opacity-0/.test(linje) &&
        /(group-)?hover:opacity/.test(linje),
    );
    expect(
      skjult,
      `${navn} skjuler noget bag hover. En telefon har ikke hover, så det ville ` +
        'være usynligt netop dér fladen skal bruges.',
    ).toEqual([]);
  });
});
