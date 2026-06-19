import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { PredictionService } from '../prediction/prediction.service';
import {
  CaseComparisonResult,
  PredictionHistoricalService,
} from '../prediction/prediction-historical.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  AnalysisActionPlan,
  AnalysisState,
  ApplicationAnalysisPredictionContext,
  ApplicationAnalysisResponseV2,
  ApplicationAnalysisSchoolResult,
  ApplicationAnalysisPortfolioSummary,
  FairnessDisclosure,
  RecourseGuidance,
  StrategyUncertainty,
} from '../ai/ai.types';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';
import {
  ANALYSIS_SCHOOL_SELECT,
  ApprovedPolicyEvidence,
  buildApplicantFacingSummary,
  buildDeterministicSchoolResult,
  buildEvidenceMap,
  buildFallbackActionPlan,
  buildPolicyCard,
  buildPortfolioSummary,
  buildProfileSummary,
  hasMinimumProfileEvidence,
  humanizeUnknownLabel,
  LoadedPrediction,
  LoadedProfile,
  LoadedSchoolListItem,
  normalizeRound,
  resolveAnalysisState,
  resolveDataQuality,
  selectFocusSchools,
} from './profile-application-analysis-v2.helpers';
import {
  buildPortfolioSystemPrompt,
  buildPortfolioUserPrompt,
  buildSchoolAnalystSystemPrompt,
  buildSchoolAnalystUserPrompt,
} from './profile-application-analysis-v2.prompts';

const ANALYSIS_CACHE_TTL_SECONDS = REDIS_TTL.ANALYSIS_CACHE;
const DEFAULT_ANALYSIS_VERSION = 'application-analysis-v2';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PREDICTION_CONTEXT_STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

// The per-school analyst LLM steps are independent, so run them with bounded
// concurrency instead of serially. Serially, MAX_FOCUS_SCHOOLS (5) steps × the
// per-step timeout + the portfolio step could reach ~180s and blow the 120s
// TimeoutMiddleware budget → 408 on prod (slow deepseek proxy hits each ceiling).
// K=4 covers the 5 focus schools in ~one wave while staying gentle on the proxy.
const SCHOOL_ANALYST_CONCURRENCY = 4;
// Tighter than the portfolio step (30s): a stuck school gives up to its
// deterministic floor sooner. deepseek p50 for a 1500-token completion is well
// under this; only true stalls hit it.
const SCHOOL_ANALYST_TIMEOUT_MS = 22_000;

