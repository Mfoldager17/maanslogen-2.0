"use client";

import type { AnswerValue, Question } from "@maanslogen/contracts";
import { cn } from "@/lib/cn";

/**
 * Én komponent der kan gengive alle svartyper. Tilføjer man en ny type af
 * spørgsmål i admin, dukker det rigtige felt op her uden at nogen rører
 * formularen — det er hele pointen med den dynamiske model.
 */
export function QuestionInput({
  question,
  value,
  onChange,
  error,
}: {
  question: Question;
  value: AnswerValue | null;
  onChange: (value: AnswerValue | null) => void;
  error?: string;
}) {
  const describedBy = error
    ? `${question.id}-error`
    : question.helpText
      ? `${question.id}-hint`
      : undefined;

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 text-sm font-semibold">
        {question.prompt}
        {question.required ? (
          <span className="ml-0.5 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>

      {question.helpText && !error ? (
        <p id={`${question.id}-hint`} className="mb-2 text-xs text-ink-muted">
          {question.helpText}
        </p>
      ) : null}

      <Control question={question} value={value} onChange={onChange} describedBy={describedBy} />

      {error ? (
        <p
          id={`${question.id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Control({
  question,
  value,
  onChange,
  describedBy,
}: {
  question: Question;
  value: AnswerValue | null;
  onChange: (value: AnswerValue | null) => void;
  describedBy?: string;
}) {
  switch (question.answerType) {
    case "SCALE": {
      const min = question.scale?.min ?? 1;
      const max = question.scale?.max ?? 5;
      const steps = Array.from({ length: max - min + 1 }, (_, index) => min + index);

      return (
        <div className="flex flex-wrap items-center gap-3">
          {question.scale?.minLabel ? (
            <span
              className="max-w-28 shrink-0 truncate text-xs text-ink-muted"
              title={question.scale.minLabel}
            >
              {question.scale.minLabel}
            </span>
          ) : null}
          {/* En skala med mange trin skal ombrydes, ikke skubbe siden ud til siden. */}
          <div className="flex min-w-0 flex-wrap gap-2">
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => onChange(value === step ? null : step)}
                aria-pressed={value === step}
                className={cn(
                  "h-11 min-w-11 rounded-[var(--radius-control)] border px-3 text-sm font-semibold transition-colors",
                  value === step
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line-strong bg-canvas hover:bg-sunken",
                )}
              >
                {step}
              </button>
            ))}
          </div>
          {question.scale?.maxLabel ? (
            <span
              className="max-w-28 shrink-0 truncate text-right text-xs text-ink-muted"
              title={question.scale.maxLabel}
            >
              {question.scale.maxLabel}
            </span>
          ) : null}
        </div>
      );
    }

    case "BOOLEAN":
      return (
        <div className="flex gap-2">
          {[
            { key: true, label: "Ja" },
            { key: false, label: "Nej" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(value === option.key ? null : option.key)}
              aria-pressed={value === option.key}
              className={cn(
                "h-11 rounded-[var(--radius-control)] border px-5 text-sm font-semibold transition-colors",
                value === option.key
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line-strong bg-canvas hover:bg-sunken",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      );

    case "SELECT":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          aria-describedby={describedBy}
          className="h-11 w-full max-w-sm rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 text-sm"
        >
          <option value="">Vælg …</option>
          {(question.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "MULTI_SELECT": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(question.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((entry) => entry !== option.value)
                      : [...selected, option.value],
                  )
                }
                aria-pressed={active}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-hover"
                    : "border-line-strong bg-canvas hover:bg-sunken",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    case "NUMBER":
      return (
        <input
          type="number"
          inputMode="decimal"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
          aria-describedby={describedBy}
          className="h-11 w-full max-w-40 rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 text-sm"
        />
      );

    default:
      return (
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          aria-describedby={describedBy}
          className="w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 py-2.5 text-sm leading-relaxed"
        />
      );
  }
}
