import { describe, expect, it } from 'vitest';
import { formatCountry, formatNumber, formatRating, initialsOf } from './format';

describe('dansk formatering', () => {
  it('bruger komma som decimaltegn', () => {
    expect(formatNumber(7.5)).toBe('7,5');
    expect(formatRating(4)).toBe('4,0');
    expect(formatRating(4.5)).toBe('4,5');
  });

  it('bruger punktum som tusindtalsseparator', () => {
    expect(formatNumber(1284)).toBe('1.284');
  });
});

describe('formatCountry', () => {
  it('oversætter landekoder til danske navne', () => {
    expect(formatCountry('DK')).toBe('Danmark');
    expect(formatCountry('ie')).toBe('Irland');
  });

  it('falder tilbage til koden når den ikke kan slås op', () => {
    expect(formatCountry(null)).toBeNull();
    expect(formatCountry(undefined)).toBeNull();
    // Ikke en gyldig regionskode — Intl kaster, og vi viser koden som den er.
    expect(formatCountry('XYZ')).toBe('XYZ');
  });
});

describe('initialsOf', () => {
  it('tager de to første forbogstaver', () => {
    expect(initialsOf('Mathias Foldager')).toBe('MF');
    expect(initialsOf('Signe K.')).toBe('SK');
    expect(initialsOf('alice')).toBe('A');
  });
});