/**
 * Map over `items` running `fn` with at most `limit` in flight at once,
 * preserving input order in the result. No external dependency; used to bound
 * concurrent LLM calls (avoid both serial-timeout pileup and unbounded fan-out
 * at the proxy).
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

interface GetAnalysisOptions {
  debug?: boolean;
  mode?: 'deterministic' | 'live';
  persistRun?: boolean;
}

interface NormalizedSchoolAnalysisResponse {
  assessment: {
    summary: string;
    whyThisIsHard: string[];
    compensatingStrengths: string[];
    topGaps: string[];
    nextActions: string[];
    historicalSignals: string[];
    hardStopRisks: string[];
  };
  recourse?: RecourseGuidance;
  uncertainty?: StrategyUncertainty;
  evidenceIds: string[];
  unknowns: string[];
  validationErrors: string[];
}

interface NormalizedPortfolioResponse {
  portfolioSummary: ApplicationAnalysisPortfolioSummary;
  actionPlan: AnalysisActionPlan;
  unknowns: string[];
  validationErrors: string[];
}

interface StepRecordInput {
  runId?: string;
  stepName: string;
  status: string;
  normalizedInput?: Prisma.InputJsonValue;
  normalizedOutput?: Prisma.InputJsonValue;
  model?: string;
  inputHash?: string;
  promptHash?: string;
  tokenUsage?: Prisma.InputJsonValue;
  latencyMs?: number;
  validationErrors?: Prisma.InputJsonValue;
  error?: string;
}

export interface AnalysisSnapshot {
  locale: string;
  analysisVersion: string;
  activePolicyVersionId?: string;
  profile: LoadedProfile | null;
  schoolListItems: LoadedSchoolListItem[];
  focusSchools: LoadedSchoolListItem[];
  predictions: LoadedPrediction[];
  approvedEvidence: ApprovedPolicyEvidence[];
  historyBySchool: Record<string, CaseComparisonResult | null>;
}

@Injectable()
export class ProfileApplicationAnalysisV2Service {
  private readonly logger = new Logger(
    ProfileApplicationAnalysisV2Service.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly predictionService: PredictionService,
    private readonly predictionHistoricalService: PredictionHistoricalService,
    private readonly llmService: LLMService,
    private readonly applicationAnalysisWorkflowService: ApplicationAnalysisWorkflowService,
  ) {}

  async getAnalysisForUser(
    userId: string,
    locale = 'zh',
    options: GetAnalysisOptions = {},
  ): Promise<ApplicationAnalysisResponseV2> {
    const cacheKey = await this.buildCacheKey(userId, locale, options.debug);
    if (!options.debug) {
      const cached =
        await this.redis.getJSON<ApplicationAnalysisResponseV2>(cacheKey);
      if (cached) {
        return this.enrichApplicantResponse(
          {
            ...cached,
            status: 'cached',
            meta: { ...cached.meta, debugEnabled: false },
          },
          locale,
        );
      }
    }

    const snapshot = await this.buildSnapshotForUser(userId, locale);
    const response = await this.generateFromSnapshot(snapshot, {
      debug: options.debug,
      mode: options.mode,
    });

    if (!options.debug && response.status !== 'degraded') {
      await this.redis.setJSON(cacheKey, response, ANALYSIS_CACHE_TTL_SECONDS);
    }

    return response;
  }

  async runSnapshot(
    snapshot: AnalysisSnapshot,
    options: GetAnalysisOptions = {},
  ): Promise<ApplicationAnalysisResponseV2> {
    return this.generateFromSnapshot(snapshot, options);
  }

  private enrichApplicantResponse(
    response: Omit<
      ApplicationAnalysisResponseV2,
      | 'overallVerdict'
      | 'schoolCards'
      | 'topReasons'
      | 'topRisks'
      | 'nextActions'
      | 'evidenceSummary'
      | 'confidenceSummary'
      | 'freshnessSummary'
    > &
      Partial<
        Pick<
          ApplicationAnalysisResponseV2,
          | 'overallVerdict'
          | 'schoolCards'
          | 'topReasons'
          | 'topRisks'
          | 'nextActions'
          | 'evidenceSummary'
          | 'confidenceSummary'
          | 'freshnessSummary'
        >
      >,
    locale: string,
  ): ApplicationAnalysisResponseV2 {
    const summary = buildApplicantFacingSummary({
      locale,
      status: response.status ?? 'fresh',
      generatedAt: response.meta.generatedAt,
      dataQuality: response.meta.dataQuality,
      state: response.meta.state,
      degradedReason: response.meta.degradedReason,
      portfolioSummary: response.portfolioSummary,
      schools: response.schools,
      actionPlan: response.actionPlan,
      unknowns: response.unknowns,
    });

    // Humanize the raw internal unknown codes (e.g. `testingPolicy`) at this single
    // serve boundary — it covers the fresh / cached / degraded paths — so the wire
    // contract carries readable, localized labels for EVERY consumer. Web and mobile
    // render `unknowns` and `schools[]/schoolCards[].unknowns` verbatim, so without
    // this the camelCase codes leak straight to users. The persisted snapshot keeps
    // raw codes; the prose builders (topRisks / evidenceSummary) humanize separately
    // from `policyCard.unknowns`, so this never double-processes them.
    const humanizedSchools = response.schools.map((school) => ({
      ...school,
      unknowns: school.unknowns.map((code) =>
        humanizeUnknownLabel(code, locale),
      ),
    }));

    return {
      ...response,
      ...summary,
      unknowns: response.unknowns.map((code) =>
        humanizeUnknownLabel(code, locale),
      ),
      schools: humanizedSchools,
      schoolCards: humanizedSchools,
    };
  }

  async listRuns(query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    status?: string;
    analysisVersion?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where: Prisma.ApplicationAnalysisRunWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.analysisVersion
        ? { analysisVersion: query.analysisVersion }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.applicationAnalysisRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.applicationAnalysisRun.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listReplayRuns(query: {
    page?: number;
    pageSize?: number;
    dataset?: string;
    status?: string;
    analysisVersion?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where: Prisma.ApplicationAnalysisReplayRunWhereInput = {
      ...(query.dataset ? { dataset: query.dataset } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.analysisVersion
        ? { analysisVersion: query.analysisVersion }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.applicationAnalysisReplayRun.findMany({
        where,
        include: { caseResults: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.applicationAnalysisReplayRun.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async replayRun(
    runId: string,
    actorId: string,
    options: { debug?: boolean } = {},
  ) {
    const sourceRun = await this.prisma.applicationAnalysisRun.findUnique({
      where: { id: runId },
    });
    if (!sourceRun?.inputSnapshot) {
      throw new Error('Application-analysis run snapshot not found.');
    }

    const snapshot = sourceRun.inputSnapshot as unknown as AnalysisSnapshot;
    const replayRun = await this.prisma.applicationAnalysisReplayRun.create({
      data: {
        analysisVersion: sourceRun.analysisVersion,
        dataset: 'single-run',
        status: 'RUNNING',
        createdBy: actorId,
        startedAt: new Date(),
      },
    });

    try {
      const response = await this.generateFromSnapshot(snapshot, {
        debug: true,
      });
      const metrics = this.evaluateReplayResponse(response);
      const failures = buildReplayFailures(metrics);

      await this.prisma.applicationAnalysisReplayCaseResult.create({
        data: {
          replayRunId: replayRun.id,
          runId: sourceRun.id,
          caseId: sourceRun.id,
          sourceType: 'stored_run',
          status: failures.length === 0 ? 'COMPLETED' : 'FAILED',
          traceId: response.meta.traceId,
          outputPayload: toJson(response),
          metrics: toJson(metrics),
          failures,
        },
      });

      const summary = {
        totalCases: 1,
        passedCases: failures.length === 0 ? 1 : 0,
        failedCases: failures.length > 0 ? 1 : 0,
      };

      await this.prisma.applicationAnalysisReplayRun.update({
        where: { id: replayRun.id },
        data: {
          status: failures.length === 0 ? 'COMPLETED' : 'FAILED',
          summary,
          metrics,
          failures,
          finishedAt: new Date(),
        },
      });

      return this.prisma.applicationAnalysisReplayRun.findUnique({
        where: { id: replayRun.id },
        include: { caseResults: true },
      });
    } catch (error) {
      const failures = [
        error instanceof Error ? error.message : 'Replay execution failed',
      ];

      await this.prisma.applicationAnalysisReplayRun.update({
        where: { id: replayRun.id },
        data: {
          status: 'FAILED',
          failures,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async generateFromSnapshot(
    snapshot: AnalysisSnapshot,
    options: GetAnalysisOptions,
  ): Promise<ApplicationAnalysisResponseV2> {
    const mode = options.mode ?? 'live';
    const persistRun = options.persistRun !== false;
    const traceId = randomUUID();
    const now = new Date().toISOString();
    const dataQuality = snapshot.profile
      ? resolveDataQuality(snapshot.profile, snapshot.schoolListItems.length)
      : 'insufficient';
    const state = snapshot.profile
      ? resolveAnalysisState(
          snapshot.profile,
          snapshot.schoolListItems,
          snapshot.focusSchools,
          snapshot.predictions,
          dataQuality,
        )
      : 'insufficientProfileData';
    const profileSummary = snapshot.profile
      ? buildProfileSummary(snapshot.profile, snapshot.locale)
      : buildEmptyProfileSummary();
    const predictionContext = this.buildPredictionContext(snapshot, now);

    const runId = persistRun
      ? (
          await this.prisma.applicationAnalysisRun.create({
            data: {
              traceId,
              userId: snapshot.profile?.userId ?? 'unknown',
              profileId: snapshot.profile?.id ?? 'missing-profile',
              locale: snapshot.locale,
              analysisVersion: snapshot.analysisVersion,
              status: 'RUNNING',
              state,
              dataQuality,
              debugEnabled: Boolean(options.debug),
              inputHash: hashObject(snapshot),
              inputSnapshot: toJson(snapshot),
              selectedSchoolIds: snapshot.focusSchools.map(
                (item) => item.schoolId,
              ),
              targetSchoolCount: snapshot.schoolListItems.length,
              focusSchoolCount: snapshot.focusSchools.length,
              schoolsWithPredictions: snapshot.predictions.length,
            },
          })
        ).id
      : undefined;

    const stepIds: string[] = [];
    const stepTimingsMs: Record<string, number> = {};
    const validationErrors: string[] = [];
    const promptHashes: Record<string, string> = {};
    // Track LLM health so a systemic failure (bad key, wrong model, provider
    // outage) surfaces as `degraded` instead of silently serving the
    // deterministic floor as a healthy `fresh` result. The catch blocks below
    // always push a deterministic card, so schoolResults.length is NOT a usable
    // failure signal — these counters are.
    let llmCallsAttempted = 0;
    let llmCallsFailed = 0;

    if (!snapshot.profile || !hasMinimumProfileEvidence(snapshot.profile)) {
      const response = this.buildInsufficientResponse({
        locale: snapshot.locale,
        runId,
        traceId,
        analysisVersion: snapshot.analysisVersion,
        generatedAt: now,
        state,
        dataQuality,
        profileSummary,
        degradedReason: 'insufficientProfileData',
        focusSchoolCount: snapshot.focusSchools.length,
        targetSchoolCount: snapshot.schoolListItems.length,
        schoolsWithPredictions: snapshot.predictions.length,
        predictionContext,
      });
      await this.finalizeRun(
        runId,
        response,
        'DEGRADED',
        state,
        'insufficientProfileData',
      );
      return response;
    }

    if (state === 'noPredictions') {
      const response = this.buildInsufficientResponse({
        locale: snapshot.locale,
        runId,
        traceId,
        analysisVersion: snapshot.analysisVersion,
        generatedAt: now,
        state,
        dataQuality,
        profileSummary,
        degradedReason: 'predictionUnavailable',
        focusSchoolCount: snapshot.focusSchools.length,
        targetSchoolCount: snapshot.schoolListItems.length,
        schoolsWithPredictions: snapshot.predictions.length,
        predictionContext,
      });
      await this.finalizeRun(
        runId,
        response,
        'DEGRADED',
        state,
        'predictionUnavailable',
      );
      return response;
    }

    const predictionMap = new Map(
      snapshot.predictions.map((prediction) => [
        prediction.schoolId,
        prediction,
      ]),
    );
    const evidenceMap = buildEvidenceMap(snapshot.approvedEvidence);

    const evidenceStart = Date.now();
    const evidenceOutput = {
      focusSchoolIds: snapshot.focusSchools.map((item) => item.schoolId),
      predictionCount: snapshot.predictions.length,
      evidenceCount: snapshot.approvedEvidence.length,
    };
    const evidenceStep = await this.recordStep({
      runId,
      stepName: 'evidence_collector',
      status: 'COMPLETED',
      normalizedInput: toJson({
        profileId: snapshot.profile.id,
        locale: snapshot.locale,
      }),
      normalizedOutput: toJson(evidenceOutput),
      inputHash: hashObject({
        profileId: snapshot.profile.id,
        locale: snapshot.locale,
      }),
      latencyMs: Date.now() - evidenceStart,
    });
    stepIds.push(evidenceStep.id);
    stepTimingsMs.evidence_collector = evidenceStep.latencyMs ?? 0;

    const policyStart = Date.now();
    const policyCards = snapshot.focusSchools.map((item) => {
      const built = buildPolicyCard(
        item,
        snapshot.profile as LoadedProfile,
        evidenceMap.get(item.schoolId),
      );
      return {
        schoolId: item.schoolId,
        schoolName: item.school.nameZh || item.school.name,
        item,
        policyCard: built.card,
      };
    });
    const policyStep = await this.recordStep({
      runId,
      stepName: 'policy_normalizer',
      status: 'COMPLETED',
      normalizedInput: toJson({
        focusSchoolIds: snapshot.focusSchools.map((item) => item.schoolId),
        evidenceCount: snapshot.approvedEvidence.length,
      }),
      normalizedOutput: toJson(
        policyCards.map((card) => ({
          schoolId: card.schoolId,
          evidenceIds: card.policyCard.evidenceIds,
          unknowns: card.policyCard.unknowns,
        })),
      ),
      inputHash: hashObject({
        schoolIds: snapshot.focusSchools.map((item) => item.schoolId),
        evidenceIds: snapshot.approvedEvidence.map((item) => item.id),
      }),
      latencyMs: Date.now() - policyStart,
    });
    stepIds.push(policyStep.id);
    stepTimingsMs.policy_normalizer = policyStep.latencyMs ?? 0;

    const schoolResults: ApplicationAnalysisSchoolResult[] = [];
    // Non-null here (guarded by the `!snapshot.profile` early-return above);
    // captured so the per-school closure keeps the narrowing the old in-scope
    // serial loop relied on (matches the existing `as LoadedProfile` usage).
    const analysisProfile = snapshot.profile;

    // Run the independent per-school analyst steps with bounded concurrency.
    // (Was a serial for-loop: 5 schools × 30s + the 30s portfolio step could sum
    // to ~180s and blow the 120s request budget → 408 on prod with the slow
    // deepseek proxy.) Order-preserving; each step still fails soft to its
    // deterministic floor on timeout/error.
    const analyzeSchool = async (
      policyEntry: (typeof policyCards)[number],
    ): Promise<{
      school: ApplicationAnalysisSchoolResult;
      attempted: number;
      failed: number;
      validationErrors: string[];
      stepId: string;
      stepKey: string;
      stepTimingMs: number;
      promptHashKey: string;
      promptHash: string;
    }> => {
      const deterministic = buildDeterministicSchoolResult(
        policyEntry.item,
        predictionMap.get(policyEntry.schoolId),
        snapshot.historyBySchool[policyEntry.schoolId] ?? null,
        analysisProfile,
        policyEntry.policyCard,
        snapshot.locale,
      );
      const llmStart = Date.now();
      const schoolPromptInput = {
        profileSummary,
        schoolId: policyEntry.schoolId,
        schoolName: policyEntry.schoolName,
        tier: deterministic.tier,
        round: deterministic.round,
        prediction: deterministic.prediction,
        policyCard: deterministic.policyCard,
        deterministicAssessment: deterministic.assessment,
        allowedEvidenceIds: deterministic.evidenceIds,
      };
      const schoolSystemPrompt = buildSchoolAnalystSystemPrompt(
        snapshot.locale,
      );
      const schoolUserPrompt = buildSchoolAnalystUserPrompt(
        schoolPromptInput,
        snapshot.locale,
      );
      const promptHash = hashString(
        `${schoolSystemPrompt}\n${schoolUserPrompt}`,
      );
      const promptHashKey = `school:${policyEntry.schoolId}`;
      const stepKey = `school_analyst:${policyEntry.schoolId}`;

      if (mode === 'deterministic') {
        const schoolStep = await this.recordStep({
          runId,
          stepName: stepKey,
          status: 'SKIPPED',
          normalizedInput: toJson(schoolPromptInput),
          normalizedOutput: toJson(deterministic),
          inputHash: hashObject(schoolPromptInput),
          promptHash,
          validationErrors: toJson([]),
        });
        return {
          school: deterministic,
          attempted: 0,
          failed: 0,
          validationErrors: [],
          stepId: schoolStep.id,
          stepKey,
          stepTimingMs: schoolStep.latencyMs ?? 0,
          promptHashKey,
          promptHash,
        };
      }

      try {
        const llmResponse = await this.llmService.call(
          schoolSystemPrompt,
          [
            {
              id: `school-${policyEntry.schoolId}`,
              role: 'user',
              content: schoolUserPrompt,
              timestamp: new Date(),
            },
          ],
          {
            model: DEFAULT_MODEL,
            temperature: 0.2,
            // Headroom for the richer, personalized narrative the strengthened
            // prompts now request — a truncated JSON would fail extraction and
            // silently fall back to the deterministic floor.
            maxTokens: 1500,
            userId: analysisProfile.userId,
            timeoutMs: SCHOOL_ANALYST_TIMEOUT_MS,
          },
        );
        const parsed = extractJsonFromLlm<Record<string, unknown>>(
          llmResponse.content,
        );
        const normalized = normalizeSchoolAnalysis(deterministic, parsed);
        const mergedSchool = {
          ...deterministic,
          assessment: normalized.assessment,
          recourse: normalized.recourse,
          uncertainty: normalized.uncertainty,
          evidenceIds:
            normalized.evidenceIds.length > 0
              ? normalized.evidenceIds
              : deterministic.evidenceIds,
          unknowns: dedupeStrings([
            ...deterministic.unknowns,
            ...normalized.unknowns,
          ]),
        };

        const schoolStep = await this.recordStep({
          runId,
          stepName: stepKey,
          status:
            normalized.validationErrors.length > 0
              ? 'COMPLETED_WITH_WARNINGS'
              : 'COMPLETED',
          model: DEFAULT_MODEL,
          normalizedInput: toJson(schoolPromptInput),
          normalizedOutput: toJson(mergedSchool),
          inputHash: hashObject(schoolPromptInput),
          promptHash,
          tokenUsage: normalizeUsage(llmResponse.usage),
          latencyMs: Date.now() - llmStart,
          validationErrors: toJson(normalized.validationErrors),
        });
        return {
          school: mergedSchool,
          attempted: 1,
          failed: 0,
          validationErrors: normalized.validationErrors,
          stepId: schoolStep.id,
          stepKey,
          stepTimingMs: schoolStep.latencyMs ?? 0,
          promptHashKey,
          promptHash,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'School analysis failed';
        const schoolStep = await this.recordStep({
          runId,
          stepName: stepKey,
          status: 'FAILED',
          model: DEFAULT_MODEL,
          normalizedInput: toJson(schoolPromptInput),
          normalizedOutput: toJson(deterministic),
          inputHash: hashObject(schoolPromptInput),
          promptHash,
          latencyMs: Date.now() - llmStart,
          error: message,
          validationErrors: toJson([message]),
        });
        return {
          school: deterministic,
          attempted: 1,
          failed: 1,
          validationErrors: [message],
          stepId: schoolStep.id,
          stepKey,
          stepTimingMs: schoolStep.latencyMs ?? 0,
          promptHashKey,
          promptHash,
        };
      }
    };

    const perSchoolResults = await mapWithConcurrency(
      policyCards,
      SCHOOL_ANALYST_CONCURRENCY,
      analyzeSchool,
    );
    for (const result of perSchoolResults) {
      schoolResults.push(result.school);
      llmCallsAttempted += result.attempted;
      llmCallsFailed += result.failed;
      validationErrors.push(...result.validationErrors);
      stepIds.push(result.stepId);
      stepTimingsMs[result.stepKey] = result.stepTimingMs;
      promptHashes[result.promptHashKey] = result.promptHash;
    }

    const fallbackPortfolio = buildPortfolioSummary(
      snapshot.locale,
      state,
      snapshot.schoolListItems,
      snapshot.focusSchools,
      predictionMap,
    );
    const fallbackActionPlan = buildFallbackActionPlan(
      snapshot.profile,
      state,
      snapshot.schoolListItems,
      schoolResults,
      snapshot.locale,
    );

    const portfolioStart = Date.now();
    const portfolioInput = {
      profileSummary,
      schools: schoolResults,
      fallbackPortfolioSummary: fallbackPortfolio,
      fallbackActionPlan,
    };
    const portfolioSystemPrompt = buildPortfolioSystemPrompt(snapshot.locale);
    const portfolioUserPrompt = buildPortfolioUserPrompt(
      portfolioInput,
      snapshot.locale,
    );
    const portfolioPromptHash = hashString(
      `${portfolioSystemPrompt}\n${portfolioUserPrompt}`,
    );
    promptHashes.portfolio_synthesizer = portfolioPromptHash;

    let normalizedPortfolio: NormalizedPortfolioResponse = {
      portfolioSummary: fallbackPortfolio,
      actionPlan: fallbackActionPlan,
      unknowns: [],
      validationErrors: [],
    };

    if (mode === 'deterministic') {
      const portfolioStep = await this.recordStep({
        runId,
        stepName: 'portfolio_synthesizer',
        status: 'SKIPPED',
        normalizedInput: toJson(portfolioInput),
        normalizedOutput: toJson({
          portfolioSummary: fallbackPortfolio,
          actionPlan: fallbackActionPlan,
          unknowns: [],
        }),
        inputHash: hashObject(portfolioInput),
        promptHash: portfolioPromptHash,
        validationErrors: toJson([]),
      });
      stepIds.push(portfolioStep.id);
      stepTimingsMs.portfolio_synthesizer = portfolioStep.latencyMs ?? 0;
    } else {
      llmCallsAttempted += 1;
      try {
        const llmResponse = await this.llmService.call(
          portfolioSystemPrompt,
          [
            {
              id: 'portfolio-synthesizer',
              role: 'user',
              content: portfolioUserPrompt,
              timestamp: new Date(),
            },
          ],
          {
            model: DEFAULT_MODEL,
            temperature: 0.2,
            // Headroom for the richer, personalized narrative the strengthened
            // prompts now request — a truncated JSON would fail extraction and
            // silently fall back to the deterministic floor.
            maxTokens: 1500,
            userId: snapshot.profile.userId,
            timeoutMs: 30000,
          },
        );
        const parsed = extractJsonFromLlm<Record<string, unknown>>(
          llmResponse.content,
        );
        normalizedPortfolio = normalizePortfolioSynthesis(
          fallbackPortfolio,
          fallbackActionPlan,
          parsed,
        );
        validationErrors.push(...normalizedPortfolio.validationErrors);
        const portfolioStep = await this.recordStep({
          runId,
          stepName: 'portfolio_synthesizer',
          status:
            normalizedPortfolio.validationErrors.length > 0
              ? 'COMPLETED_WITH_WARNINGS'
              : 'COMPLETED',
          model: DEFAULT_MODEL,
          normalizedInput: toJson(portfolioInput),
          normalizedOutput: toJson({
            portfolioSummary: normalizedPortfolio.portfolioSummary,
            actionPlan: normalizedPortfolio.actionPlan,
            unknowns: normalizedPortfolio.unknowns,
          }),
          inputHash: hashObject(portfolioInput),
          promptHash: portfolioPromptHash,
          tokenUsage: normalizeUsage(llmResponse.usage),
          latencyMs: Date.now() - portfolioStart,
          validationErrors: toJson(normalizedPortfolio.validationErrors),
        });
        stepIds.push(portfolioStep.id);
        stepTimingsMs.portfolio_synthesizer = portfolioStep.latencyMs ?? 0;
      } catch (error) {
        llmCallsFailed += 1;
        const message =
          error instanceof Error ? error.message : 'Portfolio synthesis failed';
        validationErrors.push(message);
        const portfolioStep = await this.recordStep({
          runId,
          stepName: 'portfolio_synthesizer',
          status: 'FAILED',
          model: DEFAULT_MODEL,
          normalizedInput: toJson(portfolioInput),
          normalizedOutput: toJson({
            portfolioSummary: fallbackPortfolio,
            actionPlan: fallbackActionPlan,
            unknowns: [],
          }),
          inputHash: hashObject(portfolioInput),
          promptHash: portfolioPromptHash,
          latencyMs: Date.now() - portfolioStart,
          error: message,
          validationErrors: toJson([message]),
        });
        stepIds.push(portfolioStep.id);
        stepTimingsMs.portfolio_synthesizer = portfolioStep.latencyMs ?? 0;
      }
    }

    if (runId) {
      await Promise.all(
        schoolResults.map((school) =>
          this.prisma.applicationAnalysisSchoolCard.create({
            data: {
              runId,
              schoolId: school.schoolId,
              schoolName: school.schoolName,
              stage: 'FINAL',
              tier: school.tier,
              round: school.round,
              evidenceIds: school.evidenceIds,
              unknowns: school.unknowns,
              policyCard: toJson(school.policyCard),
              analysisCard: toJson({
                assessment: school.assessment,
                recourse: school.recourse,
                uncertainty: school.uncertainty,
              }),
            },
          }),
        ),
      );
    }

    // Systemic LLM failure: every live LLM call (all school analysts + the
    // portfolio synthesizer) failed, so the entire narrative is the
    // deterministic floor with zero AI contribution. The catch blocks keep
    // schoolResults non-empty, so this would otherwise be reported as a healthy
    // `fresh` result — masking a bad key / wrong model / provider outage. Surface
    // it as `degraded` so it isn't cached, the UI can flag the simplified output,
    // and monitoring sees the DEGRADED run.
    const { isDegraded, degradedReason } = resolveAnalysisDegradation({
      llmCallsAttempted,
      llmCallsFailed,
      validationErrorCount: validationErrors.length,
      schoolResultCount: schoolResults.length,
    });

    const response = this.enrichApplicantResponse(
      {
        status: isDegraded ? 'degraded' : 'fresh',
        meta: {
          analysisVersion: snapshot.analysisVersion,
          state,
          dataQuality,
          targetSchoolCount: snapshot.schoolListItems.length,
          focusSchoolCount: snapshot.focusSchools.length,
          schoolsWithPredictions: snapshot.predictions.length,
          generatedAt: now,
          predictionContext,
          runId,
          traceId,
          debugEnabled: Boolean(options.debug),
          degradedReason,
        },
        profileSummary,
        portfolioSummary: normalizedPortfolio.portfolioSummary,
        schools: schoolResults,
        actionPlan: normalizedPortfolio.actionPlan,
        unknowns: dedupeStrings([
          ...normalizedPortfolio.unknowns,
          ...schoolResults.flatMap((school) => school.unknowns),
        ]),
        fairnessDisclosure: undefined as FairnessDisclosure | undefined,
        debug: options.debug
          ? {
              stepIds,
              stepTimingsMs,
              validationErrors,
              promptHashes,
            }
          : undefined,
      },
      snapshot.locale,
    );

    await this.finalizeRun(
      runId,
      response,
      response.status === 'degraded' ? 'DEGRADED' : 'COMPLETED',
      state,
      response.meta.degradedReason,
    );

    return response;
  }

  private buildPredictionContext(
    snapshot: AnalysisSnapshot,
    generatedAt: string,
  ): ApplicationAnalysisPredictionContext {
    const focusSchoolIds = snapshot.focusSchools.map((item) => item.schoolId);
    const predictedSchoolIds = new Set(
      snapshot.predictions.map((prediction) => prediction.schoolId),
    );
    const now = Date.parse(generatedAt);

    return {
      source: 'prediction-engine',
      generatedAt,
      // Gold-case fixture snapshots predate predictionContext and carry no
      // `id` on their predictions (only the live buildSnapshotForUser select
      // sets it). Drop nullish ids so this stays a real `string[]` of
      // PredictionResult IDs — otherwise the exported render fixture serializes
      // `undefined` to `null` and breaks the `string[]` contract (governance).
      predictionResultIds: snapshot.predictions
        .map((prediction) => prediction.id)
        .filter((id): id is string => typeof id === 'string'),
      missingSchoolIds: focusSchoolIds.filter(
        (schoolId) => !predictedSchoolIds.has(schoolId),
      ),
      staleSchoolIds: snapshot.predictions
        .filter(
          (prediction) =>
            now - prediction.updatedAt.getTime() >
            PREDICTION_CONTEXT_STALE_AFTER_MS,
        )
        .map((prediction) => prediction.schoolId),
    };
  }

  private async buildSnapshotForUser(
    userId: string,
    locale: string,
  ): Promise<AnalysisSnapshot> {
    const [profile, schoolListItems, activePolicy] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: { orderBy: { createdAt: 'desc' } },
          activities: {
            orderBy: { order: 'asc' },
            include: { activityTemplate: true },
          },
          awards: {
            orderBy: { order: 'asc' },
            include: { competition: true },
          },
          education: { include: { highSchool: true } },
          essays: true,
          semesterGpas: { orderBy: { order: 'asc' } },
        },
      }),
      this.prisma.schoolListItem.findMany({
        where: { userId },
        include: { school: { select: ANALYSIS_SCHOOL_SELECT } },
      }),
      this.applicationAnalysisWorkflowService.getActivePolicyVersion(),
    ]);

    const focusSchools = selectFocusSchools(schoolListItems);
    if (profile && focusSchools.length > 0) {
      const staleSchoolIds = await this.resolveStaleFocusSchoolIds(
        profile,
        focusSchools,
      );
      if (staleSchoolIds.length > 0) {
        try {
          await this.predictionService.predictForApplicationAnalysis(
            profile.id,
            staleSchoolIds,
            locale,
          );
        } catch (error) {
          this.logger.warn(
            `Prediction refresh skipped for user ${userId}: ${String(
              error instanceof Error ? error.message : error,
            )}`,
          );
        }
      }
    }

    const [predictions, approvedEvidence, historyResults] = await Promise.all([
      profile
        ? this.loadPredictions(
            profile.id,
            focusSchools.map((item) => item.schoolId),
          )
        : Promise.resolve([]),
      this.applicationAnalysisWorkflowService.listApprovedEvidenceBySchool(
        focusSchools.map((item) => item.schoolId),
      ),
      profile
        ? Promise.all(
            focusSchools.map(async (item) => ({
              schoolId: item.schoolId,
              comparison:
                await this.predictionHistoricalService.getCaseComparison(
                  item.schoolId,
                  profile.nationality ?? undefined,
                ),
            })),
          )
        : Promise.resolve([]),
    ]);

    return {
      locale,
      analysisVersion:
        activePolicy?.analysisVersion ?? DEFAULT_ANALYSIS_VERSION,
      activePolicyVersionId: activePolicy?.id,
      profile,
      schoolListItems,
      focusSchools,
      predictions,
      approvedEvidence,
      historyBySchool: Object.fromEntries(
        historyResults.map((entry) => [entry.schoolId, entry.comparison]),
      ),
    };
  }

  private async buildCacheKey(
    userId: string,
    locale: string,
    debug?: boolean,
  ): Promise<string> {
    const [profile, schoolList, activePolicy] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { updatedAt: true },
      }),
      this.prisma.schoolListItem.aggregate({
        where: { userId },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.applicationAnalysisWorkflowService.getActivePolicyVersion(),
    ]);

    return `ai:profile-analysis:v2:${userId}:${locale}:${debug ? 'debug' : 'default'}:${
      activePolicy?.analysisVersion ?? DEFAULT_ANALYSIS_VERSION
    }:${profile?.updatedAt.getTime() ?? 0}:${
      schoolList._max.updatedAt?.getTime() ?? 0
    }:${schoolList._count._all ?? 0}`;
  }

  private async resolveStaleFocusSchoolIds(
    profile: LoadedProfile,
    focusSchools: LoadedSchoolListItem[],
  ): Promise<string[]> {
    if (focusSchools.length === 0) return [];

    const existingPredictions = await this.loadPredictions(
      profile.id,
      focusSchools.map((item) => item.schoolId),
    );
    const predictionMap = new Map(
      existingPredictions.map((prediction) => [
        prediction.schoolId,
        prediction,
      ]),
    );

    return focusSchools
      .filter((item) => {
        const prediction = predictionMap.get(item.schoolId);
        if (!prediction) return true;
        if (prediction.updatedAt.getTime() < profile.updatedAt.getTime())
          return true;
        if (prediction.updatedAt.getTime() < item.updatedAt.getTime())
          return true;

        const requestedRound = normalizeRound(
          item.round ?? profile.applicationRound ?? undefined,
        );
        const predictionRound = normalizeRound(
          prediction.applicationRound ?? undefined,
        );
        return Boolean(requestedRound && requestedRound !== predictionRound);
      })
      .map((item) => item.schoolId);
  }

  private async loadPredictions(
    profileId: string,
    schoolIds: string[],
  ): Promise<LoadedPrediction[]> {
    if (schoolIds.length === 0) return [];

    return this.prisma.predictionResult.findMany({
      where: {
        profileId,
        schoolId: { in: schoolIds },
        authority: 'AUTHORITATIVE',
      },
      select: {
        id: true,
        schoolId: true,
        probability: true,
        probabilityLow: true,
        probabilityHigh: true,
        tier: true,
        confidence: true,
        factors: true,
        suggestions: true,
        confidenceReason: true,
        applicationRound: true,
        updatedAt: true,
      },
    });
  }

  // normalizeSchoolAnalysis / normalizePortfolioSynthesis are pure merge helpers
  // extracted to module scope (below, exported) so the LLM-surfaces-over-floor
  // contract is unit-testable without the full live pipeline.

  private evaluateReplayResponse(response: ApplicationAnalysisResponseV2) {
    const schools =
      response.schoolCards.length > 0 ? response.schoolCards : response.schools;
    const topReasons =
      response.topReasons.length > 0
        ? response.topReasons
        : response.portfolioSummary.keyReasons;
    const topRisks =
      response.topRisks.length > 0
        ? response.topRisks
        : response.portfolioSummary.riskBoundaries;
    const nextActions =
      response.nextActions.length > 0
        ? response.nextActions
        : response.actionPlan.now;
    const evidenceSummary = response.evidenceSummary ?? [];
    const factSupportPass =
      schools.every(
        (school) =>
          school.evidenceIds.length > 0 ||
          school.policyCard.sources.length === 0,
      ) && topReasons.length > 0;
    const policyCorrectnessRate =
      schools.length === 0
        ? 1
        : roundMetric(
            schools.filter((school) => {
              if (
                !school.round ||
                school.policyCard.roundContext === 'UNKNOWN'
              ) {
                return true;
              }
              return (
                school.policyCard.roundContext === normalizeRound(school.round)
              );
            }).length / schools.length,
          );
    const policyConsistencyPass = policyCorrectnessRate === 1;
    const probabilityConsistencyPass = schools.every((school) => {
      if (!school.prediction) return true;
      if (
        school.uncertainty?.probabilityLow != null &&
        school.uncertainty.probabilityLow > school.prediction.probability
      ) {
        return false;
      }
      if (
        school.uncertainty?.probabilityHigh != null &&
        school.uncertainty.probabilityHigh < school.prediction.probability
      ) {
        return false;
      }
      return true;
    });
    const fabricatedInsightCount = schools.filter(
      (school) =>
        school.assessment.summary.trim().length > 0 &&
        school.evidenceIds.length === 0 &&
        school.policyCard.sources.length === 0 &&
        !school.prediction,
    ).length;
    const schoolActionabilityMean =
      schools.length === 0
        ? 0
        : schools.reduce(
            (sum, school) =>
              sum + Math.min(5, school.assessment.nextActions.length || 1),
            0,
          ) / schools.length;
    const actionabilityMean =
      schools.length === 0
        ? roundMetric(Math.min(5, nextActions.length || 1))
        : roundMetric(
            (schoolActionabilityMean + Math.min(5, nextActions.length || 1)) /
              2,
          );
    const contractParityPass =
      Boolean(response.overallVerdict.trim()) &&
      response.schoolCards.length === response.schools.length &&
      Array.isArray(response.topReasons) &&
      Array.isArray(response.topRisks) &&
      Array.isArray(response.nextActions) &&
      topReasons.length > 0 &&
      nextActions.length > 0 &&
      evidenceSummary.length > 0 &&
      Boolean(response.confidenceSummary?.summary?.trim()) &&
      Boolean(response.freshnessSummary?.summary?.trim());
    const webRenderPass =
      contractParityPass &&
      topReasons.every((item) => item.length <= 220) &&
      topRisks.every((item) => item.length <= 220) &&
      nextActions.every((item) => item.length <= 220) &&
      evidenceSummary.every((item) => item.detail.length <= 240);
    const mobileRenderPass =
      contractParityPass &&
      topReasons.length <= 5 &&
      topRisks.length <= 5 &&
      nextActions.length <= 5 &&
      schools.every(
        (school) =>
          school.assessment.summary.length <= 220 &&
          school.assessment.nextActions.length <= 4,
      );
    const weakStateExpectationPass =
      (response.meta.state === 'ready' &&
        (schools.length > 0 || response.meta.focusSchoolCount === 0) &&
        nextActions.length > 0) ||
      (response.meta.state === 'noTargetSchools' &&
        response.meta.targetSchoolCount === 0 &&
        nextActions.length > 0) ||
      (response.meta.state === 'noPredictions' &&
        response.meta.focusSchoolCount > 0 &&
        nextActions.length > 0) ||
      (response.meta.state === 'insufficientProfileData' &&
        response.unknowns.includes('insufficientProfileData') &&
        nextActions.length > 0) ||
      response.meta.state === 'analysisError';
    const weakStateCorrectnessRate = weakStateExpectationPass ? 1 : 0;
    const journeyChecks = [
      contractParityPass,
      weakStateExpectationPass,
      nextActions.length > 0,
      response.meta.state !== 'ready' ||
        schools.length > 0 ||
        response.meta.focusSchoolCount === 0,
      response.meta.state !== 'noTargetSchools' ||
        response.meta.targetSchoolCount === 0,
      response.meta.state !== 'noPredictions' ||
        response.meta.focusSchoolCount > 0,
    ];
    const journeyPassRate = roundMetric(
      journeyChecks.filter(Boolean).length / journeyChecks.length,
    );
    const unknownPolicyRate =
      schools.length === 0
        ? 0
        : roundMetric(
            schools.reduce(
              (sum, school) =>
                sum +
                ['testingPolicy', 'intlAidPolicy', 'roundContext'].filter(
                  (key) => school.policyCard.unknowns.includes(key),
                ).length,
              0,
            ) /
              (schools.length * 3),
          );

    return {
      factSupportPass,
      policyCorrectnessRate,
      weakStateCorrectnessRate,
      policyConsistencyPass,
      probabilityConsistencyPass,
      fabricatedInsightCount,
      fabricatedInsightPass: fabricatedInsightCount === 0,
      actionabilityMean,
      contractParityPass,
      webRenderPass,
      mobileRenderPass,
      journeyPassRate,
      unknownPolicyRate,
    };
  }

  private buildInsufficientResponse(input: {
    locale: string;
    runId?: string;
    traceId: string;
    analysisVersion: string;
    generatedAt: string;
    state: AnalysisState;
    dataQuality: ApplicationAnalysisResponseV2['meta']['dataQuality'];
    profileSummary: ApplicationAnalysisResponseV2['profileSummary'];
    degradedReason: string;
    focusSchoolCount: number;
    targetSchoolCount: number;
    schoolsWithPredictions: number;
    predictionContext: ApplicationAnalysisPredictionContext;
  }): ApplicationAnalysisResponseV2 {
    const verdict =
      input.state === 'noTargetSchools'
        ? 'Add target schools before expecting school-level strategy.'
        : input.state === 'noPredictions'
          ? 'Refresh prediction facts before relying on school-level advice.'
          : 'Complete the core profile before relying on school-level analysis.';
    const immediateAction =
      input.state === 'noTargetSchools'
        ? 'Add target schools before requesting structured school guidance.'
        : input.state === 'noPredictions'
          ? 'Refresh prediction facts for the current schools before reviewing school-level guidance.'
          : 'Complete the core profile and target-school list first.';
    const unknownKey =
      input.state === 'noPredictions'
        ? 'predictionUnavailable'
        : 'insufficientProfileData';

    return this.enrichApplicantResponse(
      {
        status: 'degraded',
        meta: {
          analysisVersion: input.analysisVersion,
          state: input.state,
          dataQuality: input.dataQuality,
          targetSchoolCount: input.targetSchoolCount,
          focusSchoolCount: input.focusSchoolCount,
          schoolsWithPredictions: input.schoolsWithPredictions,
          generatedAt: input.generatedAt,
          predictionContext: input.predictionContext,
          runId: input.runId,
          traceId: input.traceId,
          degradedReason: input.degradedReason,
        },
        profileSummary: input.profileSummary,
        portfolioSummary: {
          verdict,
          balance: 'insufficient',
          keyReasons: [],
          riskBoundaries: [],
        },
        overallVerdict: '',
        schools: [],
        schoolCards: [],
        topReasons: [],
        topRisks: [],
        actionPlan: {
          now: [immediateAction],
          next90Days: [],
          beforeSubmission: [],
        },
        nextActions: [],
        unknowns: [unknownKey],
        evidenceSummary: [],
        confidenceSummary: {
          level: 'low',
          summary: '',
          signals: [],
        },
        freshnessSummary: {
          status: 'degraded',
          summary: '',
          generatedAt: input.generatedAt,
        },
      },
      input.locale,
    );
  }

  private async recordStep(input: StepRecordInput) {
    if (!input.runId) {
      return {
        id: `virtual:${input.stepName}:${randomUUID()}`,
        latencyMs: input.latencyMs ?? null,
      };
    }
    return this.prisma.applicationAnalysisStepRun.create({
      data: {
        runId: input.runId,
        stepName: input.stepName,
        status: input.status,
        model: input.model,
        inputHash: input.inputHash,
        promptHash: input.promptHash,
        normalizedInput: input.normalizedInput,
        normalizedOutput: input.normalizedOutput,
        tokenUsage: input.tokenUsage,
        latencyMs: input.latencyMs,
        validationErrors: input.validationErrors,
        error: input.error,
        startedAt:
          input.latencyMs != null
            ? new Date(Date.now() - input.latencyMs)
            : undefined,
        finishedAt: new Date(),
      },
    });
  }

  private async finalizeRun(
    runId: string | undefined,
    response: ApplicationAnalysisResponseV2,
    status: string,
    state: AnalysisState,
    degradedReason?: string,
  ) {
    if (!runId) {
      return;
    }
    await this.prisma.applicationAnalysisRun.update({
      where: { id: runId },
      data: {
        status,
        state,
        degradedReason,
        responsePayload: toJson(response),
        unknowns: toJson(response.unknowns),
        metrics: toJson(this.evaluateReplayResponse(response)),
      },
    });
  }
}

function ensureString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Merge the LLM school-analyst output (`parsed`) over the deterministic floor.
 * LLM-first by contract: `summary` uses the LLM's when present (`?? deterministic`)
 * and every list is `mergeStringLists(LLM, deterministic)` (LLM leads, floor only
 * backfills when sparse). Pure — exported so the surfaces-over-floor contract is
 * unit-testable without the live LLM pipeline.
 */
