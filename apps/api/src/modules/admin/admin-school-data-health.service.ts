import { Injectable } from '@nestjs/common';
import { AdminSchoolDataCoverageService } from './admin-school-data-coverage.service';

/**
 * AdminSchoolDataHealthService — action-oriented view on top of
 * AdminSchoolDataCoverageService.
 *
 * Why this exists
 * ---------------
 * `getCoverage()` returns the full coverage matrix (every school × every
 * field). That is great for analytics but useless when the question is
 * "which 30 schools should the operations team fix first?" — the only
 * answer there is a ranked list.
 *
 * This service ranks schools by an explicit priority score:
 *
 *   priorityScore =
 *       (importanceWeight by US News rank tier)
 *     × (sum of field gap weights)
 *
 *   field gap weight:
 *     missing       → 1.0   (no data at all)
 *     heuristic     → 0.5   (we have a guess, but a measured value would help)
 *     stale         → 0.4   (data > 12 months old)
 *     terminal      → 0.0   (school explicitly does not publish — skip)
 *     official      → 0.0   (trusted, no action needed)
 *
 *   importance weight:
 *     rank ≤ 30     → 5
 *     rank ≤ 100    → 3
 *     rank ≤ 200    → 2
 *     rank > 200 or unranked → 1
 *
 * A `focus` filter narrows the gap calculation to a subset of fields so
 * operators can run a campaign like "fix intl data for Top 200" without
 * being distracted by missing campus-life data.
 *
 * Endpoint: GET /admin/schools/data-health
 *
 * See docs/PREDICTION_ACCURACY_STRATEGY.md §C and the admin frontend at
 * /admin/schools/data-health for the consumer.
 */

export type DataHealthFocus = 'all' | 'intl' | 'rounds' | 'academic';

const FOCUS_FIELDS: Record<DataHealthFocus, ReadonlyArray<string>> = {
  all: [
    'acceptanceRate',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'needBlindInternational',
    'sat25',
    'sat75',
    'testOptional',
  ],
  intl: ['intlAcceptanceRate', 'needBlindInternational'],
  // Round-specific admit rates (ED / EA) are not yet first-class fields on
  // the School table, so for now `rounds` focuses on `oosAcceptanceRate`
  // (the closest available residency-specific signal) and `acceptanceRate`
  // as the baseline. When `edAcceptanceRate` / `eaAcceptanceRate` columns
  // are added this list should be updated.
  rounds: ['acceptanceRate', 'oosAcceptanceRate'],
  academic: ['acceptanceRate', 'sat25', 'sat75', 'testOptional'],
};

function importanceWeight(usNewsRank: number | null | undefined): number {
  if (usNewsRank == null) return 1;
  if (usNewsRank <= 30) return 5;
  if (usNewsRank <= 100) return 3;
  if (usNewsRank <= 200) return 2;
  return 1;
}

/**
 * Fields where a non-authoritative provenance source is misattribution
 * rather than a legitimate fill. For these fields we down-grade an
 * "official"-looking but wrong-source value to a gap so operators know to
 * re-fetch from the right place.
 *
 * Example: `College Scorecard` does NOT publish need-blind-for-intl status,
 * so a needBlindInternational row whose provenance.source contains
 * COLLEGE_SCORECARD has the wrong source and the value cannot be trusted.
 *
 * The set of *trusted* substrings for each field. A source qualifies if it
 * contains any one of these. Anything else is a misattribution gap.
 */
const TRUSTED_SOURCES_BY_FIELD: Record<string, ReadonlyArray<string>> = {
  needBlindInternational: ['CDS_', 'MANUAL_REVIEW', 'OFFICIAL_PAGE'],
};

/**
 * Returns true if a public university would publish an `oosAcceptanceRate`
 * and false otherwise. Private universities do not have an in-state vs OOS
 * distinction in CDS Section C1, so a missing value there is not a data
 * gap — it's "not applicable" and shouldn't drive the action list.
 */
function isOosNotApplicable(item: {
  isPrivate?: boolean | null;
  state?: string | null;
}): boolean {
  // SchoolForCoverage carries `isPrivate` as `boolean`. We treat
  // explicit-true as "private → not applicable". Anything else (false,
  // null, undefined) leaves OOS in scope.
  return item.isPrivate === true;
}

function provenanceMisattributed(
  fieldName: string,
  fieldStatus: { source: string | null },
): boolean {
  const trusted = TRUSTED_SOURCES_BY_FIELD[fieldName];
  if (!trusted) return false; // no trust whitelist → can't tell, assume ok
  if (!fieldStatus.source) return false;
  return !trusted.some((sig) => fieldStatus.source!.includes(sig));
}

