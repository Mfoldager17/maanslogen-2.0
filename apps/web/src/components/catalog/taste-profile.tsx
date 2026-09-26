import type { TasteProfile } from "@maanslogen/contracts";
import { LiquidBar } from "@/components/motion/liquid-bar";
import { formatNumber } from "@/lib/format";

/**
 * Smagsprofilen er summen af alle anmelderes svar. Tallene står altid ved
 * siden af søjlerne — en søjlelængde alene kan hverken læses op eller
 * sammenlignes præcist.
 */
export function TasteProfilePanel({ profile }: { profile: TasteProfile }) {
  if (profile.entries.length === 0) return null;

  const scales = profile.entries.filter(
    (entry) => entry.answerType === "SCALE" || entry.answerType === "NUMBER",
  );
  const booleans = profile.entries.filter((entry) => entry.answerType === "BOOLEAN");
  const choices = profile.entries.filter(
    (entry) => entry.answerType === "SELECT" || entry.answerType === "MULTI_SELECT",
  );

  return (
    <section aria-labelledby="smagsprofil" className="flex flex-col gap-5">
      <div>
        <h2 id="smagsprofil" className="font-display text-xl font-semibold">
          Smagsprofil
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Sammenfattet fra {profile.reviewCount}{" "}
          {profile.reviewCount === 1 ? "anmeldelse" : "anmeldelser"}.
        </p>
      </div>

      {scales.length > 0 ? (
        <dl className="flex flex-col gap-3.5">
          {scales.map((entry) => {
            const max = entry.scaleMax ?? 5;
            return (
              <div key={entry.questionId}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <dt className="min-w-0 text-ink-soft">{entry.prompt}</dt>
                  <dd className="tabular shrink-0 whitespace-nowrap font-semibold">
                    {entry.average === null ? "—" : formatNumber(entry.average)}
                    <span className="font-normal text-ink-muted"> / {max}</span>
                  </dd>
                </div>
                <LiquidBar value={entry.average ?? 0} max={max} />
              </div>
            );
          })}
        </dl>
      ) : null}

      {booleans.map((entry) => {
        const percent = Math.round((entry.yesRatio ?? 0) * 100);
        return (
          <div
            key={entry.questionId}
            className="rounded-[var(--radius-control)] bg-positive-soft px-4 py-3"
          >
            <p className="text-sm font-semibold text-positive-ink">
              {percent} % svarede ja til “{entry.prompt}”
            </p>
            <p className="mt-0.5 text-xs text-positive">
              {entry.responses} {entry.responses === 1 ? "besvarelse" : "besvarelser"}
            </p>
          </div>
        );
      })}

      {choices.map((entry) => (
        <div key={entry.questionId}>
          <p className="mb-2 text-sm text-ink-soft">{entry.prompt}</p>
          <ul className="flex flex-wrap gap-2">
            {entry.buckets.slice(0, 6).map((bucket) => (
              <li
                key={bucket.value}
                className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-3 py-1 text-xs"
              >
                {bucket.label}
                <span className="tabular font-semibold text-ink-muted">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
