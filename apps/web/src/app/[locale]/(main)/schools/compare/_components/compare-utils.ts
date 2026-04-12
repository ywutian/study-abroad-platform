import type { CompareField, SchoolDetailForCompare } from './types';

export const MAX_SCHOOLS = 3;

export function getBestIndex(
  schools: SchoolDetailForCompare[],
  field: CompareField
): number | null {
  const values = schools.map((s) => {
    const raw = field.getValue(s);
    if (raw == null) return null;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    if (typeof raw === 'string') {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? null : n;
    }
    return raw;
  });

  const validValues = values.filter((v): v is number => v != null);
  if (validValues.length < 2) return null;

  const target = field.best === 'lower' ? Math.min(...validValues) : Math.max(...validValues);
  const idx = values.indexOf(target);
  // Only highlight if not all values are equal
  const allSame = validValues.every((v) => v === validValues[0]);
  if (allSame) return null;
  return idx;
}
