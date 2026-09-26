"use client";

import { useState } from "react";
import { FizzBurst } from "@/components/motion/fizz-burst";
import { cn } from "@/lib/cn";
import { formatRating } from "@/lib/format";

const WORDS: Record<string, string> = {
  "0.5": "Helt galt",
  "1": "Skuffende",
  "1.5": "Ikke for mig",
  "2": "Går an",
  "2.5": "Lidt under middel",
  "3": "Fin nok",
  "3.5": "Over middel",
  "4": "Rigtig god",
  "4.5": "Fremragende",
  "5": "Bedste i klassen",
};

const STAR_PATH = "M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.5l6.5-1z";

/**
 * Stjerner i halve trin. Hver stjerne er to knapper — venstre halvdel giver
 * en halv, højre en hel — så det kan betjenes med både mus og tastatur uden
 * at gætte på hvor man klikker.
 */
export function StarInput({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);

  const shown = hover ?? value;

  function pick(next: number) {
    onChange(next);
    setBurst((count) => count + 1);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="relative flex gap-1"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label="Bedømmelse i halve stjerner"
      >
        {[1, 2, 3, 4, 5].map((position) => {
          const fill = Math.max(0, Math.min(1, shown - position + 1));
          return (
            <span key={position} className="relative h-10 w-10">
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-10 w-10 fill-star-empty">
                <path d={STAR_PATH} />
              </svg>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="h-10 w-10 fill-star">
                  <path d={STAR_PATH} />
                </svg>
              </span>

              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(position - 0.5)}
                onFocus={() => setHover(position - 0.5)}
                onClick={() => pick(position - 0.5)}
                aria-label={`${formatRating(position - 0.5)} stjerner`}
                aria-pressed={value === position - 0.5}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(position)}
                onFocus={() => setHover(position)}
                onClick={() => pick(position)}
                aria-label={`${position} stjerner`}
                aria-pressed={value === position}
              />
            </span>
          );
        })}

        <FizzBurst trigger={burst} />
      </div>

      <p className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-2xl font-semibold tabular",
            shown === 0 && "text-ink-muted",
          )}
        >
          {shown === 0 ? "–" : formatRating(shown)}
        </span>
        <span className="text-sm text-ink-muted">
          {shown === 0 ? "Vælg en bedømmelse" : (WORDS[String(shown)] ?? "")}
        </span>
      </p>

      {error ? (
        <p role="alert" className="w-full text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
