import { describe, expect, it } from 'vitest';
import { durationToSeconds } from './token.service';

describe('durationToSeconds', () => {
  it('oversætter alle understøttede enheder', () => {
    expect(durationToSeconds('45s')).toBe(45);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('24h')).toBe(86_400);
    expect(durationToSeconds('30d')).toBe(2_592_000);
  });

  it('fejler højlydt på noget den ikke forstår', () => {
    expect(() => durationToSeconds('et kvarter')).toThrowError(/Ugyldig varighed/);
  });
});
