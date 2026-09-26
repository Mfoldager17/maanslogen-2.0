"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  attributeDataTypeSchema,
  createAttributeDefinitionSchema,
  formatAttributeValue,
  type AttributeDataType,
  type AttributeDefinition,
  type AttributeOption,
  type BeverageType,
  type Category,
} from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { dynamicRoute } from "@/lib/routes";

const TYPE_LABELS: Record<AttributeDataType, string> = {
  TEXT: "Tekst",
  NUMBER: "Tal",
  BOOLEAN: "Ja/nej",
  ENUM: "Ét valg",
  MULTI_ENUM: "Flere valg",
};

interface FormState {
  key: string;
  displayName: string;
  description: string;
  dataType: AttributeDataType;
  unit: string;
  required: boolean;
  filterable: boolean;
  highlighted: boolean;
  sortOrder: string;
  min: string;
  max: string;
  options: AttributeOption[];
  categoryIds: string[];
  typeIds: string[];
}

function toFormState(definition: AttributeDefinition | null): FormState {
  return {
    key: definition?.key ?? "",
    displayName: definition?.displayName ?? "",
    description: definition?.description ?? "",
    dataType: definition?.dataType ?? "NUMBER",
    unit: definition?.unit ?? "",
    required: definition?.required ?? false,
    filterable: definition?.filterable ?? true,
    highlighted: definition?.highlighted ?? false,
    sortOrder: String(definition?.sortOrder ?? 0),
    min: definition?.rules?.min === undefined ? "" : String(definition.rules.min),
    max: definition?.rules?.max === undefined ? "" : String(definition.rules.max),
    options: definition?.options ?? [],
    categoryIds: definition?.categoryIds ?? [],
    typeIds: definition?.typeIds ?? [],
  };
}

/**
 * Bygger en attributdefinition. Højre side viser hvordan feltet kommer til at
 * se ud i drikkevareformularen og i katalogets filtre — så man kan se
 * konsekvensen før man gemmer, i stedet for at opdage den bagefter.
 */
