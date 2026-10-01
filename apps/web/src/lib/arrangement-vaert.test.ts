import { describe, expect, it } from 'vitest';
import { arrangementsSti } from './arrangement-vaert';

const VAERT = 'arrangement-maanslogen.mathiasfoldager.com';

/** Kortform: kun det der varierer i den enkelte prøve. */
function sti(pathname: string, vaert: string | null = VAERT, arrangementVaert = VAERT) {
  return arrangementsSti({ vaert, pathname, arrangementVaert });
}

describe('arrangementsværten', () => {
  describe('skriver om', () => {
    it('roden til listen, uden skråstreg til sidst', () => {
      // `/arrangementer/` ville få Next til at viderestille for at fjerne
      // skråstregen — og så stod den indre adresse i adresselinjen.
      expect(sti('/')).toBe('/arrangementer');
    });

    it('et slug til ét arrangement', () => {
      expect(sti('/ginsmagning')).toBe('/arrangementer/ginsmagning');
    });

    it('styringen under et arrangement', () => {
      // Den korte adresse på arrangementsværten. Uden den ville styringen
      // kun kunne nås på hovedværtens lange form.
      expect(sti('/ginsmagning/styring')).toBe('/arrangementer/ginsmagning/styring');
    });

    it('uanset store bogstaver i værtsnavnet', () => {
      // Host-headeren er ikke versalfølsom, og en browser kan sende hvad som helst.
      expect(sti('/ginsmagning', VAERT.toUpperCase())).toBe('/arrangementer/ginsmagning');
    });
  });

  describe('lader være', () => {
    it('når variablen ikke er sat', () => {
      // Den normale tilstand indtil værten findes. Da er der kun én vært, og
      // alt ligger under /arrangementer som før.
      //
      // Kaldt direkte: hjælpefunktionens standardværdi ville sluge et
      // `undefined` sendt som argument, og prøven ville måle ingenting.
      expect(
        arrangementsSti({ vaert: VAERT, pathname: '/ginsmagning', arrangementVaert: undefined }),
      ).toBeNull();
      expect(
        arrangementsSti({ vaert: VAERT, pathname: '/ginsmagning', arrangementVaert: '' }),
      ).toBeNull();
    });

    it('på enhver anden vært', () => {
      expect(sti('/ginsmagning', 'maanslogen.mathiasfoldager.com')).toBeNull();
      expect(sti('/', 'maanslogen.mathiasfoldager.com')).toBeNull();
    });

    it('når Host-headeren mangler', () => {
      expect(sti('/ginsmagning', null)).toBeNull();
    });

    it('når stien allerede peger på et arrangement', () => {
      // Ellers blev /arrangementer til /arrangementer/arrangementer.
      expect(sti('/arrangementer')).toBeNull();
      expect(sti('/arrangementer/ginsmagning')).toBeNull();
      expect(sti('/arrangementer/ginsmagning/styring')).toBeNull();
    });

    it('på login og opret — sessionen er host-only pr. vært', () => {
      // Kun stien — `nextUrl.pathname` bærer aldrig query-strengen med.
      expect(sti('/log-ind')).toBeNull();
      expect(sti('/opret')).toBeNull();
    });

    it('på API-kald', () => {
      // De er videresendt til API'et af next.config.ts. Blev de skrevet om,
      // ville hvert eneste kald fra browseren ende i en 404.
      expect(sti('/api/v1/gatherings')).toBeNull();
      expect(sti('/api/v1/auth/login')).toBeNull();
    });
  });

  describe('lader sig ikke narre', () => {
    it('af en sti der blot begynder som en delt sti', () => {
      // "/log-ind-alligevel" er ikke login-siden. Uden grænsen i mønsteret
      // ville den slippe uden om og aldrig blive et arrangement.
      expect(sti('/log-ind-alligevel')).toBe('/arrangementer/log-ind-alligevel');
      expect(sti('/apiv2')).toBe('/arrangementer/apiv2');
    });

    it('af et slug der begynder som arrangementer', () => {
      expect(sti('/arrangementerne')).toBe('/arrangementer/arrangementerne');
    });

    it('af en vært der blot ender ens', () => {
      // Samme fælde som i COOKIE_DOMAIN-vagten: en streng der ender ens er
      // ikke den samme vært.
      expect(sti('/ginsmagning', `ikke-${VAERT}`)).toBeNull();
    });
  });
});
