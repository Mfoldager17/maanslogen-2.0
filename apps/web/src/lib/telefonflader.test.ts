import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

// Hele arrangementsområdet ligger nu i (arrangement). Stod den gamle sti
// stadig her, ville filerUnder svare [] for den, og dækningen ville skrumpe
// uden at noget blev rødt.
const MAPPER = ['components/gathering', 'app/(arrangement)'];

function filerUnder(mappe: string): string[] {
  const rod = path.join(WEB, mappe);
  // En mappe der ikke findes er i sig selv et fund, men den skal rapporteres
  // af en test med en læsbar besked — ikke som en ENOENT der vælter hele filen
  // ved import, før en eneste assertion er kørt. `finder filerne` og
  // `ligger hvor testen tror` fanger den.
  if (!existsSync(rod)) return [];
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

/**
 * Fladen skal stå for sig selv.
 *
 * Sidehovedet er 56px plus en mobil-navrække, og sidefoden ligger nedenunder.
 * På en telefon er det omkring en tredjedel af skærmen brugt på at navigere
 * *væk* fra netop den side man står og bruger — midt i en smagning, med én
 * hånd. Lå siden i `(public)`, ville den arve begge dele.
 *
 * Testen går layoutkæden op fra siden, præcis som Next selv gør, frem for at
 * kigge på én fil. Flytter nogen siden tilbage i en rutegruppe med sidehoved,
 * samler kæden det op, og det her bliver rødt.
 */
describe('arrangementsfladen bærer ikke sitets ramme', () => {
  /**
   * Begge sider, ikke kun detaljen.
   *
   * Første forsøg flyttede kun detaljesiden. Listen blev liggende i (public)
   * med sidehoved og sidefod — og det er netop listen arrangementsværtens `/`
   * peger på, så indgangen til fladen så ud som hovedsitet. Det blev opdaget
   * ved at kigge på skærmen, ikke af en test. Nu dækker testen begge.
   */
  const SIDER = [
    'app/(arrangement)/arrangementer/page.tsx',
    'app/(arrangement)/arrangementer/[slug]/page.tsx',
    'app/(arrangement)/arrangementer/[slug]/styring/page.tsx',
  ];

  /** Alle layout.tsx fra sidens egen mappe og op til app/, som Next stabler dem. */
  function layoutkaede(side: string): string[] {
    const led = path.dirname(side).split('/');
    const kaede: string[] = [];

    while (led.length > 0) {
      const kandidat = path.join(WEB, ...led, 'layout.tsx');
      if (existsSync(kandidat)) kaede.push(path.relative(WEB, kandidat));
      if (led[led.length - 1] === 'app') break;
      led.pop();
    }

    return kaede;
  }

  it.each(SIDER)('%s ligger hvor testen tror', (side) => {
    // Uden denne ville en omdøbt fil give en tom kæde, og resten ville bestå
    // ved at kigge på ingenting.
    expect(existsSync(path.join(WEB, side)), `${side} findes ikke`).toBe(true);
  });

  it.each(SIDER)('%s har et layout af sin egen', (side) => {
    expect(layoutkaede(side)).toContain('app/(arrangement)/layout.tsx');
  });

  it.each(SIDER)('%s samler hverken sidehoved eller sidefod op', (side) => {
    const ramme = layoutkaede(side).flatMap((layout) => {
      const indhold = readFileSync(path.join(WEB, layout), 'utf8');
      return ['SiteHeader', 'SiteFooter']
        .filter((navn) => indhold.includes(navn))
        .map((navn) => `${layout} trækker ${navn} ind`);
    });

    expect(
      ramme,
      'Arrangementsfladen skal være ren. Sidehoved og sidefod koster omkring ' +
        'en tredjedel af en telefonskærm på navigation væk fra siden:\n' +
        ramme.join('\n'),
    ).toEqual([]);
  });
});

/**
 * Fladen skal kunne stå alene.
 *
 * Tandhjulet i bjælken pegede på `/admin/arrangementer/{id}`. Et tryk dér
 * sendte en, der står midt i en smagning med telefonen i den ene hånd, ud af
 * den rene flade og ind i sitets admin — sidehoved, brødkrummer og sidefod,
 * altså præcis den ramme fladen findes for at slippe af med.
 *
 * En typecheck fanger det ikke: `/admin/arrangementer/{id}` *er* en gyldig
 * rute. Den fører bare det forkerte sted hen.
 */
describe('arrangementsfladen peger ikke ind i admin', () => {
  it.each(FILER.map((f) => f.navn))('%s', (navn) => {
    const fil = FILER.find((f) => f.navn === navn);
    // Kun adresser i kode. Kommentarer må gerne nævne admin — den her fil
    // handler netop om hvorfor man ikke skal derhen.
    const udad = (fil?.indhold ?? '')
      .split('\n')
      .filter((linje) => {
        const trimmet = linje.trimStart();
        if (trimmet.startsWith('*') || trimmet.startsWith('//') || trimmet.startsWith('/*')) {
          return false;
        }
        return /["'`]\/admin/.test(linje);
      })
      .map((linje) => linje.trim());

    expect(
      udad,
      `${navn} peger på en adresse under /admin, og dér er sitets ramme om ` +
        'den. Fladen skal kunne stå alene — læg vejen under /arrangementer ' +
        'i stedet.',
    ).toEqual([]);
  });
});
