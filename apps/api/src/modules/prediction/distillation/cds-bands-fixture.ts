import type { CdsBandInputRow } from './cds-bands-ingestion.service';

/**
 * Bundled CDS admit-band starter fixture.
 *
 * Mirrors `apps/api/scripts/seed-cds-fixture.json` but lives inside `src/`
 * so it ends up in the built `dist/` and is available to the runtime in
 * Cloud Run. The Dockerfile only copies `dist/` + `prisma/`, not `scripts/`,
 * so a fs.readFileSync of the JSON path would fail at runtime in prod.
 *
 * Keep this file in sync with `seed-cds-fixture.json` by hand for now —
 * once the fixture grows past ~50 entries we should add a build step that
 * copies the JSON or generates this file. Today the fixture is small
 * enough to maintain inline.
 *
 * Schema reference: see `CdsBandInputRow` (cds-bands-ingestion.service.ts).
 */
export const CDS_BANDS_BUNDLED_FIXTURE: CdsBandInputRow[] = [
  {
    schoolNameNorm: 'university of california merced',
    gpaBand: '3.75-4.00',
    testType: 'SAT',
    testBand: '1500-1600',
    admitRate: 0.92,
    sampleCount: 500,
    cycleYear: 2024,
    source: 'manual-cds-fixture:uc-merced:2024',
    sourceUrl: 'https://admissions.ucmerced.edu/',
  },
  {
    schoolNameNorm: 'university of california merced',
    gpaBand: '3.75-4.00',
    testType: 'GPA_ONLY',
    testBand: 'ANY',
    admitRate: 0.88,
    sampleCount: 1200,
    cycleYear: 2024,
    source: 'manual-cds-fixture:uc-merced:2024',
    sourceUrl: 'https://admissions.ucmerced.edu/',
  },
  {
    schoolNameNorm: 'university of california berkeley',
    gpaBand: '3.75-4.00',
    testType: 'GPA_ONLY',
    testBand: 'ANY',
    admitRate: 0.25,
    sampleCount: 1000,
    cycleYear: 2024,
    source: 'manual-cds-fixture:uc-berkeley:2024',
    sourceUrl: 'https://admissions.berkeley.edu/',
  },
];