export function normalizeSchoolAnalysis(
  deterministic: ApplicationAnalysisSchoolResult,
  parsed: Record<string, unknown>,
): NormalizedSchoolAnalysisResponse {
  const { evidenceIds, validationErrors } = filterAllowedEvidenceIds(
    deterministic.evidenceIds,
    ensureStringArray(parsed.evidenceIds),
  );

  return {
    assessment: {
      summary: ensureString(parsed.summary) ?? deterministic.assessment.summary,
      whyThisIsHard: mergeStringLists(
        ensureStringArray(parsed.whyThisIsHard),
        deterministic.assessment.whyThisIsHard,
      ),
      compensatingStrengths: mergeStringLists(
        ensureStringArray(parsed.compensatingStrengths),
        deterministic.assessment.compensatingStrengths,
      ),
      topGaps: mergeStringLists(
        ensureStringArray(parsed.topGaps),
        deterministic.assessment.topGaps,
      ),
      nextActions: mergeStringLists(
        ensureStringArray(parsed.nextActions),
        deterministic.assessment.nextActions,
      ),
      historicalSignals: mergeStringLists(
        ensureStringArray(parsed.historicalSignals),
        deterministic.assessment.historicalSignals,
      ),
      hardStopRisks: mergeStringLists(
        ensureStringArray(parsed.hardStopRisks),
        deterministic.assessment.hardStopRisks,
      ),
    },
    recourse: normalizeRecourse(parsed.recourse),
    uncertainty: normalizeUncertainty(
      parsed.uncertainty,
      deterministic.prediction,
    ),
    evidenceIds,
    unknowns: mergeStringLists(
      ensureStringArray(parsed.unknowns),
      deterministic.unknowns,
    ),
    validationErrors,
  };
}

