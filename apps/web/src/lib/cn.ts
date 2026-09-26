import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Slår klassenavne sammen og lader den sidste Tailwind-klasse vinde. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
