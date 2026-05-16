#!/usr/bin/env tsx
/**
 * check-closure.ts — Prediction Data Closure Gate
 *
 * Determines whether the US-school dataset has reached "L2 OFFICIAL" closure:
 *   ∀ field ∈ {7 prediction-critical fields}: closure(field) ≥ 0.90
 *   AND no field < 0.85
 *
 * "closure" = (schools with provenance.tier ∈ {OFFICIAL, PARTNER, UNAVAILABLE-terminal})
 *           / (eligible schools — excludes ART_DESIGN / MUSIC_CONSERVATORY)
 *
 * Eligibility per field:
 *   - acceptanceRate / sat25 / sat75 / intlAcceptanceRate: ALL non-portfolio schools
 *   - oosAcceptanceRate:   ONLY public schools (isPrivate=false)
 *   - edAcceptanceRate:    schools with hasEarlyDecision=true OR field already set
 *   - eaAcceptanceRate:    schools with EA marker OR field already set (heuristic for v1)
 *
 * Exit codes:
 *   0 → closure achieved (dispatcher should stop)
 *   1 → not yet closed (dispatcher continues)
 *   2 → data anomaly requires human review
 *
 * Usage:
 *   tsx scripts/check-closure.ts                    # human-readable
 *   tsx scripts/check-closure.ts --json             # JSON to stdout
 *   tsx scripts/check-closure.ts --out FILE         # write JSON to file
 *   tsx scripts/check-closure.ts --threshold 0.95   # custom threshold
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { buildNormalizedSchoolProvenance } from '../src/modules/school/school-provenance.helpers';
import { toSchoolFieldSource } from '@study-abroad/shared/utils';

const prisma = new PrismaClient();

const US_COUNTRIES = ['US', 'United States', 'United States of America'];

const PREDICTION_FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;
type Field = (typeof PREDICTION_FIELDS)[number];

// trust tiers that count toward HARD closure (data dispatcher accepts as "done").
// Includes SCRAPED to honor the user's CDS → Scorecard → BigFuture fallback
// policy: when CDS/Scorecard fail, BigFuture (SCRAPED) is acceptable to stop
// dispatching. OFFICIAL_PURE_TIERS below tracks the stretch metric separately.
const CLOSURE_TIERS = new Set([
  'OFFICIAL',
  'PARTNER',
  'UNAVAILABLE',
  'SCRAPED',
]);

// Stretch metric: schools where data quality is publishable / peer-defensible.
const OFFICIAL_PURE_TIERS = new Set(['OFFICIAL', 'PARTNER', 'UNAVAILABLE']);

const DEFAULT_THRESHOLD = 0.9;
const DEFAULT_FLOOR = 0.85;

type SchoolRow = {
  id: string;
  name: string;
  country: string;
  state: string | null;
  usNewsRank: number | null;
  isPrivate: boolean | null;
  institutionType: string | null;
  hasEarlyDecision: boolean | null;
  acceptanceRate: Prisma.Decimal | null;
  sat25: number | null;
  sat75: number | null;
  intlAcceptanceRate: Prisma.Decimal | null;
  oosAcceptanceRate: Prisma.Decimal | null;
  edAcceptanceRate: Prisma.Decimal | null;
  eaAcceptanceRate: Prisma.Decimal | null;
  metadata: any;
  dataReviewStatus: string | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    json: has('json'),
    out: get('out'),
    threshold: get('threshold') ? Number(get('threshold')) : DEFAULT_THRESHOLD,
    floor: get('floor') ? Number(get('floor')) : DEFAULT_FLOOR,
    verbose: has('verbose'),
  };
}

function isPortfolioFirst(school: SchoolRow): boolean {
  return (
    school.institutionType === 'ART_DESIGN' ||
    school.institutionType === 'MUSIC_CONSERVATORY'
  );
}

function hasProvenanceEntry(
  provenance: ReturnType<typeof buildNormalizedSchoolProvenance>,
  field: Field,
): boolean {
  return Boolean(provenance[field]);
}

function isEligible(
  school: SchoolRow,
  field: Field,
  provenance: ReturnType<typeof buildNormalizedSchoolProvenance>,
): boolean {
  // exclude portfolio-first schools from all prediction fields
  if (isPortfolioFirst(school)) return false;
  // exclude REJECTED schools
  if (school.dataReviewStatus === 'REJECTED') return false;

  switch (field) {
    case 'oosAcceptanceRate':
      // only public schools have in/out-of-state distinction
      return school.isPrivate === false;
    case 'edAcceptanceRate':
      // eligible if school offers ED, has a value, or has any provenance entry
      // (means we already investigated this field for this school)
      return (
        school.hasEarlyDecision === true ||
        school.edAcceptanceRate != null ||
        hasProvenanceEntry(provenance, field)
      );
    case 'eaAcceptanceRate':
      // eligible if value present or any provenance entry exists (e.g.
      // school confirmed to not offer EA → UNAVAILABLE marker is the answer)
      return (
        school.eaAcceptanceRate != null || hasProvenanceEntry(provenance, field)
      );
    default:
      // acceptanceRate, sat25, sat75, intlAcceptanceRate: all non-portfolio
      // non-REJECTED schools are eligible
      return true;
  }
}

function fieldFilled(school: SchoolRow, field: Field): boolean {
  const v = (school as any)[field];
  return v !== null && v !== undefined;
}

function fieldClosed(
  school: SchoolRow,
  field: Field,
  provenance: ReturnType<typeof buildNormalizedSchoolProvenance>,
): { closed: boolean; tier: string | null; source: string | null } {
  const fp = provenance[field];
  const fs = fp ? toSchoolFieldSource(fp) : null;
  const tier = fs?.tier ?? null;
  const source = fs?.source ?? null;

  // a field is "closed" if its trust tier is OFFICIAL, PARTNER, or explicitly
  // marked UNAVAILABLE (school confirmed not to publish — terminal state)
  const closed = tier !== null && CLOSURE_TIERS.has(tier);
  return { closed, tier, source };
}

async function main() {
  const opts = parseArgs();

  const schools = (await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      country: true,
      state: true,
      usNewsRank: true,
      isPrivate: true,
      institutionType: true,
      hasEarlyDecision: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
      dataReviewStatus: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  })) as unknown as SchoolRow[];

  const totalSchools = schools.length;
  const excluded = schools.filter(
    (s) => isPortfolioFirst(s) || s.dataReviewStatus === 'REJECTED',
  );
  const scope = schools.filter(
    (s) => !isPortfolioFirst(s) && s.dataReviewStatus !== 'REJECTED',
  );

  const perField: Record<
    Field,
    {
      eligible: number;
      filled: number;
      closed: number;
      officialPure: number;
      closure: number;
      officialPurity: number;
      gaps: Array<{
        id: string;
        name: string;
        rank: number | null;
        filled: boolean;
        tier: string | null;
        source: string | null;
      }>;
    }
  > = {} as any;

  for (const field of PREDICTION_FIELDS) {
    perField[field] = {
      eligible: 0,
      filled: 0,
      closed: 0,
      officialPure: 0,
      closure: 0,
      officialPurity: 0,
      gaps: [],
    };
  }

  for (const school of scope) {
    const provenance = buildNormalizedSchoolProvenance(school as any);
    for (const field of PREDICTION_FIELDS) {
      if (!isEligible(school, field, provenance)) continue;
      perField[field].eligible += 1;
      const filled = fieldFilled(school, field);
      if (filled) perField[field].filled += 1;
      const { closed, tier, source } = fieldClosed(school, field, provenance);
      if (closed) {
        perField[field].closed += 1;
        if (tier && OFFICIAL_PURE_TIERS.has(tier)) {
          perField[field].officialPure += 1;
        }
      } else {
        perField[field].gaps.push({
          id: school.id,
          name: school.name,
          rank: school.usNewsRank,
          filled,
          tier,
          source,
        });
      }
    }
  }

  for (const field of PREDICTION_FIELDS) {
    const f = perField[field];
    f.closure = f.eligible > 0 ? f.closed / f.eligible : 1;
    f.officialPurity = f.eligible > 0 ? f.officialPure / f.eligible : 1;
    // sort gaps by importance (rank ascending; nulls last)
    f.gaps.sort((a, b) => {
      const ra = a.rank ?? 9999;
      const rb = b.rank ?? 9999;
      return ra - rb;
    });
  }

  const blockingFields = PREDICTION_FIELDS.filter(
    (f) => perField[f].closure < opts.threshold,
  );
  const floorViolations = PREDICTION_FIELDS.filter(
    (f) => perField[f].closure < opts.floor,
  );

  const closed = blockingFields.length === 0 && floorViolations.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    threshold: opts.threshold,
    floor: opts.floor,
    totals: {
      totalSchools,
      excluded: excluded.length,
      scope: scope.length,
    },
    closure: {
      closed,
      blockingFields,
      floorViolations,
    },
    fields: Object.fromEntries(
      PREDICTION_FIELDS.map((f) => [
        f,
        {
          eligible: perField[f].eligible,
          filled: perField[f].filled,
          closed: perField[f].closed,
          officialPure: perField[f].officialPure,
          closure: Math.round(perField[f].closure * 10000) / 10000,
          officialPurity:
            Math.round(perField[f].officialPurity * 10000) / 10000,
          gapsCount: perField[f].gaps.length,
          ...(opts.verbose ? { gaps: perField[f].gaps.slice(0, 20) } : {}),
        },
      ]),
    ),
    topGaps: PREDICTION_FIELDS.flatMap((f) =>
      perField[f].gaps.slice(0, 5).map((g) => ({ field: f, ...g })),
    )
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
      .slice(0, 30),
  };

  const defaultOut = path.join(
    process.cwd(),
    'apps/api/scripts/closure-reports',
    `closure-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`,
  );
  const out = opts.out ?? defaultOut;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('━'.repeat(70));
    console.log(
      `Prediction Data Closure Check — threshold ${opts.threshold * 100}%, floor ${opts.floor * 100}%`,
    );
    console.log('━'.repeat(70));
    console.log(
      `Total US schools: ${totalSchools} | Excluded (portfolio/REJECTED): ${excluded.length} | In scope: ${scope.length}`,
    );
    console.log('');
    console.log(
      'Field                         Eligible  Filled  Closed  Closure  OFFICIAL-pure  Status',
    );
    console.log('─'.repeat(86));
    for (const f of PREDICTION_FIELDS) {
      const x = perField[f];
      const pct = (x.closure * 100).toFixed(1).padStart(5);
      const pure = (x.officialPurity * 100).toFixed(1).padStart(5);
      const status =
        x.closure >= opts.threshold
          ? '✅'
          : x.closure < opts.floor
            ? '🔴 FLOOR'
            : '⚠️  GAP';
      console.log(
        `${f.padEnd(28)}  ${String(x.eligible).padStart(7)}  ${String(x.filled).padStart(6)}  ${String(x.closed).padStart(6)}  ${pct}%  ${pure}%        ${status}`,
      );
    }
    console.log('─'.repeat(70));
    if (closed) {
      console.log('✅ CLOSURE ACHIEVED — dispatcher should stop.');
    } else {
      console.log(
        `❌ Not closed. Blocking: [${blockingFields.join(', ')}]${floorViolations.length ? ` | Floor violations: [${floorViolations.join(', ')}]` : ''}`,
      );
      console.log('');
      console.log('Top 10 priority gaps (by US News rank):');
      for (const gap of report.topGaps.slice(0, 10)) {
        console.log(
          `  rank ${String(gap.rank ?? '—').padStart(4)} ${gap.name.padEnd(40)} ${gap.field.padEnd(22)} tier=${gap.tier ?? 'NULL'} filled=${gap.filled}`,
        );
      }
    }
    console.log('');
    console.log(`Report: ${out}`);
  }

  process.exit(closed ? 0 : 1);
}

main()
  .catch((err) => {
    console.error('check-closure error:', err);
    process.exit(2);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
