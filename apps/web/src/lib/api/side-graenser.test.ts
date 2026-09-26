import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_PAGE_SIZE } from '@maanslogen/contracts';

/**
 * Fire admin-sider bad om `limit: 200` og `limit: 300`, hvor API'et højst
 * tillader 100. De svarede 422 og var altså i stykker — og ingen test fangede
 * det, fordi tallet står i et objekt-literal som TypeScript gladeligt
 * accepterer.
 *
 * Grænsen står i kontrakterne, så den her test læser den derfra og kan ikke
 * komme ud af trit med den.
 */

const ROD = path.resolve(__dirname, '../..');

function alleKildefiler(mappe: string): string[] {
  return readdirSync(mappe).flatMap((navn) => {
    const sti = path.join(mappe, navn);
    if (statSync(sti).isDirectory()) return alleKildefiler(sti);
    return /\.tsx?$/.test(navn) && !navn.endsWith('.test.ts') ? [sti] : [];
  });
}

describe('sidegrænser', () => {
  it("beder aldrig om flere rækker end API'et tillader", () => {
    const overtraedelser: string[] = [];

    for (const fil of alleKildefiler(ROD)) {
      const linjer = readFileSync(fil, 'utf8').split('\n');
      linjer.forEach((linje, i) => {
        // Kun rigtige kald, ikke tal i kommentarer.
        if (linje.trimStart().startsWith('*') || linje.trimStart().startsWith('//')) return;
        for (const fund of linje.matchAll(/\blimit:\s*(\d+)/g)) {
          const vaerdi = Number(fund[1]);
          if (vaerdi > MAX_PAGE_SIZE) {
            overtraedelser.push(
              `${path.relative(ROD, fil)}:${i + 1} beder om limit: ${vaerdi} (højst ${MAX_PAGE_SIZE})`,
            );
          }
        }
      });
    }

    expect(
      overtraedelser,
      `Brug alleSider() når listen skal være komplet:\n${overtraedelser.join('\n')}`,
    ).toEqual([]);
  });
});
