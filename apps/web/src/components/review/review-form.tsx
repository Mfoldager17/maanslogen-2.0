"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  validateAnswer,
  type AnswerValue,
  type ReviewForm as ReviewFormData,
} from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, Textarea } from "@/components/ui/field";
import { StarInput } from "./star-input";
import { QuestionInput } from "./question-input";
import { Cheers } from "@/components/motion/cheers";

type Answers = Record<string, AnswerValue | null>;

export function ReviewForm({ form, slug }: { form: ReviewFormData; slug: string }) {
  const router = useRouter();
  const existing = form.existingReview;

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(
      (existing?.answers ?? []).map((answer) => [answer.questionId, answer.value]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const requiredCount = form.questions.filter((question) => question.required).length;
  const answeredRequired = form.questions.filter(
    (question) => question.required && !isEmpty(answers[question.id]),
  ).length;

  // Samme validator som API'et bruger — reglerne findes kun ét sted, så
  // formularen ikke kan komme til at være mildere end serveren.
  const localErrors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const question of form.questions) {
      const message = validateAnswer(question, answers[question.id]);
      if (message) found[question.id] = message;
    }
    return found;
  }, [answers, form.questions]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors = { ...localErrors };
    if (rating === 0) nextErrors.rating = "Vælg en bedømmelse";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        answers: Object.entries(answers)
          .filter(([, value]) => !isEmpty(value))
          .map(([questionId, value]) => ({ questionId, value: value as AnswerValue })),
      };

      if (existing) {
        await api.reviews.update(existing.id, payload);
      } else {
        await api.reviews.create({ beverageId: form.beverageId, ...payload });
      }

      setDone(true);
      toast.success(existing ? "Anmeldelsen er opdateret" : "Skål — anmeldelsen er udgivet");

      // Et øjeblik til at se glassene mødes, så navigerer vi videre.
      setTimeout(() => {
        router.push(`/drikkevarer/${slug}`);
        router.refresh();
      }, 1400);
    } catch (error) {
      if (error instanceof ApiError) {
        // Serverens feltfejl bruger `answers.<id>` som nøgle; vi mapper dem
        // tilbage til de enkelte spørgsmål.
        const mapped: Record<string, string> = {};
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          mapped[field.replace(/^answers\./, "")] = message;
        }
        setErrors(mapped);
        toast.error(error.problem.detail ?? "Anmeldelsen kunne ikke gemmes");
      } else {
        toast.error("Noget gik galt. Prøv igen.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface px-6 py-16 text-center">
        <Cheers />
        <h2 className="font-display text-2xl font-semibold">Skål</h2>
        <p className="text-ink-muted">Din anmeldelse er gemt. Vi sender dig tilbage …</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {existing ? (
        <Alert tone="info" title="Du har allerede anmeldt denne">
          Ændringerne erstatter din eksisterende anmeldelse.
        </Alert>
      ) : null}

      <fieldset className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <legend className="px-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
          Din bedømmelse
        </legend>
        <StarInput value={rating} onChange={setRating} error={errors.rating} />
      </fieldset>

      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-title" className="text-sm font-semibold">
            Overskrift
          </label>
          <Input
            id="review-title"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Kaffen bærer den hele vejen"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-body" className="text-sm font-semibold">
            Dine noter <span className="font-normal text-ink-muted">(valgfrit)</span>
          </label>
          <Textarea
            id="review-body"
            value={body}
            rows={4}
            maxLength={5000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Hvad lagde du mærke til? Duft, mundfølelse, eftersmag …"
          />
        </div>
      </div>

      {form.questions.length > 0 ? (
        <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Spørgsmål for {form.beverageName}
            </h2>
            {requiredCount > 0 ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
                {answeredRequired}/{requiredCount} obligatoriske
              </span>
            ) : null}
          </div>

          {form.questions.map((question) => (
            <QuestionInput
              key={question.id}
              question={question}
              value={answers[question.id] ?? null}
              onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
              error={errors[question.id]}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Gemmer …" : existing ? "Gem ændringer" : "Udgiv anmeldelse"}
        </Button>
        <p className="text-sm text-ink-muted">Du kan altid redigere din anmeldelse bagefter.</p>
      </div>
    </form>
  );
}

function isEmpty(value: AnswerValue | null | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
