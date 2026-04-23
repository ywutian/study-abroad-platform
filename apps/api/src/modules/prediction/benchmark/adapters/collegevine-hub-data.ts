/**
 * Parses CollegeVine hub "chances-and-financials" style JSON.
 * The live API shape is not public; this module accepts several layouts
 * observed from hub bootstrap (`initialSchools`) and common REST patterns.
 */

import type { CompetitorSchoolRef } from './competitor-adapter.interface';

export type CollegeVineHubRow = CompetitorSchoolRef & {
  probability?: number;
  tierLabel?: string;
  rawRow: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickSchoolId(entry: Record<string, unknown>): string | null {
  const id = entry.id ?? entry.schoolId ?? entry.school_id;
  if (id == null) return null;
  return String(id);
}

function pickSchoolName(entry: Record<string, unknown>): string | null {
  const name =
    (typeof entry.schoolName === 'string' && entry.schoolName) ||
    (typeof entry.name === 'string' && entry.name) ||
    (typeof entry.na === 'string' && entry.na) ||
    (typeof entry.title === 'string' && entry.title) ||
    null;
  return name?.trim() ? name.trim() : null;
}

function pickSlug(entry: Record<string, unknown>): string | null {
  const s =
    (typeof entry.slug === 'string' && entry.slug) ||
    (typeof entry.urlSlug === 'string' && entry.urlSlug) ||
    null;
  return s?.trim() ? s.trim() : null;
}

function normalizeProbability(raw: unknown): number | undefined {
  if (raw == null || typeof raw === 'boolean') return undefined;
  let n: number;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/%/g, '').trim();
    if (!cleaned) return undefined;
    n = Number(cleaned);
  } else if (typeof raw === 'number') {
    n = raw;
  } else {
    return undefined;
  }
  if (!Number.isFinite(n)) return undefined;
  if (n > 1 && n <= 100) return n / 100;
  if (n >= 0 && n <= 1) return n;
  if (n > 100) return undefined;
  return undefined;
}

function pickProbabilityFromChanceRecord(
  rec: Record<string, unknown>,
): number | undefined {
  const keys = [
    'admissionChance',
    'admissionChancePercent',
    'admitChance',
    'acceptanceChance',
    'chance',
    'chancePercent',
    'probability',
    'pctChance',
    'percentChance',
    'likelihood',
  ] as const;
  for (const k of keys) {
    const v = normalizeProbability(rec[k]);
    if (v != null) return v;
  }
  return undefined;
}

function pickTierFromChanceRecord(
  rec: Record<string, unknown>,
): string | undefined {
  const keys = [
    'tier',
    'chanceTier',
    'bucket',
    'chancingTier',
    'admissionTier',
  ] as const;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function extractSchoolsArray(root: Record<string, unknown>): unknown[] | null {
  const initial = asRecord(root.initialSchools);
  if (initial && Array.isArray(initial.schools)) return initial.schools;
  if (Array.isArray(root.schools)) return root.schools;
  const data = asRecord(root.data);
  if (data && Array.isArray(data.schools)) return data.schools;
  return null;
}

function extractChancesMap(
  root: Record<string, unknown>,
): Record<string, unknown> | null {
  const initial = asRecord(root.initialSchools);
  const fromInitial = asRecord(initial?.chancesAndFinancials);
  if (fromInitial) return fromInitial;
  const top = asRecord(root.chancesAndFinancials);
  if (top) return top;
  const data = asRecord(root.data);
  const nested = asRecord(data?.chancesAndFinancials);
  if (nested) return nested;
  return null;
}

/**
 * Best-effort parse of hub chances payload into rows keyed for benchmark runs.
 */
export function parseCollegeVineHubChancesPayload(
  payload: unknown,
): CollegeVineHubRow[] {
  const root = asRecord(payload);
  if (!root) return [];

  const schoolsRaw = extractSchoolsArray(root);
  const chancesMap = extractChancesMap(root);

  const rows: CollegeVineHubRow[] = [];

  if (schoolsRaw && schoolsRaw.length > 0) {
    for (const item of schoolsRaw) {
      const entry = asRecord(item);
      if (!entry) continue;
      const id = pickSchoolId(entry);
      const name = pickSchoolName(entry);
      if (!id || !name) continue;
      const slug = pickSlug(entry);
      const schoolKey = slug ? `cv-${slug}` : `cv-${id}`;
      const chanceRec =
        (chancesMap &&
          (asRecord(chancesMap[id]) ?? asRecord(chancesMap[String(id)]))) ??
        null;
      const probability = chanceRec
        ? pickProbabilityFromChanceRecord(chanceRec)
        : pickProbabilityFromChanceRecord(entry);
      const tierLabel = chanceRec
        ? pickTierFromChanceRecord(chanceRec)
        : pickTierFromChanceRecord(entry);

      rows.push({
        schoolKey,
        rawName: name,
        externalId: id,
        probability,
        tierLabel,
        rawRow: { school: entry, chance: chanceRec },
      });
    }
    return rows;
  }

  // Fallback: only chances map (keyed by school id) with embedded names
  if (chancesMap && Object.keys(chancesMap).length > 0) {
    for (const [key, value] of Object.entries(chancesMap)) {
      const rec = asRecord(value);
      if (!rec) continue;
      const name =
        (typeof rec.schoolName === 'string' && rec.schoolName) ||
        (typeof rec.name === 'string' && rec.name) ||
        null;
      if (!name) continue;
      const slug = pickSlug(rec);
      const schoolKey = slug ? `cv-${slug}` : `cv-${key}`;
      rows.push({
        schoolKey,
        rawName: name.trim(),
        externalId: key,
        probability: pickProbabilityFromChanceRecord(rec),
        tierLabel: pickTierFromChanceRecord(rec),
        rawRow: rec,
      });
    }
  }

  return rows;
}
