import { z } from 'zod';

export const idSchema = z.uuid().meta({ id: 'Id', description: 'UUID v4.' });

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(SLUG_PATTERN, 'Slug må kun indeholde små bogstaver, tal og enkelte bindestreger')
  .meta({ id: 'Slug', description: 'URL-venligt navn, fx "india-pale-ale".' });

/** Laver et slug ud fra fritekst. Understøtter æ/ø/å. */
export function slugify(input: string): string {
  return (
    input
      // Skal ske før NFD: Å dekomponeres ellers til A + ring, og "Århus" ville
      // blive til "arhus" i stedet for "aarhus".
      .replace(/æ/gi, 'ae')
      .replace(/ø/gi, 'oe')
      .replace(/å/gi, 'aa')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96)
      .replace(/-+$/g, '')
  );
}

/** Emoji eller kort symbol brugt som kategori-ikon. */
export const iconSchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .meta({ id: 'Icon', description: 'Emoji brugt som ikon, fx "🍺".' });

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Farve skal være en 6-cifret hex-værdi, fx #d97706')
  .meta({ id: 'HexColor' });

export const isoDateTimeSchema = z.iso.datetime({ offset: true }).meta({
  id: 'IsoDateTime',
  description: 'ISO 8601-tidsstempel med tidszone.',
});

/**
 * Query-parametre kommer altid som strenge. Disse hjælpere gør dem til rigtige typer.
 *
 * De findes i to udgaver — med og uden standardværdi — frem for én funktion med
 * et valgfrit argument. Ellers bliver den udledte type `T | undefined` selv når
 * der *er* en standardværdi, og hvert kaldssted skal så bevise det modsatte.
 */
function coerceBoolean(value: unknown, fallback: boolean | undefined): unknown {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}

/** `?active=false` bliver til `false`, ikke til `true` som `z.coerce.boolean()` ville gøre. */
export function optionalBoolean() {
  return z.preprocess((value) => coerceBoolean(value, undefined), z.boolean().optional());
}

export function booleanWithDefault(defaultValue: boolean) {
  return z.preprocess((value) => coerceBoolean(value, defaultValue), z.boolean());
}

function coerceNumber(value: unknown, fallback: number | undefined): unknown {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function boundedInt(options: { min?: number; max?: number }) {
  let schema = z.number().int();
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return schema;
}

export function optionalInt(options: { min?: number; max?: number } = {}) {
  return z.preprocess((value) => coerceNumber(value, undefined), boundedInt(options).optional());
}

export function intWithDefault(options: { min?: number; max?: number; default: number }) {
  return z.preprocess((value) => coerceNumber(value, options.default), boundedInt(options));
}

export function optionalFloat(options: { min?: number; max?: number } = {}) {
  let schema = z.number();
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return z.preprocess((value) => coerceNumber(value, undefined), schema.optional());
}

/** Komma-separeret liste i query-string → array. `?typeIds=a,b,c` */
export function csvQuery<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) return value;
    return String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }, z.array(item).optional());
}

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;
