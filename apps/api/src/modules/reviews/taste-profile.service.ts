import { Injectable } from '@nestjs/common';
import type {
  AttributeOption,
  QuestionScale,
  TasteProfile,
  TasteProfileEntry,
} from '@maanslogen/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/http/app-error';
import { idOrSlugWhere } from '../../common/utils/id-or-slug';

/**
 * Sammenfatter anmeldelsernes besvarelser til én smagsprofil pr. drikkevare.
 *
 * Det er her den dynamiske spørgsmålsmodel tjener sig hjem: fordi svarene er
 * gemt typet frem for som fritekst, kan "hvor bitter er den?" faktisk
 * aggregeres på tværs af 200 anmeldelser.
 */
@Injectable()
export class TasteProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async forBeverage(idOrSlug: string): Promise<TasteProfile> {
    const beverage = await this.prisma.beverage.findFirst({
      where: { deletedAt: null, ...idOrSlugWhere(idOrSlug) },
      select: { id: true, ratingCount: true },
    });
    if (!beverage) throw AppError.notFound('Drikkevare', idOrSlug);

    const answers = await this.prisma.reviewAnswer.findMany({
      where: { review: { beverageId: beverage.id, deletedAt: null } },
      include: { question: true },
    });

    const byQuestion = new Map<string, typeof answers>();
    for (const answer of answers) {
      const bucket = byQuestion.get(answer.questionId) ?? [];
      bucket.push(answer);
      byQuestion.set(answer.questionId, bucket);
    }

    const entries: TasteProfileEntry[] = [];
    for (const group of byQuestion.values()) {
      const entry = this.summarise(group);
      if (entry) entries.push(entry);
    }

    entries.sort((a, b) => b.responses - a.responses || a.prompt.localeCompare(b.prompt, 'da'));

    return { beverageId: beverage.id, reviewCount: beverage.ratingCount, entries };
  }

  private summarise(
    group: {
      questionId: string;
      valueText: string | null;
      valueNumber: number | null;
      valueBoolean: boolean | null;
      valueJson: unknown;
      question: { prompt: string; answerType: string; options: unknown; scale: unknown };
    }[],
  ): TasteProfileEntry | null {
    const first = group[0];
    if (!first) return null;

    const { question } = first;
    const scale = (question.scale as QuestionScale | null) ?? null;
    const options = (question.options as AttributeOption[] | null) ?? [];

    const base = {
      questionId: first.questionId,
      prompt: question.prompt,
      answerType: question.answerType as TasteProfileEntry['answerType'],
      responses: 0,
      average: null as number | null,
      scaleMin: scale?.min ?? null,
      scaleMax: scale?.max ?? null,
      yesRatio: null as number | null,
      buckets: [] as TasteProfileEntry['buckets'],
    };

    switch (question.answerType) {
      case 'SCALE':
      case 'NUMBER': {
        const numbers = group
          .map((answer) => answer.valueNumber)
          .filter((value): value is number => value !== null);
        if (numbers.length === 0) return null;
        return {
          ...base,
          responses: numbers.length,
          average: Number(
            (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2),
          ),
          scaleMax: base.scaleMax ?? (question.answerType === 'SCALE' ? 5 : null),
        };
      }

      case 'BOOLEAN': {
        const booleans = group
          .map((answer) => answer.valueBoolean)
          .filter((value): value is boolean => value !== null);
        if (booleans.length === 0) return null;
        const yes = booleans.filter(Boolean).length;
        return {
          ...base,
          responses: booleans.length,
          yesRatio: Number((yes / booleans.length).toFixed(4)),
        };
      }

      case 'SELECT':
      case 'MULTI_SELECT': {
        const counts = new Map<string, number>();
        let responses = 0;

        for (const answer of group) {
          const values =
            question.answerType === 'SELECT'
              ? answer.valueText === null
                ? []
                : [answer.valueText]
              : Array.isArray(answer.valueJson)
                ? (answer.valueJson as string[])
                : [];
          if (values.length === 0) continue;
          responses += 1;
          for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
        }

        if (responses === 0) return null;

        return {
          ...base,
          responses,
          buckets: [...counts.entries()]
            .map(([value, count]) => ({
              value,
              label: options.find((option) => option.value === value)?.label ?? value,
              count,
            }))
            .sort((a, b) => b.count - a.count),
        };
      }

      default:
        // Fritekst kan ikke aggregeres meningsfuldt — den vises på anmeldelserne.
        return null;
    }
  }
}