/**
 * Merge the LLM portfolio-synthesizer output over the deterministic fallback.
 * Same LLM-first contract as normalizeSchoolAnalysis (`verdict`/`balance` use the
 * LLM when valid; lists merge LLM-first). Pure + exported for the same reason.
 */
export function normalizePortfolioSynthesis(
  fallbackSummary: ApplicationAnalysisPortfolioSummary,
  fallbackActionPlan: AnalysisActionPlan,
  parsed: Record<string, unknown>,
): NormalizedPortfolioResponse {
  const { balance: normalizedBalance, validationErrors } =
    normalizeBalanceValue(
      ensureString(parsed.balance),
      fallbackSummary.balance,
    );

  return {
    portfolioSummary: {
      verdict: ensureString(parsed.verdict) ?? fallbackSummary.verdict,
      balance: normalizedBalance,
      keyReasons: mergeStringLists(
        ensureStringArray(parsed.keyReasons),
        fallbackSummary.keyReasons,
      ),
      riskBoundaries: mergeStringLists(
        ensureStringArray(parsed.riskBoundaries),
        fallbackSummary.riskBoundaries,
      ),
    },
    actionPlan: {
      now: mergeStringLists(
        ensureStringArray(readRecordArray(parsed.actionPlan, 'now')),
        fallbackActionPlan.now,
      ),
      next90Days: mergeStringLists(
        ensureStringArray(readRecordArray(parsed.actionPlan, 'next90Days')),
        fallbackActionPlan.next90Days,
      ),
      beforeSubmission: mergeStringLists(
        ensureStringArray(
          readRecordArray(parsed.actionPlan, 'beforeSubmission'),
        ),
        fallbackActionPlan.beforeSubmission,
      ),
    },
    unknowns: ensureStringArray(parsed.unknowns),
    validationErrors,
  };
}

