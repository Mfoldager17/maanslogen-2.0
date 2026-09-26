import { slugify } from '@maanslogen/contracts';

/**
 * Finder et ledigt slug ved at tilføje -2, -3 … indtil `isTaken` siger nej.
 * Klienten kan altid angive sit eget slug; dette er fallback fra navnet.
 */
export async function uniqueSlug(
  desired: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const base = slugify(desired) || 'uden-navn';
  if (!(await isTaken(base))) return base;

  for (let suffix = 2; suffix <= maxAttempts; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}
