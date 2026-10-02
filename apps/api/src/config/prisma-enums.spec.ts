import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  attributeDataTypeSchema,
  gatheringKindSchema,
  gatheringStatusSchema,
  mediaOwnerTypeSchema,
  mediaVariantSchema,
  questionAnswerTypeSchema,
  roleSchema,
} from '@maanslogen/contracts';

/**
 * `packages/contracts/src/enums.ts` lover at Prisma og kontrakterne har præcis
 * de samme værdier. Den lovede test fandtes bare ikke — så et nyt medlem kunne
 * tilføjes ét sted og mangle det andet, og fejlen ville først vise sig som et
 * valideringsbrud i drift.
 *
 * Der læses fra schema.prisma frem for fra den genererede klient: klienten er
 * et byggeprodukt, og en glemt `prisma generate` ville gøre testen grøn på
 * forældede data.
 */
const SCHEMA = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8');

function prismaEnumValues(name: string): string[] {
  const match = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, 'm').exec(SCHEMA);
  const krop = match?.[1];
  if (krop === undefined) throw new Error(`Fandt ikke enum ${name} i schema.prisma`);
  return krop
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@@'));
}

const PAR: Array<{ prisma: string; values: readonly string[] }> = [
  { prisma: 'Role', values: roleSchema.options },
  { prisma: 'AttributeDataType', values: attributeDataTypeSchema.options },
  { prisma: 'QuestionAnswerType', values: questionAnswerTypeSchema.options },
  { prisma: 'MediaVariant', values: mediaVariantSchema.options },
  { prisma: 'MediaOwnerType', values: mediaOwnerTypeSchema.options },
  { prisma: 'GatheringKind', values: gatheringKindSchema.options },
  { prisma: 'GatheringStatus', values: gatheringStatusSchema.options },
];

describe('Prisma-enums og kontrakter', () => {
  it.each(PAR)('$prisma har de samme værdier begge steder', ({ prisma, values }) => {
    // Sammenlignes sorteret: rækkefølgen i filen er ligegyldig, indholdet ikke.
    expect([...prismaEnumValues(prisma)].sort()).toEqual([...values].sort());
  });

  it('dækker alle enums i schema.prisma', () => {
    const iSkemaet = [...SCHEMA.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]).sort();
    const daekket = PAR.map((p) => p.prisma).sort();
    // Uden denne ville en helt ny enum kunne tilføjes i Prisma uden at nogen
    // opdagede at den mangler i kontrakterne.
    expect(iSkemaet).toEqual(daekket);
  });
});
