import { describe, expect, it } from 'vitest';
import { attributeParams, first, toggleInList, withParams } from './query-state';

describe('first', () => {
  it('pakker arrays ud til deres første element', () => {
    expect(first({ q: 'stout' }, 'q')).toBe('stout');
    expect(first({ q: ['stout', 'ipa'] }, 'q')).toBe('stout');
    expect(first({}, 'q')).toBeUndefined();
  });
});

describe('attributeParams', () => {
  it('plukker attr[nøgle]-parametrene ud', () => {
    expect(
      attributeParams({
        'attr[alcohol_percent]': '5..9',
        'attr[color]': 'dark',
        categorySlug: 'oel',
      }),
    ).toEqual({ alcohol_percent: '5..9', color: 'dark' });
  });

  it('ignorerer tomme værdier og almindelige parametre', () => {
    expect(attributeParams({ 'attr[color]': '', q: 'stout' })).toEqual({});
  });
});

describe('withParams', () => {
  it('sætter og fjerner parametre', () => {
    const current = new URLSearchParams('categorySlug=oel&q=stout');
    expect(withParams(current, { q: null })).toBe('?categorySlug=oel');
    expect(withParams(current, { minRating: '4' })).toContain('minRating=4');
  });

  it('nulstiller altid cursoren', () => {
    // Et ændret filter gør den gamle cursor meningsløs — den peger ind i et
    // resultatsæt der ikke længere findes.
    const current = new URLSearchParams('cursor=abc123&q=stout');
    expect(withParams(current, { q: 'ipa' })).not.toContain('cursor');
  });

  it('giver en tom streng når alt er ryddet', () => {
    expect(withParams(new URLSearchParams('q=stout'), { q: null })).toBe('');
  });
});

describe('toggleInList', () => {
  it('tilføjer og fjerner værdier i en |-separeret liste', () => {
    expect(toggleInList(undefined, 'dark')).toBe('dark');
    expect(toggleInList('dark', 'amber')).toBe('dark|amber');
    expect(toggleInList('dark|amber', 'dark')).toBe('amber');
  });

  it('bliver til null når den sidste værdi fjernes', () => {
    expect(toggleInList('dark', 'dark')).toBeNull();
  });
});
