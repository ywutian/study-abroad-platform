import { Injectable } from '@nestjs/common';
import { Prisma, AdmissionResult, VerificationLevel } from '@prisma/client';
import type {
  ChinaAdmitTrendResponse,
  ChinaAdmitTrendEntry,
  DataReliability,
  DifficultySignalEntry,
  DifficultySignal,
  EdRdComparisonResponse,
  EdRdComparisonEntry,
} from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { VERIFIED_CASE_WHERE } from './hall.constants';

const DASHBOARD_SCHOOL_SELECT = {
  name: true,
  nameZh: true,
  usNewsRank: true,
} as const;

/**
 * Hall refactor Stage 3 — Verified China Admit Dashboard aggregation.
 *
 * Powers the "中国大陆录取数据中心" surface: per-school China-mainland admit
 * trend, year-over-year difficulty signal, and ED vs RD comparison.
 *
 * Only L2/L3-verified cases count toward statistics (L1 self-reported is
 * excluded — see docs Stage 1 three-level verification model). Every payload
 * carries an explicit `sampleSize` so the frontend can hide numbers below
 * the reliability threshold rather than render misleading data.
 */
@Injectable()
export class HallVerifiedDashboardService {
  /** Nationality values that count as China-mainland applicants. */
  private static readonly CHINA_NATIONALITIES = ['China', '中国', 'CN', 'PRC'];

