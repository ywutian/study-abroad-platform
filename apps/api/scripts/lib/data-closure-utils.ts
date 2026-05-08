import { Prisma, PrismaClient } from '@prisma/client';

export const US_COUNTRIES = ['US', 'United States', 'United States of America'];
export const DEFAULT_TERMINAL_SOURCE = 'DATA_CLOSURE_TERMINALIZER';

export interface ScriptArgs {
  dryRun: boolean;
  apply: boolean;
  search: boolean;
  limit: number;
  field?: string;
  reason?: string;
  ledger?: string;
  years: number[];
}

export function parseCommonArgs(argv = process.argv.slice(2)): ScriptArgs {
  const get = (name: string, fallback?: string) => {
    const index = argv.indexOf(name);
    if (index >= 0 && argv[index + 1]) return argv[index + 1];
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    return inline ? inline.slice(name.length + 1) : fallback;
  };
  const years = (get('--years', '2022,2023,2024,2025,2026') ?? '')
    .split(',')
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100);
  return {
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    apply: argv.includes('--apply'),
    search: argv.includes('--search'),
    limit: Number(get('--limit', '240')),
    field: get('--field'),
    reason: get('--reason'),
    ledger: get('--ledger'),
    years: years.length > 0 ? years : [new Date().getFullYear()],
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function metadataWithProvenance(
  metadata: unknown,
  field: string,
  provenance: Record<string, unknown>,
): Prisma.InputJsonValue {
  const meta = { ...asRecord(metadata) };
  const existing = asRecord(meta.provenance);
  meta.provenance = {
    ...existing,
    [field]: {
      ...asRecord(existing[field]),
      ...provenance,
      verifiedAt:
        typeof provenance.verifiedAt === 'string'
          ? provenance.verifiedAt
          : new Date().toISOString(),
    },
  };
  return meta as Prisma.InputJsonValue;
}

export function metadataWithTerminal(
  metadata: unknown,
  field: string,
  terminal: {
    status: string;
    reason: string;
    searchedQueries?: string[];
    candidates?: unknown[];
    rejectedReasons?: string[];
    sourceUrl?: string | null;
    year?: number | null;
  },
): Prisma.InputJsonValue {
  return metadataWithProvenance(metadata, field, {
    status: terminal.status,
    source: terminal.status,
    terminalReason: terminal.reason,
    reason: terminal.reason,
    searchedQueries: terminal.searchedQueries ?? [],
    candidates: terminal.candidates ?? [],
    rejectedReasons: terminal.rejectedReasons ?? [],
    sourceUrl: terminal.sourceUrl ?? null,
    year: terminal.year ?? null,
    confidence: 'LOW',
    verifiedAt: new Date().toISOString(),
  });
}

export function metadataWithHistoricalTerminal(
  metadata: unknown,
  field: string,
  year: number,
  terminal: {
    status: string;
    reason: string;
    searchedQueries?: string[];
    candidates?: unknown[];
    rejectedReasons?: string[];
  },
): Prisma.InputJsonValue {
  const meta = { ...asRecord(metadata) };
  const historicalTerminalFields = {
    ...asRecord(meta.historicalTerminalFields),
  };
  const fieldRecord = { ...asRecord(historicalTerminalFields[field]) };
  fieldRecord[String(year)] = {
    status: terminal.status,
    reason: terminal.reason,
    searchedQueries: terminal.searchedQueries ?? [],
    candidates: terminal.candidates ?? [],
    rejectedReasons: terminal.rejectedReasons ?? [],
    verifiedAt: new Date().toISOString(),
  };
  historicalTerminalFields[field] = fieldRecord;
  meta.historicalTerminalFields = historicalTerminalFields;
  return meta as Prisma.InputJsonValue;
}

export function normalizeRateToPercent(value: unknown) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number >= 0 && number <= 1) return number * 100;
  return number;
}

export function terminalStatusForField(field: string) {
  if (field === 'essayPrompts') return 'NOT_APPLICABLE_NO_SUPPLEMENT';
  if (field === 'communityRatings') return 'NOT_APPLICABLE_NO_USER_DATA';
  if (field === 'admissionCases') return 'NO_PUBLIC_USER_CASE_DATA';
  if (field === 'edAcceptanceRate' || field === 'eaAcceptanceRate')
    return 'NO_PUBLIC_ROUND_RATE';
  if (field === 'gpaDistribution') return 'NO_PUBLIC_GPA_DISTRIBUTION';
  if (field === 'cdsAdmitBands') return 'NO_PUBLIC_C9_CROSSTAB';
  if (field === 'programRates') return 'NO_PUBLIC_PROGRAM_DATA';
  return 'NO_PUBLIC_SOURCE';
}

export function looksLikeNoSatSchool(name: string) {
  return /juilliard|curtis|berklee|new england conservatory|school of the art institute|artcenter|calarts|risd|parsons|fashion institute/i.test(
    name,
  );
}

export function looksLikeUcSchool(name: string) {
  return /university of california|uc berkeley|ucla|uc san diego|uc davis|uc irvine|uc santa barbara|uc santa cruz|uc riverside|uc merced/i.test(
    name,
  );
}
