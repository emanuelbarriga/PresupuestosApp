import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number string with Colombian thousands separator (dots) */
export function formatThousands(value: string): string {
  if (!value) return value;
  const raw = value.replace(/\./g, '');
  if (!raw || raw === '-') return raw;
  const isNegative = raw.startsWith('-');
  const numStr = isNegative ? raw.slice(1) : raw;
  const parts = numStr.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (isNegative ? '-' : '') + parts.join(',');
}

/** Remove formatting, return raw number string */
export function unformatThousands(value: string): string {
  return value.replace(/\./g, '');
}
