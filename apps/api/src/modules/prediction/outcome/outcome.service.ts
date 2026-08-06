import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PredictionOutcomeLabel,
  PredictionOutcomeLabelStatus,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PointsService, PointAction } from '../../points/incentive.service';
import {
  ListMyOutcomesDto,
  SubmitOutcomeDto,
  VerifyOutcomeDto,
} from './dto/submit-outcome.dto';

/**
 * Tier of evidence; used to compute reward points and progression
 * SELF_REPORTED → user reported only
 * COUNSELOR_VERIFIED → admin confirmed (no doc)
 * DOCUMENT_VERIFIED → admin confirmed AND verified document
 */
const TIER_POINTS: Partial<Record<PredictionOutcomeLabelStatus, number>> = {
  SELF_REPORTED: 50,
  COUNSELOR_VERIFIED: 150,
  DOCUMENT_VERIFIED: 300,
};

/** Outcomes that count for calibration (final decisions) */
const CALIBRATION_RESULTS: PredictionOutcomeLabel[] = ['ADMITTED', 'REJECTED'];

/** AdmissionResult-compatible subset (the four enum values shared by both) */
const ADMISSION_CASE_RESULTS = new Set<PredictionOutcomeLabel>([
  'ADMITTED',
  'REJECTED',
  'WAITLISTED',
  'DEFERRED',
]);

/** Marker used in the `notes` field to flag opt-in for the AdmissionCase pool */
const SHARE_OPT_IN_MARKER = '[share=true]';

function hasShareOptIn(notes: string | null | undefined): boolean {
  return !!notes && notes.includes(SHARE_OPT_IN_MARKER);
}

function gpaToRange(gpa: number | null | undefined): string | null {
  if (gpa === null || gpa === undefined || !isFinite(Number(gpa))) return null;
  const n = Number(gpa);
  // Round to nearest 0.1 band, ±0.05 width
  const lo = (Math.floor(n * 20) / 20).toFixed(2);
  const hi = ((Math.floor(n * 20) + 1) / 20).toFixed(2);
  return `${lo}-${hi}`;
}

export interface OutcomeView {
  id: string;
  predictionResultId: string;
  result: PredictionOutcomeLabel;
  status: PredictionOutcomeLabelStatus;
  notes: string | null;
  evidenceUrl: string | null;
  round: string | null;
  isFinal: boolean;
  reportedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  schoolName?: string;
  predictionProbability?: number;
}

@Injectable()
export class OutcomeService {
  private readonly logger = new Logger(OutcomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incentive: PointsService,
  ) {}

