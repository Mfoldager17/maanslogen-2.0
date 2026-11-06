import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Webklienten kunne sende PUT, men CORS-listen i bootstrap.ts kendte den ikke.
 * Browseren afviste derfor kaldet allerede i preflight, og fordi det aldrig
 * blev til et HTTP-svar, kom fejlen frem som "kunne ikke nå serveren" —
 * altså som om API'et var nede.
 *
 * Ingen af de eksisterende tests kunne fange det: e2e kører gennem Fastifys
 * `inject`, som ikke er en browser og aldrig laver en preflight. CORS er med
 * andre ord usynligt for hele testsuiten.
 *
 * Derfor sammenlignes de to lister som tekst i stedet. Det er ikke elegant,
 * men det er den eneste måde at fange netop dén drift uden en rigtig browser,
 * og den fanger den i samme øjeblik klienten får en ny metode.
 */
const ROD = join(__dirname, '../../../..');

function metoderFraKlienten(): string[] {
  const kilde = readFileSync(join(ROD, 'apps/web/src/lib/api/client.ts'), 'utf8');
  const linje = /method\?:\s*([^;]+);/.exec(kilde);
  if (!linje?.[1]) throw new Error('Fandt ikke ApiRequest.method i webklienten');
  return [...linje[1].matchAll(/'([A-Z]+)'/g)].map((m) => m[1] ?? '');
}

function metoderFraCors(): string[] {
  const kilde = readFileSync(join(ROD, 'apps/api/src/bootstrap.ts'), 'utf8');
  const linje = /methods:\s*\[([^\]]+)\]/.exec(kilde);
  if (!linje?.[1]) throw new Error('Fandt ikke methods i enableCors');
  return [...linje[1].matchAll(/'([A-Z]+)'/g)].map((m) => m[1] ?? '');
}

describe('CORS-metoder', () => {
  const klient = metoderFraKlienten();
  const cors = metoderFraCors();

  it('finder begge lister', () => {
    // Holder op detektoren: ændrer en af filerne form, skal testen sige fra
    // frem for stiltiende at sammenligne to tomme lister.
    expect(klient.length).toBeGreaterThan(2);
    expect(cors.length).toBeGreaterThan(2);
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
    '%s er tilladt hvis klienten kan sende den',
    (metode) => {
      if (!klient.includes(metode)) return;
      expect(
        cors,
        `Webklienten kan sende ${metode}, men enableCors i bootstrap.ts tillader den ikke. ` +
          'Browseren ville afvise kaldet i preflight, og fejlen ville se ud som om serveren var nede.',
      ).toContain(metode);
    },
  );

  it('svarer på preflight', () => {
    // OPTIONS er selve preflighten. Uden den er resten ligegyldigt.
    expect(cors).toContain('OPTIONS');
  });
});
