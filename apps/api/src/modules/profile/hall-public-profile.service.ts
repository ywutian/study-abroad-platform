import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Hall refactor Stage 7 — Builds a desensitized profile snapshot that hall
 * surfaces (锐评/swipe/aggregator) read instead of the original profile.
 *
 * Key rule: hall services MUST consume `User.hallPublicProfile` and NEVER
 * the raw `Profile` table. This prevents PII leaks (real name, high school
 * name, email) into public review/leaderboard contexts.
 *
 * Snapshot is refreshed on:
 *   - User toggles "进入锐评池" (acceptPeerReview true)
 *   - Profile updates affecting public fields (handled by profile.service.ts)
 *   - Admin force-refresh
 */
@Injectable()
export class HallPublicProfileService {
  private readonly logger = new Logger(HallPublicProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a snapshot from the user's current profile and write it back to
   * `User.hallPublicProfile`. Returns the snapshot (or null if no profile).
   */
  async rebuildSnapshot(
    userId: string,
  ): Promise<HallPublicProfileSnapshot | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            testScores: true,
            activities: true,
            awards: { include: { competition: true } },
          },
        },
      },
    });
    if (!user?.profile) return null;
    const p = user.profile;

    // gpa/gpaScale are Prisma Decimal — convert via Number() once to keep
    // the rest of the snapshot logic plain numbers.
    const gpaNum = p.gpa ? Number(p.gpa) : null;
    const gpaScaleNum = p.gpaScale ? Number(p.gpaScale) : null;

    const snapshot: HallPublicProfileSnapshot = {
      // Bucket GPA to 0.05 precision (e.g., "0.90-0.95" as a ratio)
      gpaRange: this.bucketGpa(gpaNum, gpaScaleNum),
      // SAT/ACT in 50-point bands (e.g., "1500-1550") — never the exact score
      satRange: this.bucketSat(p.testScores),
      actRange: this.bucketAct(p.testScores),
      toeflRange: this.bucketToefl(p.testScores),
      grade: p.grade ?? null,
      targetMajor: p.targetMajor ?? null,
      // Coarse region only (country-of-residence; nationality is more sensitive)
      region: this.coarseRegion(p.countryOfResidence ?? p.nationality),
      // Activity / award counts + top-tier flags only, not titles
      activityCount: p.activities.length,
      activityCategories: this.uniqueCategories(p.activities),
      awardCount: p.awards.length,
      topAwardTier: this.topAwardTier(p.awards),
      // Application context — applicationSeason isn't on Profile; defer to null.
      applicationSeason: null,
      // Profile schema has no curriculumType (that lives on AdmissionCase).
      // Use a coarse proxy from currentSchoolType if available.
      curriculumType: p.currentSchoolType ?? null,
      // Snapshot freshness — clients can show "data as of ..."
      snapshotAt: new Date().toISOString(),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { hallPublicProfile: snapshot as unknown as Prisma.InputJsonValue },
    });

    return snapshot;
  }

  /**
   * Clear the snapshot when user opts out of hall reviews — prevents stale
   * data from lingering in the public surface after privacy toggle off.
   */
  async clearSnapshot(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hallPublicProfile: Prisma.JsonNull },
    });
  }

  // ============== helpers ==============

  private bucketGpa(gpa: number | null, scale: number | null): string | null {
    if (gpa === null || scale === null || scale === 0) return null;
    const ratio = gpa / scale;
    // Bucket into 0.05-wide bands (e.g., 0.90-0.95)
    const low = Math.floor(ratio * 20) / 20;
    return `${low.toFixed(2)}-${(low + 0.05).toFixed(2)}`;
  }

  private bucketSat(scores: TestScoreRow[]): string | null {
    const sat = scores.find((s) => s.type === 'SAT');
    if (!sat || sat.score === null) return null;
    const low = Math.floor(sat.score / 50) * 50;
    return `${low}-${low + 50}`;
  }

  private bucketAct(scores: TestScoreRow[]): string | null {
    const act = scores.find((s) => s.type === 'ACT');
    if (!act || act.score === null) return null;
    const low = Math.floor(act.score / 2) * 2;
    return `${low}-${low + 2}`;
  }

  private bucketToefl(scores: TestScoreRow[]): string | null {
    const toefl = scores.find((s) => s.type === 'TOEFL');
    if (!toefl || toefl.score === null) return null;
    const low = Math.floor(toefl.score / 5) * 5;
    return `${low}-${low + 5}`;
  }

  /**
   * Strip district/school detail, keep only province/major-city.
   */
  private coarseRegion(loc: string | null | undefined): string | null {
    if (!loc) return null;
    // Take the first comma-separated component and limit to 16 chars
    return loc.split(/[,，]/)[0]?.trim().slice(0, 16) ?? null;
  }

  private uniqueCategories(activities: ActivityRow[]): string[] {
    const set = new Set<string>();
    for (const a of activities) {
      if (a.category) set.add(a.category);
    }
    return Array.from(set).slice(0, 8);
  }

  private topAwardTier(awards: AwardRow[]): string | null {
    const tierOrder = ['INTERNATIONAL', 'NATIONAL', 'REGIONAL', 'STATE', 'SCHOOL'];
    for (const tier of tierOrder) {
      if (awards.some((a) => a.level === tier)) return tier;
    }
    return null;
  }
}

// Minimal row shapes — we only use a few fields per row.
type TestScoreRow = { type: string | null; score: number | null };
type ActivityRow = { category: string | null };
type AwardRow = { level: string | null };

export interface HallPublicProfileSnapshot {
  gpaRange: string | null;
  satRange: string | null;
  actRange: string | null;
  toeflRange: string | null;
  grade: string | null;
  targetMajor: string | null;
  region: string | null;
  activityCount: number;
  activityCategories: string[];
  awardCount: number;
  topAwardTier: string | null;
  applicationSeason: string | null;
  curriculumType: string | null;
  snapshotAt: string;
}