  /**
   * User reports an admission outcome for a prediction they made.
   * Guards:
   *  - The PredictionResult must exist and belong to the user
   *  - Each (predictionResultId, reportedBy) pair gets one SELF_REPORTED record;
   *    re-reporting updates the existing record
   *  - If evidence URL provided, status stays SELF_REPORTED (admin must still verify)
   */
  async submit(userId: string, dto: SubmitOutcomeDto): Promise<OutcomeView> {
    const pr = await this.prisma.predictionResult.findUnique({
      where: { id: dto.predictionResultId },
      include: { profile: { select: { userId: true } } },
    });

    if (!pr) throw new NotFoundException('PredictionResult not found');
    if (pr.profile.userId !== userId) {
      throw new ForbiddenException(
        'You can only report outcomes for your own predictions',
      );
    }

    const school = await this.prisma.school.findUnique({
      where: { id: pr.schoolId },
      select: { name: true },
    });

    // Anti-fraud: must have predicted this school at least once (already validated by FK)
    // Dedup: upsert by (predictionResultId, reportedBy) — only one self-reported record per pair
    const existing = await this.prisma.predictionOutcomeLabelRecord.findFirst({
      where: {
        predictionResultId: dto.predictionResultId,
        reportedBy: userId,
        status: 'SELF_REPORTED',
      },
    });

    // Encode opt-in to AdmissionCase pool as a marker in notes (avoids schema migration for MVP)
    const userNotes = dto.notes ?? '';
    const shareMarker = dto.shareWithFutureApplicants
      ? ` ${SHARE_OPT_IN_MARKER}`
      : '';
    const composedNotes = (userNotes + shareMarker).trim() || null;

    const baseData = {
      predictionResultId: dto.predictionResultId,
      result: dto.result,
      status: 'SELF_REPORTED' as PredictionOutcomeLabelStatus,
      notes: composedNotes,
      evidenceUrl: dto.evidenceUrl ?? null,
      round: dto.round ?? pr.applicationRound ?? null,
      isFinal: dto.isFinal ?? CALIBRATION_RESULTS.includes(dto.result),
      reportedBy: userId,
    };

    const record = existing
      ? await this.prisma.predictionOutcomeLabelRecord.update({
          where: { id: existing.id },
          data: baseData,
        })
      : await this.prisma.predictionOutcomeLabelRecord.create({
          data: baseData,
        });

    this.logger.log(
      `User ${userId} reported ${dto.result} for prediction ${dto.predictionResultId} at ${school?.name ?? '?'} (record ${record.id})`,
    );

    // Award points only on first-time report (not on idempotent re-submit)
    if (!existing) {
      try {
        await this.incentive.adjustPoints(userId, PointAction.SUBMIT_CASE, {
          source: 'outcome-report',
          predictionResultId: dto.predictionResultId,
          outcomeId: record.id,
          schoolId: pr.schoolId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to award points for outcome ${record.id}: ${err instanceof Error ? err.message : err}`,
        );
        // Non-fatal — outcome is recorded regardless of point reward success
      }
    }

    return this.toView(record, school?.name, Number(pr.probability));
  }

  /**
   * Attach evidence URL to a previously-submitted outcome.
   * The user uploads file to storage (separate endpoint) and then calls this
   * to associate the URL with their outcome record. Subsequent admin
   * verification can then upgrade the status to DOCUMENT_VERIFIED.
   */
  async attachEvidence(
    userId: string,
    outcomeId: string,
    evidenceUrl: string,
  ): Promise<OutcomeView> {
    const record = await this.prisma.predictionOutcomeLabelRecord.findUnique({
      where: { id: outcomeId },
      include: { predictionResult: true },
    });
    if (!record) throw new NotFoundException('Outcome not found');
    if (record.reportedBy !== userId) {
      throw new ForbiddenException("Cannot modify other users' outcomes");
    }
    if (record.status !== 'SELF_REPORTED') {
      throw new BadRequestException(
        `Evidence can only be attached to SELF_REPORTED outcomes (current: ${record.status})`,
      );
    }

    const updated = await this.prisma.predictionOutcomeLabelRecord.update({
      where: { id: outcomeId },
      data: { evidenceUrl },
      include: { predictionResult: true },
    });

    const school = await this.prisma.school.findUnique({
      where: { id: updated.predictionResult.schoolId },
      select: { name: true },
    });

    this.logger.log(`User ${userId} attached evidence to outcome ${outcomeId}`);

    return this.toView(
      updated,
      school?.name,
      Number(updated.predictionResult.probability),
    );
  }

  /**
   * Lists outcomes the current user has reported.
   */
  async listMine(
    userId: string,
    query: ListMyOutcomesDto,
  ): Promise<OutcomeView[]> {
    const records = await this.prisma.predictionOutcomeLabelRecord.findMany({
      where: {
        reportedBy: userId,
        ...(query.result ? { result: query.result } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { predictionResult: true },
      orderBy: { createdAt: 'desc' },
    });

    const schoolIds = [
      ...new Set(records.map((r) => r.predictionResult.schoolId)),
    ];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

    return records.map((r) =>
      this.toView(
        r,
        schoolMap.get(r.predictionResult.schoolId),
        Number(r.predictionResult.probability),
      ),
    );
  }

  /**
   * Lists predictions for this user that have NO outcome reported yet.
   * Used by the dashboard to prompt "report your Stanford result".
   */
  async listPendingDecisions(userId: string): Promise<
    Array<{
      predictionResultId: string;
      schoolId: string;
      schoolName: string;
      probability: number;
      tier: string | null;
      applicationRound: string | null;
      predictedAt: Date;
    }>
  > {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return [];

    // Only prompt for schools the user actually saved to their list — not every
    // school ever previewed/quick-matched. Without this the banner counted every
    // PredictionResult row (50+) instead of the ~14 saved schools (dashboard bug).
    const listItems = await this.prisma.schoolListItem.findMany({
      where: { userId },
      select: { schoolId: true },
    });
    const listSchoolIds = listItems.map((i) => i.schoolId);
    if (listSchoolIds.length === 0) return [];

    // A decision is "released" for a PREDICTION, not for a school.
    //
    // SchoolDeadline keeps one row per school per season
    // (@@unique([schoolId, year, round])) and accumulates them, so a bare
    // `decisionDate <= now` matched any historical round: a school whose 2024
    // cycle closed marked a 2027 applicant as "go report your result" for an
    // application they never made. The comment here used to claim this mirrored
    // the outcome-reminder cron — it did not. That job uses a [-7, +7] day
    // WINDOW, current-season by construction; this used every season ever.
    //
    // Predictions come first now, so each one's own season can be matched.
    const now = new Date();
    const predictions = await this.prisma.predictionResult.findMany({
      where: {
        profileId: profile.id,
        schoolId: { in: listSchoolIds },
        outcomeLabelRecords: { none: { reportedBy: userId } },
        // Exclude throwaway quick-match PREVIEW rows; keep AUTHORITATIVE + legacy null.
        OR: [{ authority: null }, { authority: 'AUTHORITATIVE' }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (predictions.length === 0) return [];

    // Only rows that know their season can be matched to a season's deadline.
    // `applicationYear` is null on everything written before
    // prediction-persistence began stamping it, and null means "season
    // unknown" — which cannot support the claim "this decision is out". Those
    // rows are not offered; they age out as users re-run predictions.
    const seasons = [
      ...new Set(
        predictions
          .map((p) => p.applicationYear)
          .filter((y): y is number => typeof y === 'number'),
      ),
    ];
    if (seasons.length === 0) return [];

    // governance: system-scope — SchoolDeadline is the global admissions
    // calendar (no User relation). Already narrowed to `listSchoolIds`, i.e.
    // this user's own saved list, fetched by userId at the top of this method.
    const released = await this.prisma.schoolDeadline.findMany({
      where: {
        schoolId: { in: listSchoolIds },
        year: { in: seasons },
        decisionDate: { lte: now },
      },
      select: { schoolId: true, year: true },
    });
    const releasedBySeason = new Set(
      released.map((d) => `${d.schoolId}:${d.year}`),
    );
    if (releasedBySeason.size === 0) return [];

    // The pairing itself. Without this the season query above would only have
    // changed which rows were FETCHED, leaving every prediction returned —
    // including ones whose own season has not released.
    const reportable = predictions.filter(
      (p) =>
        typeof p.applicationYear === 'number' &&
        releasedBySeason.has(`${p.schoolId}:${p.applicationYear}`),
    );
    if (reportable.length === 0) return [];

    const schoolIds = [...new Set(reportable.map((p) => p.schoolId))];
    // governance: system-scope — School name lookup; published institution data
    // with no User relation, and the ids come from `reportable`, which is
    // already scoped to this user's own predictions.
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

    return reportable.map((p) => ({
      predictionResultId: p.id,
      schoolId: p.schoolId,
      schoolName: schoolMap.get(p.schoolId) ?? '(unknown school)',
      probability: Number(p.probability),
      tier: p.tier,
      applicationRound: p.applicationRound,
      predictedAt: p.createdAt,
    }));
  }

  /**
   * Admin verifies an outcome — upgrades to COUNSELOR_VERIFIED or DOCUMENT_VERIFIED.
   * Awards differential points to the user upon verification.
   */
  async verify(
    outcomeId: string,
    adminUserId: string,
    dto: VerifyOutcomeDto,
  ): Promise<OutcomeView> {
    // governance: admin-scope — outcome review behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const record = await this.prisma.predictionOutcomeLabelRecord.findUnique({
      where: { id: outcomeId },
      include: { predictionResult: true },
    });
    if (!record) throw new NotFoundException('Outcome not found');

    if (record.status !== 'SELF_REPORTED') {
      throw new BadRequestException(
        `Outcome is already in status ${record.status}; cannot re-verify`,
      );
    }

    if (dto.status === 'DOCUMENT_VERIFIED' && !record.evidenceUrl) {
      throw new BadRequestException(
        'Cannot upgrade to DOCUMENT_VERIFIED without an evidence URL',
      );
    }

    // governance: admin-scope — outcome review behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const updated = await this.prisma.predictionOutcomeLabelRecord.update({
      where: { id: outcomeId },
      data: {
        status: dto.status,
        notes: dto.reviewNote
          ? `${record.notes ?? ''}\n[admin] ${dto.reviewNote}`.trim()
          : record.notes,
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
      },
      include: { predictionResult: true },
    });

    // governance: admin-scope — outcome review behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const school = await this.prisma.school.findUnique({
      where: { id: updated.predictionResult.schoolId },
      select: { name: true },
    });

    // Award differential points for verification upgrade
    if (record.reportedBy && dto.status !== 'SELF_REPORTED') {
      const isDocument = dto.status === 'DOCUMENT_VERIFIED';
      const action = isDocument
        ? PointAction.VERIFICATION_APPROVED // higher reward
        : PointAction.CASE_VERIFIED;
      try {
        await this.incentive.adjustPoints(record.reportedBy, action, {
          source: 'outcome-verification',
          outcomeId,
          finalStatus: dto.status,
          adminUserId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to award verification points for outcome ${outcomeId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // M6.7: If user opted in to share with future applicants AND result is binary,
    // auto-create an AdmissionCase entry so 学弟学妹 can learn from this outcome.
    if (
      hasShareOptIn(record.notes) &&
      ADMISSION_CASE_RESULTS.has(updated.result) &&
      ['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED'].includes(dto.status)
    ) {
      try {
        await this.createAdmissionCaseFromOutcome(updated.id);
      } catch (err) {
        this.logger.warn(
          `Failed to create AdmissionCase from outcome ${outcomeId}: ${err instanceof Error ? err.message : err}`,
        );
        // Non-fatal — verification succeeds regardless
      }
    }

    this.logger.log(
      `Admin ${adminUserId} verified outcome ${outcomeId} → ${dto.status}`,
    );

    return this.toView(
      updated,
      school?.name,
      Number(updated.predictionResult.probability),
    );
  }

  /**
   * Admin queue — outcomes pending verification.
   */
  async listPendingVerification(): Promise<OutcomeView[]> {
    // governance: admin-scope — outcome review behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const records = await this.prisma.predictionOutcomeLabelRecord.findMany({
      where: { status: 'SELF_REPORTED' },
      include: { predictionResult: true },
      orderBy: [{ evidenceUrl: 'desc' }, { createdAt: 'asc' }], // evidence-attached first
      take: 100,
    });
    const schoolIds = [
      ...new Set(records.map((r) => r.predictionResult.schoolId)),
    ];
    // governance: admin-scope — outcome review behind @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
    return records.map((r) =>
      this.toView(
        r,
        schoolMap.get(r.predictionResult.schoolId),
        Number(r.predictionResult.probability),
      ),
    );
  }

  /**
   * For dashboard: count of user's outcomes by status.
   */
  async getMyStats(userId: string): Promise<{
    totalReported: number;
    selfReported: number;
    verified: number;
    pointsEarned: number;
  }> {
    const counts = await this.prisma.predictionOutcomeLabelRecord.groupBy({
      by: ['status'],
      where: { reportedBy: userId },
      _count: true,
    });

    const stats = {
      totalReported: 0,
      selfReported: 0,
      verified: 0,
      pointsEarned: 0,
    };
    for (const c of counts) {
      stats.totalReported += c._count;
      if (c.status === 'SELF_REPORTED') stats.selfReported += c._count;
      else if (
        c.status === 'COUNSELOR_VERIFIED' ||
        c.status === 'DOCUMENT_VERIFIED'
      )
        stats.verified += c._count;
      stats.pointsEarned += (TIER_POINTS[c.status] ?? 0) * c._count;
    }
    return stats;
  }

  /**
   * M6.7: Create an AdmissionCase from a verified outcome (opt-in only).
   * The userId is preserved on the case (FK constraint) but display layers
   * should anonymize / show only the snapshot fields.
   *
   * Idempotent: if AdmissionCase already exists for (userId, schoolId, year), skip.
   */
  private async createAdmissionCaseFromOutcome(
    outcomeId: string,
  ): Promise<void> {
    const record = await this.prisma.predictionOutcomeLabelRecord.findUnique({
      where: { id: outcomeId },
      include: {
        predictionResult: {
          include: {
            profile: {
              include: {
                user: { select: { id: true } },
                testScores: true,
                activities: true,
                awards: true,
                education: { orderBy: { endDate: 'desc' }, take: 5 },
              },
            },
          },
        },
      },
    });
    if (!record || !record.reportedBy) return;
    if (!ADMISSION_CASE_RESULTS.has(record.result)) return;

    const profile = record.predictionResult.profile;
    const year = new Date(record.predictionResult.createdAt).getFullYear();
    // HS context is on Education rows, not Profile directly
    const highSchoolEdu = profile.education?.find(
      (e: any) => e.highSchoolId !== null && e.highSchoolId !== undefined,
    );
    const highSchoolId = highSchoolEdu?.highSchoolId ?? null;

    const existing = await this.prisma.admissionCase.findFirst({
      where: {
        userId: record.reportedBy,
        schoolId: record.predictionResult.schoolId,
        year,
      },
    });
    if (existing) {
      this.logger.log(
        `AdmissionCase already exists for user=${record.reportedBy} school=${record.predictionResult.schoolId} year=${year}, skipping`,
      );
      return;
    }

    // Convert profile snapshot
    const gpaRange = gpaToRange(profile.gpa ? Number(profile.gpa) : null);
    const satTest = profile.testScores?.find((t: any) => t.type === 'SAT');
    const satRange = satTest
      ? `${Math.floor(Number(satTest.score) / 10) * 10}-${Math.floor(Number(satTest.score) / 10) * 10 + 10}`
      : null;
    const actTest = profile.testScores?.find((t: any) => t.type === 'ACT');
    const actRange = actTest ? `${actTest.score}-${actTest.score}` : null;
    const apCount = (profile.testScores ?? []).filter(
      (t: any) => t.type === 'AP',
    ).length;

    const tags: string[] = [];
    if (profile.recruitedAthlete) tags.push('athlete');
    if (profile.firstGeneration) tags.push('first_gen');
    if (Array.isArray(profile.legacy) && profile.legacy.length > 0)
      tags.push('legacy');

    const activitiesJson = (profile.activities ?? []).map((a: any) => ({
      category: a.category,
      description: a.name,
      role: a.role,
      hoursPerWeek: a.hoursPerWeek,
      weeksPerYear: a.weeksPerYear,
    }));
    const awardsJson = (profile.awards ?? []).map((a: any) => ({
      name: a.name,
      level: a.level,
      year: a.year,
    }));

    await this.prisma.admissionCase.create({
      data: {
        userId: record.reportedBy,
        schoolId: record.predictionResult.schoolId,
        year,
        round: record.round ?? record.predictionResult.applicationRound,
        result: record.result as any, // PredictionOutcomeLabel subset matches AdmissionResult enum
        major: profile.targetMajor,
        gpaRange,
        gpa9: profile.gpa9 ? Number(profile.gpa9) : null,
        gpa10: profile.gpa10 ? Number(profile.gpa10) : null,
        gpa11: profile.gpa11 ? Number(profile.gpa11) : null,
        gpa12: profile.gpa12 ? Number(profile.gpa12) : null,
        gpaScale: profile.gpaScale ? Number(profile.gpaScale) : null,
        satRange,
        actRange,
        tags,
        apCount: apCount || null,
        activities: activitiesJson.length ? activitiesJson : undefined,
        awards: awardsJson.length ? awardsJson : undefined,
        highSchoolId,
        nationality: profile.nationality,

        // Mark this case as auto-generated from a verified outcome, so
        // downstream consumers can filter or weight it differently. Until now
        // that was a comment with nothing under it: the row was
        // indistinguishable from a student-submitted case, and the only thing
        // separating them was `visibility` landing on its schema default.
        //
        // It reaches the human review queue like any other case
        // (reviewStatus defaults to PENDING_REVIEW, and the queue selects
        // `source`), so the reviewer now sees where it came from.
        source: 'outcome_self_report',

        // This block only runs behind hasShareOptIn(), i.e. the student ticked
        // "把这条 outcome 匿名分享给学弟学妹 — 你的录取结果会被脱敏后加入案例库".
        // Leaving `visibility` to its schema default made that promise false:
        // @default(PRIVATE) is served by no public surface, admin approval sets
        // reviewStatus only and never touches visibility, and the student is
        // not told the case exists, so nobody would ever edit it. The case was
        // created and then invisible to everyone — forever.
        //
        // ANONYMOUS is what the consent text says and what the ordinary submit
        // form uses. reviewStatus stays at its PENDING_REVIEW default, so a
        // human still vets it before anything requiring approval will serve it.
        visibility: Visibility.ANONYMOUS,
      },
    });

    this.logger.log(
      `Created AdmissionCase from verified outcome ${outcomeId} (user=${record.reportedBy}, school=${record.predictionResult.schoolId}, year=${year})`,
    );
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private toView(
    record: any,
    schoolName?: string,
    probability?: number,
  ): OutcomeView {
    return {
      id: record.id,
      predictionResultId: record.predictionResultId,
      result: record.result,
      status: record.status,
      notes: record.notes,
      evidenceUrl: record.evidenceUrl,
      round: record.round,
      isFinal: record.isFinal,
      reportedBy: record.reportedBy,
      resolvedBy: record.resolvedBy,
      resolvedAt: record.resolvedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      schoolName,
      predictionProbability: probability,
    };
  }
}
