import type { Review, ReviewAnswer } from '@maanslogen/contracts';
import { formatAnswer, readAnswerValue, type AnswerRow } from '../questions/question.mapper';
import { pickRendition } from '@maanslogen/contracts';
import { toMediaAssetDtoOrNull, type MediaAssetRow } from '../media/media.mapper';

export interface ReviewRow {
  id: string;
  beverageId: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; displayName: string; avatar?: MediaAssetRow | null };
  beverage?: { name: string; slug: string } | null;
  answers?: AnswerRow[];
}

export function toReviewDto(row: ReviewRow): Review {
  const answers: ReviewAnswer[] = (row.answers ?? [])
    .map((answer) => {
      const value = readAnswerValue(answer);
      if (value === null || value === undefined) return null;
      return {
        questionId: answer.questionId,
        prompt: answer.question.prompt,
        answerType: answer.question.answerType,
        value,
        displayValue: formatAnswer(answer, value),
      };
    })
    .filter((answer): answer is ReviewAnswer => answer !== null)
    .sort((a, b) => a.prompt.localeCompare(b.prompt, 'da'));

  const avatar = toMediaAssetDtoOrNull(row.user.avatar);

  return {
    id: row.id,
    beverageId: row.beverageId,
    beverageName: row.beverage?.name,
    beverageSlug: row.beverage?.slug,
    author: {
      id: row.user.id,
      displayName: row.user.displayName,
      avatarUrl: pickRendition(avatar, 'AVATAR')?.url ?? null,
    },
    rating: row.rating,
    title: row.title,
    body: row.body,
    answers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
