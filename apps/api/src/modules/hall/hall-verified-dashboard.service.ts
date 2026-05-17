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
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';

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

  private baseWhere(): Prisma.AdmissionCaseWhereInput {
    return {
      isVerified: true,
      ...CASE_REVIEW_APPROVED_WHERE,
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
        school: { select: { name: true, nameZh: true, usNewsRank: true } },
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
          .sort((a, b) => a.year - b.year);
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
   * Year-over-year admission difficulty signal per school.
   *  declining → cumulative drop > 20% across the window
   *  surging   → single-year drop > 30% (admission got materially harder)
   *  stable    → otherwise, or sample too small to judge
   */
  async getDifficultySignal(
    schoolIds: string[],
  ): Promise<DifficultySignalEntry[]> {
    const trend = await this.getChinaAdmitTrend(schoolIds, 3);

    return trend.schools.map((s): DifficultySignalEntry => {
      const series = s.yearly.filter((y) => y.year);
      let signal: DifficultySignal = 'stable';
      let changePct = 0;

      if (s.sampleSize >= 3 && series.length >= 2) {
        const first = series[0].admitted;
        const last = series[series.length - 1].admitted;
        if (first > 0) {
          changePct = Math.round(((last - first) / first) * 100);
        }
        // single-year sharpest drop
        let worstYoY = 0;
        for (let i = 1; i < series.length; i++) {
          const prev = series[i - 1].admitted;
          const cur = series[i].admitted;
          if (prev > 0) {
            const yoy = Math.round(((cur - prev) / prev) * 100);
            if (yoy < worstYoY) worstYoY = yoy;
          }
        }
        if (worstYoY < -30) signal = 'surging';
        else if (changePct < -20) signal = 'declining';
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
        school: { select: { name: true, nameZh: true, usNewsRank: true } },
      },
    });

    const grouped = new Map<
      string,
      { name: string; nameZh: string | null; rank: number | null; ed: number; rd: number }
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
      const round = (c.round ?? '').toUpperCase();
      // ED / EA / REA all count as the binding/early bucket for this view
      if (round.includes('ED') || round.includes('EA') || round.includes('REA')) {
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
        const edSharePct =
          sampleSize > 0 ? Math.round((entry.ed / sampleSize) * 100) : null;
        let edTilt: EdRdComparisonEntry['edTilt'] = 'insufficient';
        if (sampleSize >= 5 && edSharePct !== null) {
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
    const top = await this.prisma.school.findMany({
      where: { usNewsRank: { not: null, lte: 30 } },
      select: { id: true },
      orderBy: { usNewsRank: 'asc' },
      take: 30,
    });
    return top.map((s) => s.id);
  }
}
