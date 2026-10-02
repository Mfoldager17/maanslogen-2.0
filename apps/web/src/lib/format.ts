const numberFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 });
const ratingFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const compactFormat = new Intl.NumberFormat('da-DK', { notation: 'compact' });
const dateFormat = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatRating(value: number): string {
  return ratingFormat.format(value);
}

export function formatCount(value: number): string {
  return value < 10_000 ? numberFormat.format(value) : compactFormat.format(value);
}

export function formatDate(value: string | Date): string {
  return dateFormat.format(typeof value === 'string' ? new Date(value) : value);
}

/** Klokkeslæt alene. Tidspunkterne i et arrangement hører alle til samme aften. */
export function formatTime(value: string | Date): string {
  return timeFormat.format(typeof value === 'string' ? new Date(value) : value);
}

/** "for 3 dage siden" — falder tilbage til en dato når det bliver for længe siden. */
export function formatRelative(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
  ];

  let amount = seconds;
  for (const [unit, step] of units) {
    if (Math.abs(amount) < step) {
      return new Intl.RelativeTimeFormat('da-DK', { numeric: 'auto' }).format(
        -Math.round(amount),
        unit,
      );
    }
    amount /= step;
  }
  return dateFormat.format(date);
}

const REGION_NAMES = new Intl.DisplayNames(['da'], { type: 'region' });

export function formatCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return REGION_NAMES.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Initialer til avatar-pladsholdere. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
