import type { TasteProfile } from "@maanslogen/contracts";
import { Panel } from "@/components/ui/panel";
import { Meter, MeterRow } from "@/components/ui/meter";
import { formatCount, formatNumber } from "@/lib/format";

/**
 * Smagsprofilen er summen af alle anmelderes svar. Tallene står altid ved
 * siden af skalaerne — en skalalængde alene kan hverken læses op eller
 * sammenlignes præcist.
 *
 * Måleværdier står i signalfarven, aldrig i accent. Accent er til handlinger
 * og bedømmelser; det her er aflæsninger.
 */
export function TasteProfilePanel({ profile }: { profile: TasteProfile }) {
  if (profile.entries.length === 0) return null;

  const skalaer = profile.entries.filter(
    (entry) => entry.answerType === "SCALE" || entry.answerType === "NUMBER",
  );
  const jaNej = profile.entries.filter((entry) => entry.answerType === "BOOLEAN");
  const valg = profile.entries.filter(
    (entry) => entry.answerType === "SELECT" || entry.answerType === "MULTI_SELECT",
  );

  return (
    <Panel
      title="Smagsprofil"
      tone="signal"
      meta={`${formatCount(profile.reviewCount)} ${profile.reviewCount === 1 ? "svar" : "svar"}`}
    >
      <div className="flex flex-col gap-6">
        {skalaer.length > 0 ? (
          <dl className="flex flex-col gap-3">
            {skalaer.map((entry) => {
              const max = entry.scaleMax ?? 5;
              return (
                <MeterRow
                  key={entry.questionId}
                  label={entry.prompt}
                  value={entry.average ?? 0}
                  max={max}
                  tone="signal"
                  display={entry.average === null ? "—" : `${formatNumber(entry.average)} / ${max}`}
                />
              );
            })}
          </dl>
        ) : null}

        {jaNej.length > 0 ? (
          <div className="flex flex-col gap-3">
            {jaNej.map((entry) => {
              const procent = Math.round((entry.yesRatio ?? 0) * 100);
              return (
                <div key={entry.questionId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="min-w-0 truncate font-mono text-xs text-ink-soft"
                      title={entry.prompt}
                    >
                      {entry.prompt}
                    </span>
                    <span className="tabular shrink-0 font-mono text-xs text-signal">
                      {procent} % ja
                    </span>
                  </div>
                  <Meter value={procent} max={100} tone="signal" />
                  <span className="label-mono">
                    {formatCount(entry.responses)}{" "}
                    {entry.responses === 1 ? "besvarelse" : "besvarelser"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {valg.map((entry) => (
          <div key={entry.questionId} className="flex flex-col gap-2">
            <span className="label-mono truncate" title={entry.prompt}>
              {entry.prompt}
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {entry.buckets.slice(0, 6).map((bucket) => (
                <li
                  key={bucket.value}
                  className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[3px] border border-line bg-sunken px-2 py-1 font-mono text-[0.6875rem] text-ink-soft"
                >
                  {bucket.label}
                  <span className="tabular font-medium text-signal">{bucket.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