/**
 * Merge the LLM's narrative (primary) with the deterministic builder output
 * (fallback). The deterministic builders are a SAFETY FLOOR, not a co-author:
 * once the LLM has produced enough distinct items, padding the list with generic
 * deterministic template lines ("the focus schools now have usable predictions")
 * only dilutes a good response. So we serve the LLM's items as-is once it cleared
 * a minimum bar, and backfill from the deterministic fallback only when the LLM
 * came back sparse or empty (timeout, partial parse, conservative answer) —
 * preserving the floor without drowning the personalized output.
 */
export function mergeStringLists(
  primary: string[],
  fallback: string[],
  minItems = 2,
): string[] {
  const llm = dedupeStrings(primary);
  if (llm.length >= minItems) return llm.slice(0, 5);
  return dedupeStrings([...llm, ...fallback]).slice(0, 5);
}

/**
 * Decide whether an analysis run should be reported as `degraded` and why.
 *
 * Two failure modes collapse the analysis to the deterministic floor with no
 * real AI contribution, and BOTH must surface (instead of a healthy-looking
 * `fresh`) so the result isn't cached, the UI can flag the simplified output,
 * and monitoring sees the DEGRADED run:
 *  - schoolAnalysisFailed: validation errors AND not a single school card was
 *    produced — there is nothing to analyze.
 *  - llmUnavailable: every live LLM call attempted (school analysts + the
 *    portfolio synthesizer) failed — a systemic bad key / wrong model / provider
 *    outage. The per-school catch always pushes a deterministic card, so the
 *    school-result count is NOT a usable signal for this; the attempt/failure
 *    counts are.
 *
 * Deterministic-mode replays never attempt an LLM call (llmCallsAttempted === 0),
 * so they can never trip `llmUnavailable` — the gold/governance path is unaffected.
 */
