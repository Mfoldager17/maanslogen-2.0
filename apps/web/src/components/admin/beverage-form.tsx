"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  validateAttributeValue,
  type AttributeValue,
  type Beverage,
  type BeverageType,
  type Brand,
  type Category,
  type MediaAssetInput,
} from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { useApiMutation } from "@/lib/use-mutation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { ImageUpload } from "./image-upload";
import { AttributeValueInput } from "./attribute-value-input";
import { GlassLoader } from "@/components/motion/glass-loader";
import { dynamicRoute } from "@/lib/routes";

/**
 * Felterne for egenskaber findes ikke i denne fil. De hentes fra
 * `/attributes/for-type/:id`, så en ny attribut i admin dukker op her uden at
 * nogen rører formularen.
 */
export function BeverageForm({
  beverage,
  categories,
  types,
  brands,
}: {
  beverage: Beverage | null;
  categories: Category[];
  types: BeverageType[];
  brands: Brand[];
}) {
  const router = useRouter();
  const mutation = useApiMutation();

  const initialType = types.find((type) => type.id === beverage?.typeId);
  const [categoryId, setCategoryId] = useState(initialType?.categoryId ?? categories[0]?.id ?? "");
  const [typeId, setTypeId] = useState(beverage?.typeId ?? "");
  const [brandId, setBrandId] = useState(beverage?.brandId ?? "");
  const [name, setName] = useState(beverage?.name ?? "");
  const [description, setDescription] = useState(beverage?.description ?? "");
  const [countryCode, setCountryCode] = useState(beverage?.countryCode ?? "");
  const [vintage, setVintage] = useState(beverage?.vintage ? String(beverage.vintage) : "");
  const [active, setActive] = useState(beverage?.active ?? true);
  const [media, setMedia] = useState<MediaAssetInput | null>(null);

  const [values, setValues] = useState<Record<string, AttributeValue | null>>(() =>
    Object.fromEntries(
      (beverage?.attributes ?? []).map((attribute) => [attribute.definitionId, attribute.value]),
    ),
  );

  const typesInCategory = useMemo(
    () => types.filter((type) => type.categoryId === categoryId),
    [types, categoryId],
  );
  const brandsInCategory = useMemo(
    () =>
      brands.filter(
        (brand) => brand.categoryIds.length === 0 || brand.categoryIds.includes(categoryId),
      ),
    [brands, categoryId],
  );

  /**
   * Skifter man kategori, giver den valgte type og det valgte mærke måske ikke
   * længere mening. Det udledes under render frem for at blive synkroniseret i
   * en effect — så findes der aldrig en render hvor felterne peger på noget
   * ugyldigt, og der er intet ekstra gennemløb.
   */
  const effectiveTypeId = typesInCategory.some((type) => type.id === typeId)
    ? typeId
    : (typesInCategory[0]?.id ?? "");
  const effectiveBrandId = brandsInCategory.some((brand) => brand.id === brandId)
    ? brandId
    : (brandsInCategory[0]?.id ?? "");

  /**
   * Attributterne for den valgte type. TanStack Query håndterer indlæsning,
   * annullering og rækkefølge, så et langsomt svar for en tidligere type ikke
   * kan overskrive et nyere.
   */
  const { data: definitions = [], isFetching: loadingDefinitions } = useQuery({
    queryKey: ["attributes", "for-type", effectiveTypeId],
    queryFn: () => api.attributes.forType(effectiveTypeId),
    enabled: effectiveTypeId !== "",
    staleTime: 60_000,
  });

  const attributeErrors = useMemo(() => {
    const found: Record<string, string> = {};
    for (const definition of definitions) {
      const value = values[definition.id];
      const message = validateAttributeValue(definition, value);
      if (message) {
        found[definition.id] = message;
      } else if (definition.required && (value === null || value === undefined || value === "")) {
        found[definition.id] = `${definition.displayName} er påkrævet`;
      }
    }
    return found;
  }, [definitions, values]);

  const [showErrors, setShowErrors] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (Object.keys(attributeErrors).length > 0) {
      setShowErrors(true);
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      typeId: effectiveTypeId,
      brandId: effectiveBrandId,
      countryCode: countryCode.trim() || undefined,
      vintage: vintage === "" ? undefined : Number(vintage),
      active,
      ...(media ? { media } : {}),
      attributes: definitions
        .filter((definition) => values[definition.id] !== undefined)
        .map((definition) => ({
          definitionId: definition.id,
          value: values[definition.id] ?? null,
        })),
    };

    const result = beverage
      ? await mutation.run(() => api.beverages.update(beverage.id, payload), {
          success: "Drikkevaren er opdateret",
        })
      : await mutation.run(() => api.beverages.create(payload), {
          success: "Drikkevaren er oprettet",
        });

    if (result) router.push(dynamicRoute(`/drikkevarer/${result.slug}`));
  }

  // Serverens feltfejl bruger attributnøglen; vi mapper dem til definitions-id'er.
  const serverAttributeErrors = useMemo(() => {
    const byKey: Record<string, string> = {};
    for (const [field, message] of Object.entries(mutation.fieldErrors)) {
      const match = /^attributes\.(.+)$/.exec(field);
      if (match?.[1]) byKey[match[1]] = message;
    }
    return Object.fromEntries(
      definitions
        .filter((definition) => byKey[definition.key])
        .map((definition) => [definition.id, byKey[definition.key] as string]),
    );
  }, [mutation.fieldErrors, definitions]);

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_20rem]" noValidate>
      <div className="flex flex-col gap-5">
        {mutation.formError ? <Alert tone="danger">{mutation.formError}</Alert> : null}

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
            Placering i kataloget
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kategori" required>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field label="Type" error={mutation.fieldErrors.typeId} required>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={effectiveTypeId}
                  onChange={(event) => setTypeId(event.target.value)}
                >
                  {typesInCategory.length === 0 ? <option value="">Ingen typer</option> : null}
                  {typesInCategory.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field
              label="Mærke"
              hint={
                brandsInCategory.length < brands.length ? "Begrænset til kategorien" : undefined
              }
              error={mutation.fieldErrors.brandId}
              required
            >
              {(props) => (
                <NativeSelect
                  {...props}
                  value={effectiveBrandId}
                  onChange={(event) => setBrandId(event.target.value)}
                >
                  {brandsInCategory.length === 0 ? <option value="">Ingen mærker</option> : null}
                  {brandsInCategory.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
            Om drikkevaren
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field
              label="Navn"
              className="sm:col-span-2"
              error={mutation.fieldErrors.name}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Beer Geek Breakfast"
                />
              )}
            </Field>

            <Field label="Land" hint="To bogstaver" error={mutation.fieldErrors.countryCode}>
              {(props) => (
                <Input
                  {...props}
                  value={countryCode}
                  maxLength={2}
                  onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                  className="uppercase"
                />
              )}
            </Field>

            <Field label="Årgang" hint="Kun vin og whisky" error={mutation.fieldErrors.vintage}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  value={vintage}
                  onChange={(event) => setVintage(event.target.value)}
                  placeholder="2021"
                />
              )}
            </Field>

            <Field label="Beskrivelse" className="sm:col-span-4">
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-line pt-4 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Synlig i det offentlige katalog
          </label>
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
              Egenskaber
            </h2>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-hover">
              dynamisk
            </span>
          </div>
          <p className="mb-4 text-sm text-ink-muted">
            Felterne herunder kommer fra attributdefinitionerne for den valgte type.
          </p>

          {loadingDefinitions ? (
            <GlassLoader size="sm" label="Henter egenskaber …" className="py-6" />
          ) : definitions.length === 0 ? (
            <p className="text-sm text-ink-muted">Ingen attributter gælder for denne type endnu.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {definitions.map((definition) => (
                <AttributeValueInput
                  key={definition.id}
                  definition={definition}
                  value={values[definition.id] ?? null}
                  error={
                    serverAttributeErrors[definition.id] ??
                    (showErrors ? attributeErrors[definition.id] : undefined)
                  }
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [definition.id]: value }))
                  }
                />
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? "Gemmer …" : beverage ? "Gem ændringer" : "Opret drikkevare"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Annullér
          </Button>
        </div>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-surface p-5 xl:sticky xl:top-6">
        <ImageUpload
          ownerType="BEVERAGE"
          value={media}
          onChange={setMedia}
          existing={beverage?.media ?? null}
        />
      </aside>
    </form>
  );
}
