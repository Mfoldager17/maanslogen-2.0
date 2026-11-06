import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `/arrangementer` blev bygget med et `redirect()` til login i selve siden,
 * men uden en regel i middlewaren. Resultatet var ikke en 307, men en 200 med
 * en viderestilling klistret ind i svaret — for siden var allerede begyndt at
 * streame da adgangen blev afvist. Det er præcis dét middlewaren findes for,
 * og kommentaren øverst i `middleware.ts` siger det; jeg havde bare ikke læst
 * den, før siden opførte sig forkert.
 *
 * Testen læser reglerne ud af `middleware.ts` som tekst frem for at importere
 * dem: `config.matcher` er en streng-liste Next læser ved bygning, og en regel
 * kunne stå i `RULES` uden at være i `matcher` — så ville den aldrig køre.
 * Begge dele tjekkes derfor mod kildeteksten.
 */

const WEB = path.resolve(__dirname, '../..');
const MIDDLEWARE = readFileSync(path.join(WEB, 'src/middleware.ts'), 'utf8');

function reglerFraMiddleware(): RegExp[] {
  const fund = [...MIDDLEWARE.matchAll(/\{\s*pattern:\s*\/(.+?)\/,\s*minRole/g)];
  if (fund.length === 0) throw new Error('Fandt ingen RULES i middleware.ts');
  return fund.map((match) => new RegExp(match[1] ?? ''));
}

function matcherFraMiddleware(): string[] {
  const blok = /matcher:\s*\[([\s\S]*?)\]/.exec(MIDDLEWARE);
  if (!blok?.[1]) throw new Error('Fandt ingen config.matcher i middleware.ts');
  return [...blok[1].matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

/** `src/app/(public)/profil/anmeldelser/page.tsx` → `/profil/anmeldelser` */
function ruteFor(fil: string): string {
  const rute = path
    .relative(path.join(WEB, 'src/app'), fil)
    .replace(/\/(page|layout)\.tsx$/, '')
    .split('/')
    .filter((led) => !led.startsWith('(')) // rutegrupper er kun mapper
    .join('/');
  return `/${rute}`;
}

function alleSider(mappe: string): string[] {
  return readdirSync(mappe).flatMap((navn) => {
    const sti = path.join(mappe, navn);
    if (statSync(sti).isDirectory()) return alleSider(sti);
    return /^(page|layout)\.tsx$/.test(navn) ? [sti] : [];
  });
}

/** `/admin/:path*` dækker `/admin` og alt derunder. */
function matcherDaekker(moenster: string, rute: string): boolean {
  // Ingen escaping af klammer: mønstrene er stier som `/admin/:path*` og
  // indeholder dem ikke. Ruten kan — `[slug]` — men den er inddata, ikke
  // mønster, og rammes fint af `[^/]+`.
  const kilde = moenster.replace(/\/:\w+\*$/, '(?:/.*)?').replace(/:\w+/g, '[^/]+');
  return new RegExp(`^${kilde}$`).test(rute);
}

describe('beskyttede sider', () => {
  const regler = reglerFraMiddleware();
  const matcher = matcherFraMiddleware();

  const beskyttede = alleSider(path.join(WEB, 'src/app'))
    .filter((fil) => /redirect\(\s*[`'"]\/log-ind/.test(readFileSync(fil, 'utf8')))
    .map(ruteFor);

  it('finder de sider der sender folk til login', () => {
    // Slår testen fejl her, er detektoren holdt op med at virke — og så ville
    // resten af testen bestå uden at have set på noget som helst.
    expect(beskyttede.length).toBeGreaterThan(0);
  });

  it.each(beskyttede)('%s har en regel i middlewaren', (rute) => {
    expect(
      regler.some((regel) => regel.test(rute)),
      `${rute} viderestiller til login i sidens egen kode, men står ikke i RULES. ` +
        'Så afvises adgangen først når siden er begyndt at streame, og svaret bliver ' +
        'en 200 med en indlejret viderestilling i stedet for en 307.',
    ).toBe(true);
  });

  it.each(beskyttede)('%s er omfattet af config.matcher', (rute) => {
    expect(
      matcher.some((moenster) => matcherDaekker(moenster, rute)),
      `${rute} står i RULES, men ${matcher.join(', ')} rammer den ikke — ` +
        'så middlewaren kører slet ikke for den.',
    ).toBe(true);
  });
});
