type ClassValue = string | number | boolean | undefined | null | ClassValue[];

/**
 * Concatenate class names, skipping falsy values. Kept tiny on purpose —
 * no merging/de-duping — because the customer portal doesn't need `clsx`
 * or `tailwind-merge` weight for the small number of conditional classes
 * we actually use.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v && v !== 0) continue;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    }
  }
  return out.join(' ');
}