export function resolveAnalysisDegradation(input: {
  llmCallsAttempted: number;
  llmCallsFailed: number;
  validationErrorCount: number;
  schoolResultCount: number;
}): { isDegraded: boolean; degradedReason?: string } {
  const noSchoolResults =
    input.validationErrorCount > 0 && input.schoolResultCount === 0;
  if (noSchoolResults) {
    return { isDegraded: true, degradedReason: 'schoolAnalysisFailed' };
  }
  const llmSystemicallyDown =
    input.llmCallsAttempted > 0 &&
    input.llmCallsFailed === input.llmCallsAttempted;
  if (llmSystemicallyDown) {
    return { isDegraded: true, degradedReason: 'llmUnavailable' };
  }
  return { isDegraded: false };
}

function normalizeRecourse(value: unknown): RecourseGuidance | undefined {
  if (!isRecord(value)) return undefined;
  const recommendedChanges = Array.isArray(value.recommendedChanges)
    ? value.recommendedChanges
        .map((entry) => (isRecord(entry) ? entry : null))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => ({
          action: ensureString(entry.action) ?? '',
          rationale: ensureString(entry.rationale) ?? '',
          effort:
            (ensureString(entry.effort) as 'low' | 'medium' | 'high') ??
            'medium',
          timeHorizon:
            (ensureString(entry.timeHorizon) as
              | 'now'
              | 'next90Days'
              | 'beforeSubmission') ?? 'next90Days',
          blockedBy: ensureStringArray(entry.blockedBy),
        }))
        .filter((entry) => entry.action && entry.rationale)
    : [];

  const goal = ensureString(value.goal);
  const whyNotGuaranteed = ensureString(value.whyNotGuaranteed);
  if (!goal || !whyNotGuaranteed) return undefined;

  return {
    goal,
    recommendedChanges,
    estimatedDirection:
      (ensureString(value.estimatedDirection) as
        | 'upside'
        | 'stabilize'
        | 'mixed') ?? 'mixed',
    constraints: ensureStringArray(value.constraints),
    whyNotGuaranteed,
  };
}

