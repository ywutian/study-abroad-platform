import * as fs from 'fs/promises';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  BenchmarkProfile,
  BenchmarkProfileInput,
  CompetitorBenchmarkReport,
  CompetitorBenchmarkSummary,
  CompetitorPredictionMatchStatus,
  CompetitorPredictionRow,
  CompetitorRunDetail,
  CompetitorRunSummary,
} from '@study-abroad/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { fireAndForget } from '../../../common/utils/async.util';
import { AdapterRegistryService } from './adapter-registry.service';
import {
  getBenchmarkSecretsDir,
  getSessionStoragePath,
  isPlaywrightStorageState,
} from './benchmark.config';
import { BrowserRunnerService } from './browser-runner.service';
import { PredictionBenchmarkEvaluatorService } from './prediction-benchmark-evaluator.service';
import { SchoolMatcherService } from './school-matcher.service';

const FINAL_PREDICTION_STATUSES = new Set([
  'COMPLETED',
  'TIER_ONLY',
  'UNMATCHED',
  'AMBIGUOUS',
  'FAILED',
  'SESSION_ERROR',
]);

type StartRunInput = {
  profileId: string;
  sourceKey: string;
  limit?: number;
  headed?: boolean;
};

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly browserRunner: BrowserRunnerService,
    private readonly evaluator: PredictionBenchmarkEvaluatorService,
    private readonly schoolMatcher: SchoolMatcherService,
  ) {}

  private ensureBenchmarkEnabled(): void {
    if (
      String(process.env.BENCHMARK_ENABLED ?? 'false').toLowerCase() !== 'true'
    ) {
      throw new BadRequestException(
        'External competitor benchmark is disabled. Set BENCHMARK_ENABLED=true to enable it.',
      );
    }
  }

  private normalizeTierLabel(
    label?: string | null,
    probability?: number | null,
  ): string | null {
    const normalized = label?.trim().toLowerCase();
    if (!normalized && probability == null) return null;
    if (normalized) {
      if (/(reach|highly selective|very low)/i.test(normalized)) return 'reach';
      if (/(match|target)/i.test(normalized)) return 'match';
      if (/(safety|likely)/i.test(normalized)) return 'safety';
    }
    if (probability == null) return null;
    if (probability >= 0.6) return 'safety';
    if (probability >= 0.3) return 'match';
    return 'reach';
  }

  private buildRunNote(input: StartRunInput): string | null {
    const parts = [
      input.limit ? `limit=${input.limit}` : null,
      input.headed === false ? 'headed=false' : 'headed=true',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private isSessionFailureMessage(message?: string | null): boolean {
    if (!message) return false;
    return /storageState|session|sign[- ]?in|login|auth/i.test(message);
  }

  private toProfileDto(profile: {
    id: string;
    label: string;
    cohortTag: string | null;
    profileJson: unknown;
    createdAt: Date;
  }) {
    return {
      id: profile.id,
      label: profile.label,
      cohortTag: profile.cohortTag,
      profileJson: this.evaluator.normalizeProfileInput(
        profile.profileJson as BenchmarkProfileInput,
      ),
      createdAt: profile.createdAt.toISOString(),
    } satisfies BenchmarkProfile;
  }

  private toRunSummary(run: {
    id: string;
    status: string;
    profileId: string;
    sourceId: string;
    startedAt: Date;
    finishedAt: Date | null;
    successCount: number;
    errorCount: number;
    note: string | null;
    profile: { label: string };
    source: { key: string; label: string };
    _count?: { predictions: number };
  }): CompetitorRunSummary {
    return {
      id: run.id,
      profileId: run.profileId,
      profileLabel: run.profile.label,
      sourceId: run.sourceId,
      sourceKey: run.source.key,
      sourceLabel: run.source.label,
      status: run.status as CompetitorRunSummary['status'],
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      successCount: run.successCount,
      errorCount: run.errorCount,
      processedCount: run._count?.predictions ?? 0,
      note: run.note,
    };
  }

  async listProfiles(cohortTag?: string): Promise<BenchmarkProfile[]> {
    this.ensureBenchmarkEnabled();
    const profiles = await this.prisma.benchmarkProfile.findMany({
      where: cohortTag ? { cohortTag } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return profiles.map((profile) => this.toProfileDto(profile));
  }

  async createProfile(input: {
    label?: string;
    cohortTag?: string;
    profileJson?: BenchmarkProfileInput;
  }): Promise<BenchmarkProfile> {
    this.ensureBenchmarkEnabled();
    if (!input.label?.trim()) {
      throw new BadRequestException('Profile label is required.');
    }
    if (!input.profileJson || typeof input.profileJson !== 'object') {
      throw new BadRequestException('profileJson must be a valid JSON object.');
    }

    const normalized = this.evaluator.normalizeProfileInput(input.profileJson);
    const created = await this.prisma.benchmarkProfile.create({
      data: {
        label: input.label.trim(),
        cohortTag: input.cohortTag?.trim() || null,
        profileJson: normalized as any,
      },
    });
    return this.toProfileDto(created);
  }

  async listSources() {
    this.ensureBenchmarkEnabled();
    return this.adapterRegistry.listSources();
  }

  async saveSession(
    sourceKey: string,
    storageStateText: string,
  ): Promise<{ success: true }> {
    this.ensureBenchmarkEnabled();
    if (!storageStateText?.trim()) {
      throw new BadRequestException('storageState.json is empty.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(storageStateText);
    } catch {
      throw new BadRequestException('storageState.json is not valid JSON.');
    }
    if (!isPlaywrightStorageState(parsed)) {
      throw new BadRequestException(
        'Invalid Playwright storageState.json. Expected cookies/origins arrays.',
      );
    }

    await this.adapterRegistry.getSourceOrThrow(sourceKey);
    await fs.mkdir(getBenchmarkSecretsDir(), { recursive: true });
    await fs.writeFile(
      getSessionStoragePath(sourceKey),
      JSON.stringify(parsed, null, 2),
      'utf-8',
    );
    return { success: true as const };
  }

  async startRun(input: StartRunInput): Promise<CompetitorRunSummary> {
    this.ensureBenchmarkEnabled();
    const profile = await this.prisma.benchmarkProfile.findUnique({
      where: { id: input.profileId },
    });
    if (!profile) {
      throw new NotFoundException(
        `Benchmark profile ${input.profileId} not found`,
      );
    }

    const source = await this.adapterRegistry.getSourceOrThrow(input.sourceKey);
    const adapter = this.adapterRegistry.getAdapterOrThrow(input.sourceKey);
    if (!source.enabled) {
      throw new BadRequestException(
        `Competitor source ${input.sourceKey} is disabled.`,
      );
    }

    const existingRun = await this.prisma.competitorRun.findFirst({
      where: {
        profileId: profile.id,
        sourceId: source.id,
        status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
      },
      include: {
        profile: true,
        source: true,
        _count: { select: { predictions: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (existingRun) {
      if (existingRun.status === 'FAILED') {
        const resumedRun = await this.prisma.competitorRun.update({
          where: { id: existingRun.id },
          data: {
            status: 'PENDING',
            finishedAt: null,
            note: this.buildRunNote(input),
          },
          include: {
            profile: true,
            source: true,
            _count: { select: { predictions: true } },
          },
        });

        fireAndForget(
          this.executeRun(resumedRun.id, input),
          this.logger,
          `Failed to resume competitor benchmark run ${resumedRun.id}`,
        );

        return this.toRunSummary(resumedRun);
      }

      return this.toRunSummary(existingRun);
    }

    if (
      adapter.requiresSession !== false &&
      !this.adapterRegistry.hasSession(source.key)
    ) {
      throw new BadRequestException(
        `No session found for ${source.label}. Upload a fresh storageState.json first.`,
      );
    }

    const run = await this.prisma.competitorRun.create({
      data: {
        profileId: profile.id,
        sourceId: source.id,
        status: 'PENDING',
        note: this.buildRunNote(input),
      },
      include: {
        profile: true,
        source: true,
        _count: { select: { predictions: true } },
      },
    });

    fireAndForget(
      this.executeRun(run.id, input),
      this.logger,
      `Failed to execute competitor benchmark run ${run.id}`,
    );

    return this.toRunSummary(run);
  }

  async listRuns(): Promise<CompetitorRunSummary[]> {
    this.ensureBenchmarkEnabled();
    const runs = await this.prisma.competitorRun.findMany({
      include: {
        profile: true,
        source: true,
        _count: { select: { predictions: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return runs.map((run) => this.toRunSummary(run));
  }

  async getRunDetail(runId: string): Promise<CompetitorRunDetail> {
    this.ensureBenchmarkEnabled();
    const run = await this.prisma.competitorRun.findUnique({
      where: { id: runId },
      include: {
        profile: true,
        source: true,
        _count: { select: { predictions: true } },
        predictions: {
          orderBy: { fetchedAt: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException(`Competitor run ${runId} not found`);
    }

    return {
      ...this.toRunSummary(run),
      predictions: run.predictions.map((prediction) => ({
        id: prediction.id,
        schoolKey: prediction.schoolKey,
        rawSchoolName: prediction.rawSchoolName,
        schoolId: prediction.schoolId,
        matchType: prediction.matchType,
        probability:
          prediction.probability != null
            ? Number(prediction.probability)
            : null,
        tierLabel: prediction.tierLabel,
        status:
          prediction.status as CompetitorRunDetail['predictions'][number]['status'],
        errorMsg: prediction.errorMsg,
        fetchedAt: prediction.fetchedAt.toISOString(),
      })),
    };
  }

  private async updateRunCounters(runId: string): Promise<void> {
    const grouped = await this.prisma.competitorPrediction.groupBy({
      by: ['status'],
      where: { runId },
      _count: true,
    });

    let successCount = 0;
    let errorCount = 0;
    for (const row of grouped) {
      if (row.status === 'FAILED' || row.status === 'SESSION_ERROR') {
        errorCount += row._count;
      } else {
        successCount += row._count;
      }
    }

    await this.prisma.competitorRun.update({
      where: { id: runId },
      data: { successCount, errorCount },
    });
  }

  private async recordPrediction(
    runId: string,
    input: {
      profileId: string;
      sourceId: string;
      schoolKey: string;
      rawSchoolName: string;
      schoolId?: string | null;
      matchType?: string | null;
      probability?: number | null;
      tierLabel?: string | null;
      rawPayload: unknown;
      status: string;
      errorMsg?: string | null;
    },
  ): Promise<void> {
    await this.prisma.competitorPrediction.upsert({
      where: { runId_schoolKey: { runId, schoolKey: input.schoolKey } },
      update: {
        rawSchoolName: input.rawSchoolName,
        schoolId: input.schoolId ?? null,
        matchType: input.matchType ?? null,
        probability: input.probability ?? null,
        tierLabel: input.tierLabel ?? null,
        rawPayload: input.rawPayload as any,
        status: input.status as any,
        errorMsg: input.errorMsg ?? null,
        fetchedAt: new Date(),
      },
      create: {
        runId,
        profileId: input.profileId,
        sourceId: input.sourceId,
        schoolKey: input.schoolKey,
        rawSchoolName: input.rawSchoolName,
        schoolId: input.schoolId ?? null,
        matchType: input.matchType ?? null,
        probability: input.probability ?? null,
        tierLabel: input.tierLabel ?? null,
        rawPayload: input.rawPayload as any,
        status: input.status as any,
        errorMsg: input.errorMsg ?? null,
      },
    });
  }

  private async executeRun(runId: string, input: StartRunInput): Promise<void> {
    const run = await this.prisma.competitorRun.findUnique({
      where: { id: runId },
      include: {
        profile: true,
        source: true,
      },
    });
    if (!run) return;

    const adapter = this.adapterRegistry.getAdapterOrThrow(run.source.key);
    const profileInput = this.evaluator.normalizeProfileInput(
      run.profile.profileJson as BenchmarkProfileInput,
    );
    const schoolIndex = await this.schoolMatcher.loadSchoolIndex();

    await this.prisma.competitorRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING',
        finishedAt: null,
      },
    });

    try {
      await this.browserRunner.withPage(
        {
          adapterKey: adapter.key,
          baseUrl: adapter.baseUrl,
          headed: input.headed ?? true,
          requiresSession: adapter.requiresSession,
          storageStatePath:
            adapter.requiresSession === false
              ? undefined
              : getSessionStoragePath(run.source.key),
        },
        async (page) => {
          await adapter.applyProfile(page, profileInput);
          let seen = 0;

          for await (const school of adapter.iterateSchools(page)) {
            if (input.limit && seen >= input.limit) break;
            seen += 1;

            const existing = await this.prisma.competitorPrediction.findUnique({
              where: {
                runId_schoolKey: { runId: run.id, schoolKey: school.schoolKey },
              },
              select: { status: true },
            });
            if (existing && FINAL_PREDICTION_STATUSES.has(existing.status)) {
              continue;
            }

            try {
              const extracted = await adapter.fetchPrediction(page, school);
              const matched = this.schoolMatcher.matchSchool(
                { schoolName: school.rawName },
                schoolIndex,
              );

              if (matched.kind === 'ok') {
                await this.recordPrediction(run.id, {
                  profileId: run.profileId,
                  sourceId: run.sourceId,
                  schoolKey: school.schoolKey,
                  rawSchoolName: school.rawName,
                  schoolId: matched.school.id,
                  matchType: matched.matchType,
                  probability: extracted.probability ?? null,
                  tierLabel: extracted.tierLabel ?? null,
                  rawPayload: extracted.rawPayload,
                  status:
                    extracted.probability != null ? 'COMPLETED' : 'TIER_ONLY',
                });
              } else if (matched.kind === 'ambiguous') {
                await this.recordPrediction(run.id, {
                  profileId: run.profileId,
                  sourceId: run.sourceId,
                  schoolKey: school.schoolKey,
                  rawSchoolName: school.rawName,
                  probability: extracted.probability ?? null,
                  tierLabel: extracted.tierLabel ?? null,
                  rawPayload: {
                    extracted: extracted.rawPayload,
                    candidates: matched.candidates,
                  },
                  status: 'AMBIGUOUS',
                });
              } else {
                await this.recordPrediction(run.id, {
                  profileId: run.profileId,
                  sourceId: run.sourceId,
                  schoolKey: school.schoolKey,
                  rawSchoolName: school.rawName,
                  probability: extracted.probability ?? null,
                  tierLabel: extracted.tierLabel ?? null,
                  rawPayload: {
                    extracted: extracted.rawPayload,
                    suggestedSchools: this.schoolMatcher.suggestSchools(
                      school.rawName,
                      schoolIndex,
                    ),
                  },
                  status: 'UNMATCHED',
                });
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              await this.recordPrediction(run.id, {
                profileId: run.profileId,
                sourceId: run.sourceId,
                schoolKey: school.schoolKey,
                rawSchoolName: school.rawName,
                rawPayload: {},
                status: this.isSessionFailureMessage(errorMessage)
                  ? 'SESSION_ERROR'
                  : 'FAILED',
                errorMsg: errorMessage,
              });
            }
          }
        },
      );

      await this.updateRunCounters(run.id);
      await this.prisma.competitorRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.updateRunCounters(run.id).catch(() => undefined);
      await this.prisma.competitorRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          note:
            error instanceof Error
              ? error.message
              : 'Competitor benchmark run failed.',
        },
      });
    }
  }

  async buildReport(runId: string): Promise<CompetitorBenchmarkReport> {
    this.ensureBenchmarkEnabled();
    const run = await this.prisma.competitorRun.findUnique({
      where: { id: runId },
      include: {
        profile: true,
        source: true,
        predictions: {
          include: {
            school: {
              select: { id: true, name: true, nameZh: true },
            },
          },
          orderBy: { rawSchoolName: 'asc' },
        },
      },
    });
    if (!run) {
      throw new NotFoundException(`Competitor run ${runId} not found`);
    }

    const profileInput = this.evaluator.normalizeProfileInput(
      run.profile.profileJson as BenchmarkProfileInput,
    );
    const evaluationCache = new Map<
      string,
      Awaited<ReturnType<typeof this.evaluator.evaluateSchool>>
    >();

    const rows: CompetitorPredictionRow[] = [];
    let matchedCount = 0;
    let matchedProbabilityCount = 0;
    let tierOnlyCount = 0;
    let unmatchedCount = 0;
    let ambiguousCount = 0;
    let adapterErrorCount = 0;
    let sessionErrorCount = 0;
    let coverageGapCount = 0;
    let totalAbsDelta = 0;
    let totalDelta = 0;
    let comparableTierCount = 0;
    let tierAgreeCount = 0;

    for (const prediction of run.predictions) {
      let oursProbability: number | null = null;
      let oursTier: string | null = null;

      if (prediction.schoolId) {
        const cached =
          evaluationCache.get(prediction.schoolId) ??
          (await this.evaluator.evaluateSchool(
            profileInput,
            prediction.schoolId,
            profileInput.locale ?? 'en',
          ));
        evaluationCache.set(prediction.schoolId, cached);
        oursProbability = cached.probability;
        oursTier = cached.tier;
      }

      const theirsProbability =
        prediction.probability != null ? Number(prediction.probability) : null;
      const theirsTier = this.normalizeTierLabel(
        prediction.tierLabel,
        theirsProbability,
      );

      let matchStatus: CompetitorPredictionMatchStatus;
      switch (prediction.status) {
        case 'COMPLETED':
          matchStatus = 'matched';
          matchedCount += 1;
          break;
        case 'TIER_ONLY':
          matchStatus = 'matched-tier-only';
          matchedCount += 1;
          tierOnlyCount += 1;
          break;
        case 'UNMATCHED':
          matchStatus = 'unmatched';
          unmatchedCount += 1;
          coverageGapCount += 1;
          break;
        case 'AMBIGUOUS':
          matchStatus = 'ambiguous';
          ambiguousCount += 1;
          coverageGapCount += 1;
          break;
        case 'SESSION_ERROR':
          matchStatus = 'session-error';
          sessionErrorCount += 1;
          break;
        default:
          matchStatus = 'adapter-error';
          adapterErrorCount += 1;
          break;
      }

      let delta: number | null = null;
      if (oursProbability != null && theirsProbability != null) {
        delta = oursProbability - theirsProbability;
        matchedProbabilityCount += 1;
        totalAbsDelta += Math.abs(delta);
        totalDelta += delta;
      }

      let tierAgree: boolean | null = null;
      if (oursTier && theirsTier) {
        comparableTierCount += 1;
        tierAgree = oursTier === theirsTier;
        if (tierAgree) tierAgreeCount += 1;
      }

      rows.push({
        schoolKey: prediction.schoolKey,
        rawSchoolName: prediction.rawSchoolName,
        schoolId: prediction.schoolId,
        school: prediction.school
          ? {
              id: prediction.school.id,
              name: prediction.school.name,
              nameZh: prediction.school.nameZh,
            }
          : null,
        oursProbability,
        theirsProbability,
        delta,
        oursTier,
        theirsTier,
        tierAgree,
        matchStatus,
        externalSource: run.source.label,
        note:
          prediction.status === 'TIER_ONLY'
            ? 'No explicit competitor percentage was available; row excluded from MAE.'
            : prediction.errorMsg,
      });
    }

    if (
      sessionErrorCount === 0 &&
      run.status === 'FAILED' &&
      this.isSessionFailureMessage(run.note)
    ) {
      sessionErrorCount = 1;
    }

    const summary: CompetitorBenchmarkSummary = {
      totalSchools: rows.length,
      matchedCount,
      matchedProbabilityCount,
      tierOnlyCount,
      unmatchedCount,
      ambiguousCount,
      adapterErrorCount,
      sessionErrorCount,
      coverageGapCount,
      mae:
        matchedProbabilityCount > 0
          ? totalAbsDelta / matchedProbabilityCount
          : null,
      meanDelta:
        matchedProbabilityCount > 0
          ? totalDelta / matchedProbabilityCount
          : null,
      tierAgreementRate:
        comparableTierCount > 0 ? tierAgreeCount / comparableTierCount : null,
    };

    return {
      runId: run.id,
      profileId: run.profileId,
      sourceKey: run.source.key,
      sourceLabel: run.source.label,
      externalSource: run.source.label,
      generatedAt: new Date().toISOString(),
      status: run.status as CompetitorBenchmarkReport['status'],
      summary,
      rows,
    };
  }
}
