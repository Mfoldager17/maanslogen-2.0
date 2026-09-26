import { Prisma } from '@prisma/client';
import type {
  AnswerValue,
  AttributeOption,
  Question,
  QuestionAnswerType,
  QuestionScale,
} from '@maanslogen/contracts';

export interface QuestionRow {
  id: string;
  prompt: string;
  helpText: string | null;
  answerType: QuestionAnswerType;
  required: boolean;
  sortOrder: number;
  options: unknown;
  scale: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  categories?: { id: string }[];
  types?: { id: string }[];
}

export function toQuestionDto(row: QuestionRow): Question {
  return {
    id: row.id,
    prompt: row.prompt,
    helpText: row.helpText,
    answerType: row.answerType,
    required: row.required,
    sortOrder: row.sortOrder,
    options: (row.options as AttributeOption[] | null) ?? null,
    scale: (row.scale as QuestionScale | null) ?? null,
    categoryIds: row.categories?.map((category) => category.id) ?? [],
    typeIds: row.types?.map((type) => type.id) ?? [],
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface AnswerRow {
  questionId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  question: QuestionRow;
}

export function readAnswerValue(row: AnswerRow): AnswerValue | null {
  switch (row.question.answerType) {
    case 'NUMBER':
    case 'SCALE':
      return row.valueNumber;
    case 'BOOLEAN':
      return row.valueBoolean;
    case 'MULTI_SELECT':
      return Array.isArray(row.valueJson) ? (row.valueJson as string[]) : [];
    default:
      return row.valueText;
  }
}

export interface AnswerColumns {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

export function writeAnswerValue(
  answerType: QuestionAnswerType,
  value: AnswerValue,
): AnswerColumns {
  const empty = {
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueJson: Prisma.DbNull,
  };
  switch (answerType) {
    case 'NUMBER':
    case 'SCALE':
      return { ...empty, valueNumber: typeof value === 'number' ? value : Number(value) };
    case 'BOOLEAN':
      return { ...empty, valueBoolean: Boolean(value) };
    case 'MULTI_SELECT':
      return { ...empty, valueJson: Array.isArray(value) ? value : [] };
    default:
      return { ...empty, valueText: String(value) };
  }
}

export function formatAnswer(row: AnswerRow, value: AnswerValue): string {
  const options = (row.question.options as AttributeOption[] | null) ?? null;
  switch (row.question.answerType) {
    case 'BOOLEAN':
      return value ? 'Ja' : 'Nej';
    case 'SCALE': {
      const scale = (row.question.scale as QuestionScale | null) ?? { min: 1, max: 5 };
      return `${String(value)} / ${scale.max}`;
    }
    case 'SELECT':
      return options?.find((option) => option.value === value)?.label ?? String(value);
    case 'MULTI_SELECT': {
      if (!Array.isArray(value)) return '—';
      return value
        .map((entry) => options?.find((option) => option.value === entry)?.label ?? entry)
        .join(', ');
    }
    case 'NUMBER':
      return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(Number(value));
    default:
      return String(value);
  }
}