/**
 * Anti-hallucination guard: the LLM may only cite evidence IDs that the
 * deterministic layer actually produced. Any ID the model invents is stripped,
 * and the mismatch is recorded so the response can be flagged/degraded — the
 * model can never fabricate a source binding. Returns the filtered IDs plus
 * validation errors (`school-analysis-evidence-id-not-allowed` when the model
 * cited IDs outside the allow-list; `school-analysis-missing-evidence-binding`
 * when filtering removed every ID despite the deterministic layer having some).
 */
export function filterAllowedEvidenceIds(
  allowedEvidenceIds: string[],
  rawEvidenceIds: string[],
): { evidenceIds: string[]; validationErrors: string[] } {
  const allowed = new Set(allowedEvidenceIds);
  const evidenceIds = rawEvidenceIds.filter((item) => allowed.has(item));
  const validationErrors: string[] = [];
  if (
    rawEvidenceIds.length > 0 &&
    evidenceIds.length !== rawEvidenceIds.length
  ) {
    validationErrors.push('school-analysis-evidence-id-not-allowed');
  }
  if (evidenceIds.length === 0 && allowedEvidenceIds.length > 0) {
    validationErrors.push('school-analysis-missing-evidence-binding');
  }
  return { evidenceIds, validationErrors };
}