export function AttributeBuilder({
  definition,
  categories,
  types,
}: {
  definition: AttributeDefinition | null;
  categories: Category[];
  types: BeverageType[];
}) {
  const router = useRouter();
  const mutation = useApiMutation();
  const [form, setForm] = useState<FormState>(() => toFormState(definition));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const isNew = definition === null;

  // Lokale fejl (fra Zod) og serverens feltfejl vises i de samme felter.
  const errors = { ...localErrors, ...mutation.fieldErrors };

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const needsOptions = form.dataType === "ENUM" || form.dataType === "MULTI_ENUM";
  const isNumber = form.dataType === "NUMBER";

  // Typerne begrænses til de valgte kategorier — ellers kunne man vælge en
  // stout under kategorien Vin, og reglen ville aldrig matche noget.
  const selectableTypes = useMemo(
    () =>
      form.categoryIds.length === 0
        ? types
        : types.filter((type) => form.categoryIds.includes(type.categoryId)),
    [types, form.categoryIds],
  );

  function buildPayload() {
    const rules =
      isNumber && (form.min !== "" || form.max !== "")
        ? {
            ...(form.min === "" ? {} : { min: Number(form.min) }),
            ...(form.max === "" ? {} : { max: Number(form.max) }),
          }
        : null;

    return {
      key: form.key.trim(),
      displayName: form.displayName.trim(),
      description: form.description.trim() || undefined,
      dataType: form.dataType,
      unit: form.unit.trim() || undefined,
      required: form.required,
      filterable: form.filterable,
      highlighted: form.highlighted,
      sortOrder: Number(form.sortOrder) || 0,
      rules,
      options: needsOptions ? form.options : null,
      categoryIds: form.categoryIds,
      typeIds: form.typeIds.filter((id) => selectableTypes.some((type) => type.id === id)),
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = buildPayload();

    if (isNew) {
      // Kontrolleres lokalt med præcis det skema API'et bruger, så fejl vises
      // med det samme frem for efter et rundtur til serveren.
      const parsed = createAttributeDefinitionSchema.safeParse(payload);
      if (!parsed.success) {
        const found: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".") || "form";
          found[key] ??= issue.message;
        }
        setLocalErrors(found);
        return;
      }

      setLocalErrors({});
      const created = await mutation.run(() => api.attributes.create(payload), {
        success: "Attributten er oprettet",
      });
      if (created) router.push(dynamicRoute(`/admin/attributter/${created.id}`));
      return;
    }

    // Nøgle og datatype kan ikke ændres: de binder alle gemte værdier.
    setLocalErrors({});
    const { key: _key, dataType: _dataType, ...updatable } = payload;
    await mutation.run(() => api.attributes.update(definition.id, updatable), {
      success: "Ændringerne er gemt",
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {(mutation.formError ?? localErrors.form) ? (
          <Alert tone="danger">{mutation.formError ?? localErrors.form}</Alert>
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
            Grundoplysninger
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Visningsnavn"
              className="sm:col-span-2"
              error={errors.displayName}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={form.displayName}
                  onChange={(event) => set("displayName", event.target.value)}
                  placeholder="Alkoholprocent"
                />
              )}
            </Field>

            <Field label="Enhed" hint="Vises efter værdien" error={errors.unit}>
              {(props) => (
                <Input
                  {...props}
                  value={form.unit}
                  onChange={(event) => set("unit", event.target.value)}
                  placeholder="%"
                />
              )}
            </Field>

            <Field
              label="Nøgle"
              hint={
                isNew ? "snake_case. Kan ikke ændres bagefter." : "Låst — binder gemte værdier."
              }
              error={errors.key}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={form.key}
                  disabled={!isNew}
                  onChange={(event) => set("key", event.target.value)}
                  placeholder="alcohol_percent"
                  className="font-mono"
                />
              )}
            </Field>

            <Field
              label="Datatype"
              hint={isNew ? undefined : "Låst efter oprettelse."}
              error={errors.dataType}
              required
            >
              {(props) => (
                <NativeSelect
                  {...props}
                  value={form.dataType}
                  disabled={!isNew}
                  onChange={(event) => set("dataType", event.target.value as AttributeDataType)}
                >
                  {attributeDataTypeSchema.options.map((option) => (
                    <option key={option} value={option}>
                      {TYPE_LABELS[option]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field label="Sortering" hint="Lavest vises først">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => set("sortOrder", event.target.value)}
                />
              )}
            </Field>

            {isNumber ? (
              <>
                <Field label="Mindste værdi" error={errors["rules.min"]}>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      value={form.min}
                      onChange={(event) => set("min", event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Største værdi" error={errors["rules.max"]}>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      value={form.max}
                      onChange={(event) => set("max", event.target.value)}
                    />
                  )}
                </Field>
              </>
            ) : null}

            <Field label="Beskrivelse" className="sm:col-span-3">
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="Vises som hjælpetekst i formularen."
                />
              )}
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-5 border-t border-line pt-4">
            <Toggle
              label="Påkrævet"
              checked={form.required}
              onChange={(value) => set("required", value)}
            />
            <Toggle
              label="Filtrerbar i kataloget"
              checked={form.filterable}
              onChange={(value) => set("filterable", value)}
            />
            <Toggle
              label="Fremhæv på kort"
              checked={form.highlighted}
              onChange={(value) => set("highlighted", value)}
            />
          </div>
        </section>

        {needsOptions ? (
          <OptionsEditor
            options={form.options}
            error={errors.options}
            onChange={(options) => set("options", options)}
          />
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
              Gælder for
            </h2>
            <Badge tone="accent">
              {form.categoryIds.length === 0
                ? "alle kategorier"
                : `${form.categoryIds.length} kategorier`}
              {" · "}
              {form.typeIds.length === 0 ? "alle typer" : `${form.typeIds.length} typer`}
            </Badge>
          </div>
          <p className="mb-4 text-sm text-ink-muted">
            Ingen valgte kategorier betyder at attributten gælder alle. Ingen valgte typer betyder
            alle typer inden for de valgte kategorier.
          </p>

          <ChipGroup
            legend="Kategorier"
            items={categories.map((category) => ({ id: category.id, label: category.name }))}
            selected={form.categoryIds}
            onToggle={(id) => {
              const next = toggle(form.categoryIds, id);
              set("categoryIds", next);
              // Typer uden for de valgte kategorier giver ikke længere mening.
              set(
                "typeIds",
                form.typeIds.filter((typeId) => {
                  const type = types.find((entry) => entry.id === typeId);
                  return type && (next.length === 0 || next.includes(type.categoryId));
                }),
              );
            }}
          />

          <ChipGroup
            legend="Typer"
            className="mt-4"
            items={selectableTypes.map((type) => ({ id: type.id, label: type.name }))}
            selected={form.typeIds}
            onToggle={(id) => set("typeIds", toggle(form.typeIds, id))}
          />
        </section>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? "Gemmer …" : isNew ? "Opret attribut" : "Gem ændringer"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/admin/attributter")}
          >
            Annullér
          </Button>
        </div>
      </form>

      <Preview form={form} />
    </div>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

function ChipGroup({
  legend,
  items,
  selected,
  onToggle,
  className,
}: {
  legend: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Vælg en kategori først.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={active}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line-strong bg-canvas text-ink-soft hover:bg-sunken",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function OptionsEditor({
  options,
  error,
  onChange,
}: {
  options: AttributeOption[];
  error?: string;
  onChange: (options: AttributeOption[]) => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
        Valgmuligheder
      </h2>
      <p className="mb-3 text-sm text-ink-muted">
        Nøglen gemmes i databasen; etiketten er det brugeren ser. En nøgle der er i brug kan ikke
        fjernes.
      </p>

      <ul className="flex flex-col gap-2">
        {options.map((option, index) => (
          <li key={index} className="flex gap-2">
            <input
              aria-label={`Nøgle for valgmulighed ${index + 1}`}
              value={option.value}
              onChange={(event) =>
                onChange(
                  options.map((entry, position) =>
                    position === index ? { ...entry, value: event.target.value } : entry,
                  ),
                )
              }
              placeholder="dark"
              className="h-10 w-40 rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 font-mono text-sm"
            />
            <input
              aria-label={`Etiket for valgmulighed ${index + 1}`}
              value={option.label}
              onChange={(event) =>
                onChange(
                  options.map((entry, position) =>
                    position === index ? { ...entry, label: event.target.value } : entry,
                  ),
                )
              }
              placeholder="Mørk"
              className="h-10 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 text-sm"
            />
            <button
              type="button"
              aria-label={`Fjern valgmulighed ${index + 1}`}
              onClick={() => onChange(options.filter((_, position) => position !== index))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-ink-muted hover:bg-danger-soft hover:text-danger"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-2 text-xs font-medium text-danger">{error}</p> : null}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => onChange([...options, { value: "", label: "" }])}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tilføj valgmulighed
      </Button>
    </section>
  );
}

function Preview({ form }: { form: FormState }) {
  const sample =
    form.dataType === "NUMBER"
      ? 7.5
      : form.dataType === "BOOLEAN"
        ? true
        : form.dataType === "MULTI_ENUM"
          ? form.options.slice(0, 2).map((option) => option.value)
          : (form.options[0]?.value ?? "eksempel");

  const rendered = formatAttributeValue(
    { dataType: form.dataType, unit: form.unit || null, options: form.options },
    sample,
  );

  return (
    <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
          Sådan ser feltet ud
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-ink-muted">I drikkevareformularen.</p>

        <p className="mb-1.5 text-sm font-semibold">
          {form.displayName || "Uden navn"}
          {form.required ? (
            <span className="ml-0.5 text-accent" aria-hidden="true">
              *
            </span>
          ) : null}
        </p>

        <div className="flex h-11 items-center rounded-[var(--radius-control)] border border-line-strong bg-canvas px-3 text-sm">
          <span className="flex-1 text-ink-muted">
            {form.dataType === "BOOLEAN" ? "Ja / Nej" : String(sample)}
          </span>
          {form.unit ? <span className="text-ink-muted">{form.unit}</span> : null}
        </div>

        {form.min !== "" || form.max !== "" ? (
          <p className="mt-1.5 text-xs text-ink-muted">
            Mellem {form.min || "−∞"} og {form.max || "∞"}
          </p>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
          I kataloget
        </h2>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-ink-muted">På kortet</p>
            {form.highlighted ? (
              <Badge>{rendered}</Badge>
            ) : (
              <span className="text-xs text-ink-muted">Vises ikke — slå “fremhæv” til.</span>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-muted">Som filter</p>
            {form.filterable ? (
              <span className="text-xs text-ink-soft">
                {form.dataType === "NUMBER"
                  ? "Interval med fra/til"
                  : form.dataType === "BOOLEAN"
                    ? "Afkrydsningsfelt"
                    : "Liste med valgmuligheder"}
              </span>
            ) : (
              <span className="text-xs text-ink-muted">Vises ikke i filtrene.</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
