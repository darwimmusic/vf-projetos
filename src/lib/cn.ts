import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina classes Tailwind com merge inteligente (último valor ganha em conflito). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