const VALID_PORTFOLIO_BALANCES: readonly ApplicationAnalysisPortfolioSummary['balance'][] =
  ['balanced', 'reachHeavy', 'safetyHeavy', 'undermatch', 'insufficient'];

/**
 * Anti-hallucination guard: the LLM-supplied portfolio balance must be one of
 * the known enum values. An invented value is rejected (falls back to the
 * deterministic balance) and recorded as `portfolio-balance-invalid` — the
 * model cannot smuggle a made-up list-shape verdict into the response.
 */
export function normalizeBalanceValue(
  raw: string | undefined,
  fallback: ApplicationAnalysisPortfolioSummary['balance'],
): {
  balance: ApplicationAnalysisPortfolioSummary['balance'];
  validationErrors: string[];
} {
  const balance =
    raw && VALID_PORTFOLIO_BALANCES.includes(raw as never)
      ? (raw as ApplicationAnalysisPortfolioSummary['balance'])
      : fallback;
  const validationErrors: string[] = [];
  if (raw && balance !== raw) {
    validationErrors.push('portfolio-balance-invalid');
  }
  return { balance, validationErrors };
}

export function normalizeUncertainty(
  value: unknown,
  prediction?: { probabilityLow?: number; probabilityHigh?: number },
): StrategyUncertainty | undefined {
  if (!isRecord(value)) return undefined;
  const intervalLabel = ensureString(value.intervalLabel);
  if (!intervalLabel) return undefined;
  // GROUNDED numbers: the numeric interval is sourced from the prediction engine
  // (the single probability authority), NOT from the LLM. The school-analyst prompt
  // no longer emits probabilityLow/High; even if a stale/rogue LLM response still
  // includes them, they are ignored here. The LLM supplies only the qualitative
  // intervalLabel + reasons. (Previously these numbers were the LLM's own — a
  // fabricated second probability interval that could contradict the prediction's,
  // violating the "prediction is the only probability source" rule.)
  return {
    probabilityLow:
      typeof prediction?.probabilityLow === 'number'
        ? prediction.probabilityLow
        : undefined,
    probabilityHigh:
      typeof prediction?.probabilityHigh === 'number'
        ? prediction.probabilityHigh
        : undefined,
    intervalLabel: intervalLabel as 'tight' | 'balanced' | 'wide',
    reasons: ensureStringArray(value.reasons),
  };
}

function normalizeUsage(
  usage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        model: string;
        estimatedCost?: number;
      }
    | undefined,
): Prisma.InputJsonValue | undefined {
  if (!usage) return undefined;
  return usage;
}

function buildReplayFailures(metrics: Record<string, number | boolean>) {
  const failures: string[] = [];
  if (metrics.factSupportPass !== true) failures.push('Fact support failed.');
  if (metrics.policyConsistencyPass !== true)
    failures.push('Policy consistency failed.');
  if (metrics.probabilityConsistencyPass !== true)
    failures.push('Probability consistency failed.');
  if (Number(metrics.fabricatedInsightCount ?? 0) > 0)
    failures.push('Fabricated insights detected.');
  if (Number(metrics.actionabilityMean ?? 0) < 4)
    failures.push('Actionability below target.');
  if (metrics.contractParityPass !== true)
    failures.push('Applicant contract parity failed.');
  if (metrics.webRenderPass !== true)
    failures.push('Web render safety failed.');
  if (metrics.mobileRenderPass !== true)
    failures.push('Mobile render safety failed.');
  if (Number(metrics.journeyPassRate ?? 0) < 1)
    failures.push('Applicant journey completeness failed.');
  return failures;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildEmptyProfileSummary(): ApplicationAnalysisResponseV2['profileSummary'] {
  return {
    applicantType: 'unknown',
    intendedMajors: [],
    testStrategy: 'unknown',
    contextFlags: [],
    constraints: [],
  };
}

function readRecordArray(value: unknown, key: string): unknown {
  if (!isRecord(value)) return [];
  return value[key];
}

function hashObject(value: unknown): string {
  return hashString(JSON.stringify(value));
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
