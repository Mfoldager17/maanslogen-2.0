import { describe, expect, it } from 'vitest';
import { idOrSlugWhere, isUuid } from './id-or-slug';

describe('idOrSlugWhere', () => {
  it('slår op på id når værdien er et UUID', () => {
    const id = '56bfedd0-f522-4972-9656-47e4c8d3d7bc';
    expect(idOrSlugWhere(id)).toEqual({ id });
  });

  it('slår op på slug ellers', () => {
    // Uden dette ville Postgres fejle på uuid-castet før den nåede slug-kolonnen.
    expect(idOrSlugWhere('mikkeller-beer-geek-breakfast')).toEqual({
      slug: 'mikkeller-beer-geek-breakfast',
    });
  });

  it('genkender ikke halve UUID’er', () => {
    expect(isUuid('56bfedd0-f522')).toBe(false);
    expect(isUuid('56bfedd0f5224972965647e4c8d3d7bc')).toBe(false);
  });
});
