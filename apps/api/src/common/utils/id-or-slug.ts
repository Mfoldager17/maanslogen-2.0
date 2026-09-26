const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Bygger en where-betingelse til opslag på enten id eller slug.
 *
 * `id`-kolonnerne er `uuid` i Postgres, så `OR: [{ id }, { slug }]` med en
 * ikke-UUID-streng får databasen til at fejle på castet, før den overhovedet
 * kigger på slug'en. Derfor slås id kun op når værdien faktisk *er* et UUID.
 */
export function idOrSlugWhere(value: string): { id: string } | { slug: string } {
  return isUuid(value) ? { id: value } : { slug: value };
}
