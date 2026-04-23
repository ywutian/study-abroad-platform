/**
 * Real-case CSV ingest (Admin + CLI + DiagnosticIngestService).
 * Keep in sync with apps/api/data/real-cases-template.csv header expectations.
 */
export const REAL_CASES_CSV_REQUIRED_COLUMNS = [
  'schoolName',
  'result',
  'year',
  'gpaRange',
] as const;

export type RealCasesCsvRequiredColumn = (typeof REAL_CASES_CSV_REQUIRED_COLUMNS)[number];