export interface DataHealthRow {
  schoolId: string;
  schoolName: string;
  schoolNameZh: string | null;
  usNewsRank: number | null;
  country: string;
  state: string | null;
  /** Highest-priority fields to fix on this school. */
  gapFields: Array<{
    field: string;
    bucket: 'missing' | 'heuristic' | 'stale';
    weight: number;
  }>;
  importanceWeight: number;
  gapWeight: number;
  priorityScore: number;
}

export interface DataHealthDashboard {
  generatedAt: string;
  focus: DataHealthFocus;
  totalSchoolsConsidered: number;
  rowsReturned: number;
  rows: DataHealthRow[];
  /** Field-by-field totals across the considered population. */
  totalsByField: Array<{
    field: string;
    missing: number;
    heuristic: number;
    stale: number;
    terminal: number;
    official: number;
  }>;
}

@Injectable()
export class AdminSchoolDataHealthService {
  constructor(private readonly coverage: AdminSchoolDataCoverageService) {}

  async getHealthDashboard(options?: {
    focus?: DataHealthFocus;
    limit?: number;
    includeUnranked?: boolean;
  }): Promise<DataHealthDashboard> {
    const focus: DataHealthFocus = options?.focus ?? 'all';
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
    const includeUnranked = options?.includeUnranked ?? false;
    const focusFields = FOCUS_FIELDS[focus];

    const coverage = await this.coverage.getCoverage({
      includeAllCountries: false,
    });

    const totalsByField = focusFields.map((field) => ({
      field,
      missing: 0,
      heuristic: 0,
      stale: 0,
      terminal: 0,
      official: 0,
    }));
    const totalsIndex = new Map(totalsByField.map((t) => [t.field, t]));

    const rows: DataHealthRow[] = [];
    let totalConsidered = 0;

    for (const item of coverage.items) {
      if (!includeUnranked && item.usNewsRank == null) continue;
      totalConsidered++;

      const gapFields: DataHealthRow['gapFields'] = [];

      for (const fieldStatus of item.fields) {
        const fieldName = fieldStatus.field as string;
        if (!focusFields.includes(fieldName)) continue;

        const total = totalsIndex.get(fieldName);

        // ── Special-case: oosAcceptanceRate at private schools is N/A ──
        // Private universities don't have an in-state vs OOS distinction,
        // so a missing value isn't a data gap. Skip the row entirely.
        if (fieldName === 'oosAcceptanceRate' && isOosNotApplicable(item)) {
          if (total) total.terminal++;
          continue;
        }

        // Classify the field. Order matters: terminal beats missing,
        // because a school explicitly opting out is not actionable.
        if (fieldStatus.isTerminal) {
          if (total) total.terminal++;
          continue;
        }
        if (fieldStatus.isOfficial) {
          // ── Special-case: misattributed provenance ──
          // For fields with a known trusted-source whitelist, an "official"-
          // marked entry whose source isn't on the whitelist is actually
          // wrong (e.g. needBlindInternational sourced from College
          // Scorecard). Demote it to a gap so operators re-fetch.
          if (provenanceMisattributed(fieldName, fieldStatus)) {
            if (total) total.heuristic++;
            gapFields.push({
              field: fieldName,
              bucket: 'heuristic',
              weight: 0.5,
            });
            continue;
          }
          if (total) total.official++;
          continue;
        }
        if (!fieldStatus.filled) {
          if (total) total.missing++;
          gapFields.push({ field: fieldName, bucket: 'missing', weight: 1.0 });
          continue;
        }
        if (fieldStatus.isHeuristic) {
          if (total) total.heuristic++;
          gapFields.push({
            field: fieldName,
            bucket: 'heuristic',
            weight: 0.5,
          });
          continue;
        }
        if (fieldStatus.staleness === 'STALE') {
          if (total) total.stale++;
          gapFields.push({ field: fieldName, bucket: 'stale', weight: 0.4 });
          continue;
        }
      }

      if (gapFields.length === 0) continue; // school is healthy on the focus axis

      const importance = importanceWeight(item.usNewsRank);
      const gapWeight = gapFields.reduce((acc, g) => acc + g.weight, 0);

      rows.push({
        schoolId: item.schoolId,
        schoolName: item.schoolName,
        schoolNameZh: item.schoolNameZh,
        usNewsRank: item.usNewsRank,
        country: item.country,
        state: item.state,
        gapFields: gapFields.sort((a, b) => b.weight - a.weight),
        importanceWeight: importance,
        gapWeight,
        priorityScore: importance * gapWeight,
      });
    }

    rows.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      generatedAt: new Date().toISOString(),
      focus,
      totalSchoolsConsidered: totalConsidered,
      rowsReturned: Math.min(limit, rows.length),
      rows: rows.slice(0, limit),
      totalsByField,
    };
  }
}
