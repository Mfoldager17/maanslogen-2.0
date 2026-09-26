import { describe, expect, it, vi } from 'vitest';
import { uniqueSlug } from './slug';

describe('uniqueSlug', () => {
  it('bruger basen når den er ledig', async () => {
    expect(await uniqueSlug('Beer Geek Breakfast', async () => false)).toBe('beer-geek-breakfast');
  });

  it('tæller op indtil der er en ledig', async () => {
    const taken = new Set(['ipa', 'ipa-2', 'ipa-3']);
    const isTaken = vi.fn(async (candidate: string) => taken.has(candidate));
    expect(await uniqueSlug('IPA', isTaken)).toBe('ipa-4');
  });

  it('falder tilbage til et navn frem for et tomt slug', async () => {
    expect(await uniqueSlug('!!!', async () => false)).toBe('uden-navn');
  });
});
