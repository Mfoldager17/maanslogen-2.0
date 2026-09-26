"use client";

import type { AttributeDefinition, AttributeValue } from "@maanslogen/contracts";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Gengiver det rigtige felt for en attributs datatype. */
export function AttributeValueInput({
  definition,
  value,
  onChange,
  error,
}: {
  definition: AttributeDefinition;
  value: AttributeValue | null;
  onChange: (value: AttributeValue | null) => void;
  error?: string;
}) {
  const hint = [
    definition.description,
    definition.rules?.min !== undefined || definition.rules?.max !== undefined
      ? `Mellem ${definition.rules?.min ?? "−∞"} og ${definition.rules?.max ?? "∞"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (definition.dataType === "BOOLEAN") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {definition.displayName}
          {definition.required ? (
            <span className="ml-0.5 text-accent" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        <div className="flex gap-2">
          {[
            { key: true, label: "Ja" },
            { key: false, label: "Nej" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={value === option.key}
              onClick={() => onChange(value === option.key ? null : option.key)}
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
        {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      </div>
    );
  }

  if (definition.dataType === "MULTI_ENUM") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {definition.displayName}
          {definition.required ? (
            <span className="ml-0.5 text-accent" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        <div className="flex flex-wrap gap-2">
          {(definition.options ?? []).map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((entry) => entry !== option.value)
                      : [...selected, option.value],
                  )
                }
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
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
        {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <Field
      label={definition.displayName}
      hint={hint || undefined}
      error={error}
      required={definition.required}
    >
      {(props) =>
        definition.dataType === "ENUM" ? (
          <NativeSelect
            {...props}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">Vælg …</option>
            {(definition.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        ) : definition.dataType === "NUMBER" ? (
          <div className="relative">
            <Input
              {...props}
              type="number"
              inputMode="decimal"
              step="any"
              value={typeof value === "number" ? value : ""}
              onChange={(event) =>
                onChange(event.target.value === "" ? null : Number(event.target.value))
              }
              className={definition.unit ? "pr-12" : undefined}
            />
            {definition.unit ? (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                {definition.unit}
              </span>
            ) : null}
          </div>
        ) : (
          <Input
            {...props}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          />
        )
      }
    </Field>
  );
}