  /** Only platform-verified / expert-verified cases feed the dashboard. */
  private static readonly TRUSTED_LEVELS: VerificationLevel[] = [
    VerificationLevel.L2,
    VerificationLevel.L3,
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard filter = the shared {@link VERIFIED_CASE_WHERE} trust predicate
   * (C4: one source of truth) + two dashboard-specific narrowings:
   *  - `verificationLevel ∈ {L2,L3}` (L1 self-reported is excluded);
   *  - `nationality ∈ CHINA_NATIONALITIES` (mainland-China applicants only).
   *
   * The trust predicate itself is no longer redefined here — so this surface
   * and the public ranking can never silently disagree on what "verified"
   * means; they only differ by these explicit, intentional narrowings.
   */
  private baseWhere(): Prisma.AdmissionCaseWhereInput {
    return {
      ...VERIFIED_CASE_WHERE,
      verificationLevel: {
        in: HallVerifiedDashboardService.TRUSTED_LEVELS,
      },
      nationality: {
        in: HallVerifiedDashboardService.CHINA_NATIONALITIES,
      },
    };
  }

  private static reliability(sampleSize: number): DataReliability {
    if (sampleSize >= 5) return 'A';
    if (sampleSize >= 3) return 'B';
    if (sampleSize >= 1) return 'C';
    return 'D';
  }

  /**
   * Per-school China-mainland admit count over the last `years` cycles.
   * `schoolIds` empty → top-30 schools by US News rank.
   */
  async getChinaAdmitTrend(
    schoolIds: string[],
    years: number,
  ): Promise<ChinaAdmitTrendResponse> {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - years;

    const targetSchoolIds = await this.resolveSchoolIds(schoolIds);

    // governance: aggregate-only — per-school/per-year admitted+total counts, no identifying fields. Small-sample floor: years below MIN_YEAR_TOTAL = 3 submitted cases are dropped, and a school with no surviving year is omitted entirely. Filters isVerified + approved review + L2/L3 + China nationality, but NOT `visibility` — that a PRIVATE verified case still counts toward an aggregate is the documented design in hall.constants.ts, unchanged here; what changed is that the aggregate can no longer be thin enough to name one person
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        ...this.baseWhere(),
        schoolId: { in: targetSchoolIds },
        year: { gte: minYear },
      },
      select: {
        schoolId: true,
        year: true,
        result: true,
        school: { select: DASHBOARD_SCHOOL_SELECT },
      },
    });

    // schoolId → year → { admitted, total }
    const grouped = new Map<
      string,
      {
        name: string;
        nameZh: string | null;
        rank: number | null;
        years: Map<number, { admitted: number; total: number }>;
      }
    >();

    for (const c of cases) {
      let entry = grouped.get(c.schoolId);
      if (!entry) {
        entry = {
          name: c.school.name,
          nameZh: c.school.nameZh,
          rank: c.school.usNewsRank,
          years: new Map(),
        };
        grouped.set(c.schoolId, entry);
      }
      const ye = entry.years.get(c.year) ?? { admitted: 0, total: 0 };
      ye.total += 1;
      if (c.result === AdmissionResult.ADMITTED) ye.admitted += 1;
      entry.years.set(c.year, ye);
    }

    const schools: ChinaAdmitTrendEntry[] = targetSchoolIds
      .map((schoolId): ChinaAdmitTrendEntry | null => {
        const entry = grouped.get(schoolId);
        if (!entry) return null;
        const yearly = Array.from(entry.years.entries())
          .map(([year, v]) => ({ year, admitted: v.admitted, total: v.total }))
          // Suppress thin cells. This is a @Public() endpoint publishing, per
          // school and per year, exactly how many China-mainland applicants
          // were verified and how many got in — so a `{ admitted: 1, total: 1 }`
          // cell names one identifiable person's outcome to anyone who loads
          // the page. The class already had the concept and the constant:
          // MIN_YEAR_TOTAL exists for the difficulty signal with precisely
          // this rationale ("a 1/1 = 100% year is noise, not signal"), and
          // reliability() grades small samples — but grading only LABELS the
          // cell, it still ships the exact numbers. Same floor, applied to the
          // data rather than to its caption.
          .filter((y) => y.total >= HallVerifiedDashboardService.MIN_YEAR_TOTAL)
          .sort((a, b) => a.year - b.year);
        // Every year suppressed → no card, rather than an empty one.
        if (yearly.length === 0) return null;
        const sampleSize = yearly.reduce((s, y) => s + y.admitted, 0);
        return {
          schoolId,
          schoolName: entry.name,
          schoolNameZh: entry.nameZh ?? undefined,
          schoolRank: entry.rank ?? undefined,
          yearly,
          reliability: HallVerifiedDashboardService.reliability(sampleSize),
          sampleSize,
        };
      })
      .filter((s): s is ChinaAdmitTrendEntry => s !== null)
      .sort((a, b) => (a.schoolRank ?? 999) - (b.schoolRank ?? 999));

    return { schools, lastUpdated: new Date().toISOString() };
  }

  /**
   * Minimum cases SUBMITTED for a year before that year's admit RATE may be
   * published. Years below this are dropped from the rate series.
   *
   * Raised 3 → 5 on 2026-08-04. The old value answered the wrong question: it
   * was set for reliability — a 1/1 = 100% year is noise, not signal — and then
   * left standing as the only guard on an `@Public()` route. Reliability and
   * re-identification are different thresholds, and this surface needs the
   * stricter of the two: the series is filtered to verified China-nationality
   * applicants at one school in one year, so at n=3 with 3 admits it publishes
   * where three identifiable people got in, to anyone, unauthenticated.
   *
   * 5 is the number `.claude/rules/backend.md` names as the floor for
   * aggregate reporting over people and the value CaseToolsService and
   * prediction already use. Below-floor years drop out; a school with no
   * surviving year is omitted entirely, as before.
   */
  private static readonly MIN_YEAR_TOTAL = 5;

  /**
   * Minimum verified admits before a school's ED/RD split may be published.
   * Was an inline `5` gating only the `edTilt` label; named and applied to the
   * counts too, so the figure the label is derived from is not published when
   * the label itself is judged unreliable.
   */
  private static readonly ED_RD_MIN_SAMPLE = 5;

  /**
   * Year-over-year admission difficulty signal per school.
   *
   * 2026-05 Hall Plan C (C4): this used to compute "difficulty" from the
   * year-over-year ADMIT COUNT. That number is dominated by how many cases
   * users happened to submit that year — a sampling artifact, not a real
   * change in selectivity. A school looking "harder" usually just meant
   * fewer people uploaded cases.
   *
   * Fixed: the signal is now derived from the admit RATE (admitted / total),
   * and only years with at least {@link MIN_YEAR_TOTAL} submitted cases enter
   * the comparison. `changePct` is the change in admit-rate percentage POINTS
   * across the window. When too few years clear the gate, the signal stays
   * `stable` (insufficient evidence) — the DataReliability rating still
   * gates whether the frontend renders any of this at all.
   *
   *  declining → admit rate dropped > 15 points across the window
   *  surging   → single-year admit-rate drop > 25 points
   *  stable    → otherwise, or not enough rate-eligible years to judge
   */
  async getDifficultySignal(
    schoolIds: string[],
  ): Promise<DifficultySignalEntry[]> {
    const trend = await this.getChinaAdmitTrend(schoolIds, 3);
    const MIN = HallVerifiedDashboardService.MIN_YEAR_TOTAL;

    return trend.schools.map((s): DifficultySignalEntry => {
      // Keep only years with enough submitted cases for a meaningful rate.
      const series = s.yearly
        .filter((y) => y.total >= MIN)
        .map((y) => ({ year: y.year, rate: y.admitted / y.total }))
        .sort((a, b) => a.year - b.year);

      let signal: DifficultySignal = 'stable';
      let changePct = 0;

      if (series.length >= 2) {
        const first = series[0].rate;
        const last = series[series.length - 1].rate;
        // Change in admit-rate percentage POINTS (not a count ratio).
        changePct = Math.round((last - first) * 100);

        // Sharpest single-year admit-rate drop, in percentage points.
        let worstYoY = 0;
        for (let i = 1; i < series.length; i++) {
          const yoy = Math.round((series[i].rate - series[i - 1].rate) * 100);
          if (yoy < worstYoY) worstYoY = yoy;
        }

        if (worstYoY < -25) signal = 'surging';
        else if (changePct < -15) signal = 'declining';
      }

      return {
        schoolId: s.schoolId,
        schoolName: s.schoolName,
        schoolNameZh: s.schoolNameZh,
        signal,
        changePct,
        sampleSize: s.sampleSize,
      };
    });
  }

  /** ED vs RD admit comparison for a single application cycle. */
  async getEdRdComparison(
    schoolIds: string[],
    year: number,
  ): Promise<EdRdComparisonResponse> {
    const targetSchoolIds = await this.resolveSchoolIds(schoolIds);

    // governance: aggregate-only — per-school ED vs RD admit counts. Small-sample floor: schools below ED_RD_MIN_SAMPLE = 5 verified admits are withheld entirely — previously only the derived `edTilt` label was gated while the counts it came from shipped at any size. Same visibility note as getChinaAdmitTrend
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        ...this.baseWhere(),
        schoolId: { in: targetSchoolIds },
        year,
        result: AdmissionResult.ADMITTED,
      },
      select: {
        schoolId: true,
        round: true,
        school: { select: DASHBOARD_SCHOOL_SELECT },
      },
    });

    const grouped = new Map<
      string,
      {
        name: string;
        nameZh: string | null;
        rank: number | null;
        ed: number;
        rd: number;
      }
    >();

    for (const c of cases) {
      let entry = grouped.get(c.schoolId);
      if (!entry) {
        entry = {
          name: c.school.name,
          nameZh: c.school.nameZh,
          rank: c.school.usNewsRank,
          ed: 0,
          rd: 0,
        };
        grouped.set(c.schoolId, entry);
      }
      const round = (c.round ?? '').toUpperCase().trim();
      // 2026-05 Hall Plan C (C4): only BINDING Early Decision (ED / ED1 /
      // ED2 / EDII) counts toward the `ed` bucket. EA / REA / SCEA are
      // NON-binding — lumping them in overstated the "ED admit advantage"
      // a Chinese family weighs when deciding whether to apply ED. A
      // binding commitment is the real signal; a non-binding early app is
      // not. Non-binding rounds fall to the `rd` bucket.
      if (round.startsWith('ED')) {
        entry.ed += 1;
      } else {
        entry.rd += 1;
      }
    }

    const schools: EdRdComparisonEntry[] = targetSchoolIds
      .map((schoolId): EdRdComparisonEntry | null => {
        const entry = grouped.get(schoolId);
        if (!entry) return null;
        const sampleSize = entry.ed + entry.rd;
        // Same suppression as the trend, and for the same reason: edTilt was
        // already withheld below 5 admits, but edAdmitted / rdAdmitted /
        // sampleSize shipped raw at any size — so a school with one verified
        // ED admit published that fact on a @Public() route. Gating the label
        // while emitting the counts it was derived from protects nothing.
        if (sampleSize < HallVerifiedDashboardService.ED_RD_MIN_SAMPLE)
          return null;
        const edSharePct =
          sampleSize > 0 ? Math.round((entry.ed / sampleSize) * 100) : null;
        let edTilt: EdRdComparisonEntry['edTilt'] = 'insufficient';
        if (
          sampleSize >= HallVerifiedDashboardService.ED_RD_MIN_SAMPLE &&
          edSharePct !== null
        ) {
          if (edSharePct >= 65) edTilt = 'ed_favored';
          else if (edSharePct <= 35) edTilt = 'rd_favored';
          else edTilt = 'balanced';
        }
        return {
          schoolId,
          schoolName: entry.name,
          schoolNameZh: entry.nameZh ?? undefined,
          edAdmitted: entry.ed,
          rdAdmitted: entry.rd,
          edSharePct,
          edTilt,
          sampleSize,
        };
      })
      .filter((s): s is EdRdComparisonEntry => s !== null)
      .sort((a, b) => b.sampleSize - a.sampleSize);

    return { year, schools };
  }

  /** Empty `schoolIds` → top-30 schools by US News rank. */
  private async resolveSchoolIds(schoolIds: string[]): Promise<string[]> {
    if (schoolIds.length > 0) return schoolIds;
    // governance: system-scope — School lookup to expand an empty filter to the top-30 by US News rank
    const top = await this.prisma.school.findMany({
      where: { usNewsRank: { not: null, lte: 30 } },
      select: { id: true },
      orderBy: { usNewsRank: 'asc' },
      take: 30,
    });
    return top.map((s) => s.id);
  }
}
