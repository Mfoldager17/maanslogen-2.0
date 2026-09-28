"use client";

import {
  questionAnswerTypeSchema,
  type AttributeOption,
  type Category,
  type Question,
  type QuestionAnswerType,
} from "@maanslogen/contracts";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api/api.browser";
import { SimpleResourcePanel } from "./simple-resource-panel";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ANSWER_LABELS: Record<QuestionAnswerType, string> = {
  TEXT: "Fritekst",
  NUMBER: "Tal",
  BOOLEAN: "Ja/nej",
  SCALE: "Skala",
  SELECT: "Ét valg",
  MULTI_SELECT: "Flere valg",
};

interface Draft {
  prompt: string;
  helpText: string;
  answerType: QuestionAnswerType;
  required: boolean;
  sortOrder: string;
  scaleMin: string;
  scaleMax: string;
  minLabel: string;
  maxLabel: string;
  options: AttributeOption[];
  categoryIds: string[];
  active: boolean;
}

const EMPTY: Draft = {
  prompt: "",
  helpText: "",
  answerType: "SCALE",
  required: false,
  sortOrder: "0",
  scaleMin: "1",
  scaleMax: "5",
  minLabel: "",
  maxLabel: "",
  options: [],
  categoryIds: [],
  active: true,
};

function toPayload(draft: Draft) {
  const needsOptions = draft.answerType === "SELECT" || draft.answerType === "MULTI_SELECT";
  return {
    prompt: draft.prompt.trim(),
    helpText: draft.helpText.trim() || undefined,
    answerType: draft.answerType,
    required: draft.required,
    sortOrder: Number(draft.sortOrder) || 0,
    scale:
      draft.answerType === "SCALE"
        ? {
            min: Number(draft.scaleMin) || 1,
            max: Number(draft.scaleMax) || 5,
            minLabel: draft.minLabel.trim() || undefined,
            maxLabel: draft.maxLabel.trim() || undefined,
          }
        : null,
    options: needsOptions ? draft.options : null,
    categoryIds: draft.categoryIds,
    active: draft.active,
  };
}

export function QuestionPanel({
  questions,
  categories,
}: {
  questions: Question[];
  categories: Category[];
}) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <SimpleResourcePanel
      items={questions.map((question) => ({
        ...question,
        title: question.prompt,
        subtitle:
          question.categoryIds.length === 0
            ? "Alle kategorier"
            : question.categoryIds.map((id) => categoryName.get(id) ?? "?").join(", "),
        meta: (
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            {question.required ? <Badge tone="accent">Påkrævet</Badge> : null}
            <Badge>{ANSWER_LABELS[question.answerType]}</Badge>
          </span>
        ),
      }))}
      emptyDraft={EMPTY}
      toDraft={(question) => ({
        prompt: question.prompt,
        helpText: question.helpText ?? "",
        answerType: question.answerType,
        required: question.required,
        sortOrder: String(question.sortOrder),
        scaleMin: String(question.scale?.min ?? 1),
        scaleMax: String(question.scale?.max ?? 5),
        minLabel: question.scale?.minLabel ?? "",
        maxLabel: question.scale?.maxLabel ?? "",
        options: question.options ?? [],
        categoryIds: question.categoryIds,
        active: question.active,
      })}
      onCreate={(draft) => api.questions.create(toPayload(draft))}
      onUpdate={(id, draft) => {
        // answerType kan ikke ændres: gemte svar ligger i typebestemte kolonner.
        const { answerType: _answerType, ...updatable } = toPayload(draft);
        return api.questions.update(id, updatable);
      }}
      onDelete={(id) => api.questions.remove(id)}
      labels={{
        singular: "Spørgsmål",
        plural: "Spørgsmål",
        emptyTitle: "Ingen spørgsmål endnu",
        emptyDescription: "Spørgsmålene er dem anmelderne besvarer ud over stjernerne.",
      }}
      renderForm={({ draft, setDraft, errors }) => (
        <>
          <Field label="Spørgsmål" error={errors.prompt} required>
            {(props) => (
              <Input
                {...props}
                value={draft.prompt}
                onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
                placeholder="Hvor bitter er den?"
              />
            )}
          </Field>

          <Field label="Hjælpetekst" error={errors.helpText}>
            {(props) => (
              <Input
                {...props}
                value={draft.helpText}
                onChange={(event) => setDraft({ ...draft, helpText: event.target.value })}
              />
            )}
          </Field>

          <Field label="Svartype" error={errors.answerType} required>
            {(props) => (
              <NativeSelect
                {...props}
                value={draft.answerType}
                onChange={(event) =>
                  setDraft({ ...draft, answerType: event.target.value as QuestionAnswerType })
                }
              >
                {questionAnswerTypeSchema.options.map((option) => (
                  <option key={option} value={option}>
                    {ANSWER_LABELS[option]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          {draft.answerType === "SCALE" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fra">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    value={draft.scaleMin}
                    onChange={(event) => setDraft({ ...draft, scaleMin: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Til">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    value={draft.scaleMax}
                    onChange={(event) => setDraft({ ...draft, scaleMax: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Etiket, lav ende">
                {(props) => (
                  <Input
                    {...props}
                    value={draft.minLabel}
                    onChange={(event) => setDraft({ ...draft, minLabel: event.target.value })}
                    placeholder="Slet ikke"
                  />
                )}
              </Field>
              <Field label="Etiket, høj ende">
                {(props) => (
                  <Input
                    {...props}
                    value={draft.maxLabel}
                    onChange={(event) => setDraft({ ...draft, maxLabel: event.target.value })}
                    placeholder="Meget"
                  />
                )}
              </Field>
            </div>
          ) : null}

          {draft.answerType === "SELECT" || draft.answerType === "MULTI_SELECT" ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Valgmuligheder</legend>
              <ul className="flex flex-col gap-2">
                {draft.options.map((option, index) => (
                  <li key={index} className="flex gap-2">
                    <input
                      aria-label={`Nøgle ${index + 1}`}
                      value={option.value}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((entry, position) =>
                            position === index ? { ...entry, value: event.target.value } : entry,
                          ),
                        })
                      }
                      placeholder="coffee"
                      className="h-10 w-28 rounded-[var(--radius-control)] border border-line-strong bg-canvas px-2.5 font-mono text-xs"
                    />
                    <input
                      aria-label={`Etiket ${index + 1}`}
                      value={option.label}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((entry, position) =>
                            position === index ? { ...entry, label: event.target.value } : entry,
                          ),
                        })
                      }
                      placeholder="Kaffe"
                      className="h-10 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-canvas px-2.5 text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Fjern valgmulighed ${index + 1}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          options: draft.options.filter((_, position) => position !== index),
                        })
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {errors.options ? (
                <p className="mt-1.5 text-xs font-medium text-danger">{errors.options}</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setDraft({ ...draft, options: [...draft.options, { value: "", label: "" }] })
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tilføj
              </Button>
            </fieldset>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Gælder for</legend>
            <p className="mb-2 text-xs text-ink-muted">Ingen valgte = alle kategorier.</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = draft.categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        categoryIds: active
                          ? draft.categoryIds.filter((id) => id !== category.id)
                          : [...draft.categoryIds, category.id],
                      })
                    }
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      active
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line-strong bg-canvas text-ink-soft hover:bg-sunken",
                    )}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(event) => setDraft({ ...draft, required: event.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Påkrævet
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Aktivt
            </label>
          </div>
        </>
      )}
    />
  );
}
