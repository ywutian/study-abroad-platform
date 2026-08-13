import { execSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient, type Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type {
  ApplicationAnalysisResponseV2,
  ApplicationAnalysisSchoolResult,
} from '../src/modules/ai/ai.types';
import type { SchoolTestingPolicy } from '@study-abroad/shared';
import {
  AnalysisSnapshot,
  ProfileApplicationAnalysisV2Service,
} from '../src/modules/profile/profile-application-analysis-v2.service';
import type {
  GoldCase,
  GoldReplayCaseResult,
  GoldReplayFailure,
} from '../gold-cases/schema';
import { LLMService } from '../src/modules/ai-agent/core/llm.service';
import { OpenAIProvider } from '../src/modules/ai-agent/providers/openai.provider';

const GOLD_CASES_DIR = path.resolve(__dirname, '../gold-cases/cases');
const GOLD_REPORTS_DIR = path.resolve(__dirname, '../gold-cases/reports');

type ReplayMode = 'deterministic' | 'live';

interface ParsedArgs {
  caseId?: string;
  tag?: string;
  locale?: 'en' | 'zh';
  mode: ReplayMode;
  limit?: number;
  persistRun: boolean;
}

interface CaseStats {
  policyChecks: number;
  policyMatches: number;
  stateChecks: number;
  stateMatches: number;
  fabricatedInsightCount: number;
  unknownPolicyCount: number;
  schoolCount: number;
  contractPass: boolean;
  actionabilityScore: number;
  journeyScore: number;
}

interface ReplayAggregate {
  totalCases: number;
  passedCases: number;
  policyCorrectnessRate: number;
  weakStateCorrectnessRate: number;
  fabricatedInsightCount: number;
  actionabilityMean: number;
  contractParityPass: boolean;
  webRenderPass: boolean | null;
  mobileRenderPass: boolean | null;
  journeyPassRate: number | null;
  unknownPolicyRate: number;
  goldPassRate: number;
}

function ensureEnvDefaults() {
  process.env.NODE_ENV ??= 'test';
  process.env.JWT_SECRET ??= 'governance-replay-jwt-secret';
  process.env.JWT_REFRESH_SECRET ??= 'governance-replay-refresh-secret';
  process.env.JWT_EXPIRES_IN ??= '15m';
  process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
}

function parseArgs(argv: string[]): ParsedArgs {
  const readFlag = (name: string) => {
    const inline = argv.find((value) => value.startsWith(`--${name}=`));
    if (inline) {
      return inline.slice(name.length + 3);
    }
    const index = argv.indexOf(`--${name}`);
    if (index >= 0) {
      return argv[index + 1];
    }
    return undefined;
  };

  const mode = readFlag('mode');
  const limit = readFlag('limit');
  const persistRun = readFlag('persist-run');
  return {
    caseId: readFlag('case'),
    tag: readFlag('tag'),
    locale: readFlag('locale') as 'en' | 'zh' | undefined,
    mode: mode === 'live' ? 'live' : 'deterministic',
    limit:
      typeof limit === 'string' && Number.isFinite(Number(limit))
        ? Math.max(1, Math.floor(Number(limit)))
        : undefined,
    persistRun: persistRun === 'true' || persistRun === '1',
  };
}

async function loadGoldCases(filters: ParsedArgs): Promise<GoldCase[]> {
  const files = (await readdir(GOLD_CASES_DIR))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const cases = await Promise.all(
    files.map(async (file) => {
      const contents = await readFile(path.join(GOLD_CASES_DIR, file), 'utf8');
      return JSON.parse(contents) as GoldCase;
    }),
  );

  return cases
    .filter((goldCase) => {
      if (filters.caseId && goldCase.id !== filters.caseId) return false;
      if (filters.tag && !goldCase.tags.includes(filters.tag)) return false;
      if (filters.locale && goldCase.inputConfig.locale !== filters.locale) {
        return false;
      }
      return true;
    })
    .slice(0, filters.limit ?? Number.MAX_SAFE_INTEGER);
}

function reviveDates<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((entry) => reviveDates(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, reviveDates(entry)]),
    ) as T;
  }
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  ) {
    return new Date(value) as T;
  }
  return value as T;
}

function lower(value: string) {
  return value.toLowerCase();
}

function schoolIdentity(input: {
  schoolId?: string | null;
  schoolName: string;
}) {
  return input.schoolId?.trim() || input.schoolName.trim();
}

function containsKeyword(haystack: string, keyword: string) {
  const normalizedKeyword = lower(keyword).trim();
  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9]+$/i.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
  }

  return haystack.includes(normalizedKeyword);
}

function getActualSchool(
  response: ApplicationAnalysisResponseV2,
  expectedSchool: GoldCase['expected']['schoolCards'][number],
) {
  return response.schoolCards.find(
    (school) =>
      school.schoolId === expectedSchool.schoolId ||
      school.schoolName === expectedSchool.schoolName,
  );
}

function getTestingPolicy(
  school: ApplicationAnalysisSchoolResult,
): SchoolTestingPolicy {
  return school.policyCard?.testingPolicy ?? 'UNKNOWN';
}

function collectSearchableText(
  response: ApplicationAnalysisResponseV2,
  school?: ApplicationAnalysisSchoolResult,
) {
  return [
    response.overallVerdict,
    ...response.topReasons,
    ...response.topRisks,
    ...response.nextActions,
    school?.assessment.summary,
    ...(school?.assessment.nextActions ?? []),
    ...(school?.assessment.topGaps ?? []),
    ...(school?.assessment.hardStopRisks ?? []),
  ]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join('\n')
    .toLowerCase();
}

function checkContract(
  response: ApplicationAnalysisResponseV2,
): GoldReplayFailure[] {
  const failures: GoldReplayFailure[] = [];
  if (!response.overallVerdict?.trim()) {
    failures.push({
      dimension: 'contract',
      expected: 'overallVerdict',
      actual: response.overallVerdict,
      severity: 'block',
      message: 'overallVerdict must be present.',
    });
  }
  if (
    !Array.isArray(response.schoolCards) ||
    !Array.isArray(response.schools)
  ) {
    failures.push({
      dimension: 'contract',
      expected: 'schoolCards[] and schools[]',
      actual: {
        schoolCards: typeof response.schoolCards,
        schools: typeof response.schools,
      },
      severity: 'block',
      message: 'Structured school card arrays are missing.',
    });
  } else if (response.schoolCards.length !== response.schools.length) {
    failures.push({
      dimension: 'contract',
      expected: response.schools.length,
      actual: response.schoolCards.length,
      severity: 'block',
      message: 'schoolCards must mirror the school analysis array.',
    });
  }
  if (
    !Array.isArray(response.nextActions) ||
    !Array.isArray(response.evidenceSummary)
  ) {
    failures.push({
      dimension: 'contract',
      expected: 'nextActions[] and evidenceSummary[]',
      actual: {
        nextActions: typeof response.nextActions,
        evidenceSummary: typeof response.evidenceSummary,
      },
      severity: 'block',
      message: 'Applicant-facing contract fields are incomplete.',
    });
  }
  if (
    !response.confidenceSummary?.level ||
    !response.freshnessSummary?.generatedAt
  ) {
    failures.push({
      dimension: 'contract',
      expected: 'confidenceSummary + freshnessSummary',
      actual: {
        confidenceSummary: response.confidenceSummary,
        freshnessSummary: response.freshnessSummary,
      },
      severity: 'block',
      message: 'Confidence or freshness summary is missing.',
    });
  }
  return failures;
}

function compareCase(
  goldCase: GoldCase,
  response: ApplicationAnalysisResponseV2,
): GoldReplayCaseResult & { stats: CaseStats } {
  const failures: GoldReplayFailure[] = [];
  const contractFailures = checkContract(response);
  failures.push(...contractFailures);

  let policyChecks = 0;
  let policyMatches = 0;
  const stateChecks = 1;
  let stateMatches = 0;
  let fabricatedInsightCount = 0;
  let unknownPolicyCount = 0;
  const schoolCount = response.schoolCards.length;

  if (response.meta.state === goldCase.expected.state) {
    stateMatches += 1;
  } else {
    failures.push({
      dimension: 'state',
      expected: goldCase.expected.state,
      actual: response.meta.state,
      severity: 'block',
      message: 'Analysis state does not match the gold expectation.',
    });
  }

  if (goldCase.expected.portfolioBalance) {
    if (
      response.portfolioSummary.balance !== goldCase.expected.portfolioBalance
    ) {
      failures.push({
        dimension: 'state',
        expected: goldCase.expected.portfolioBalance,
        actual: response.portfolioSummary.balance,
        severity: 'block',
        message: 'Portfolio balance does not match the gold expectation.',
      });
    }
  }

  const expectedSchoolKeys = new Set(
    goldCase.expected.schoolCards.map((school) => schoolIdentity(school)),
  );

  for (const expectedSchool of goldCase.expected.schoolCards) {
    const actualSchool = getActualSchool(response, expectedSchool);
    if (!actualSchool) {
      fabricatedInsightCount += 1;
      failures.push({
        dimension: 'school_presence',
        expected: expectedSchool.schoolName,
        actual: null,
        severity: 'block',
        message: `Expected school ${expectedSchool.schoolName} is missing from the analysis output.`,
      });
      continue;
    }

    if (actualSchool.tier !== expectedSchool.tier) {
      failures.push({
        dimension: 'tier',
        expected: expectedSchool.tier,
        actual: actualSchool.tier,
        severity: 'block',
        message: `School tier mismatch for ${expectedSchool.schoolName}.`,
      });
    }

    policyChecks += 1;
    const actualTestingPolicy = getTestingPolicy(actualSchool);
    if (actualTestingPolicy === expectedSchool.testingPolicy) {
      policyMatches += 1;
    } else {
      failures.push({
        dimension: 'testingPolicy',
        expected: expectedSchool.testingPolicy,
        actual: actualTestingPolicy,
        severity: 'block',
        message: `Testing policy mismatch for ${expectedSchool.schoolName}.`,
      });
    }

    if (actualTestingPolicy === 'UNKNOWN') {
      unknownPolicyCount += 1;
    }

    if (expectedSchool.probabilityRange) {
      const probability = actualSchool.prediction?.probability;
      const [minimum, maximum] = expectedSchool.probabilityRange;
      if (
        typeof probability !== 'number' ||
        probability < minimum ||
        probability > maximum
      ) {
        failures.push({
          dimension: 'probability',
          expected: expectedSchool.probabilityRange,
          actual: probability ?? null,
          severity: 'warn',
          message: `Probability is outside the expected range for ${expectedSchool.schoolName}.`,
        });
      }
    }

    const searchable = collectSearchableText(response, actualSchool);
    for (const keyword of expectedSchool.forbidden?.invalidActionKeywords ??
      []) {
      if (containsKeyword(searchable, keyword)) {
        fabricatedInsightCount += 1;
        failures.push({
          dimension: 'forbiddenKeyword',
          expected: `not contains ${keyword}`,
          actual: keyword,
          severity: 'block',
          message: `Forbidden keyword "${keyword}" appeared for ${expectedSchool.schoolName}.`,
        });
      }
    }
  }

  for (const actualSchool of response.schoolCards) {
    const key = schoolIdentity(actualSchool);
    if (!expectedSchoolKeys.has(key)) {
      fabricatedInsightCount += 1;
      failures.push({
        dimension: 'school_presence',
        expected: 'no unexpected schools',
        actual: actualSchool.schoolName,
        severity: 'block',
        message: `Unexpected school ${actualSchool.schoolName} appeared in the analysis output.`,
      });
    }
    if (getTestingPolicy(actualSchool) === 'UNKNOWN') {
      unknownPolicyCount += 1;
    }
  }

  if (
    goldCase.expected.schoolCards.length === 0 &&
    response.schoolCards.length > 0
  ) {
    fabricatedInsightCount += response.schoolCards.length;
  }

  if (goldCase.expected.meta?.confidence) {
    if (
      response.confidenceSummary.level !== goldCase.expected.meta.confidence
    ) {
      failures.push({
        dimension: 'contract',
        expected: goldCase.expected.meta.confidence,
        actual: response.confidenceSummary.level,
        severity: 'warn',
        message: 'Confidence label differs from the gold expectation.',
      });
    }
  }

  const requiredActionCount = goldCase.expected.meta?.minActionCount ?? 0;
  const actionCount = response.nextActions.length;
  const actionabilityScore =
    requiredActionCount > 0
      ? Math.min(actionCount / requiredActionCount, 1)
      : actionCount > 0
        ? 1
        : 0;

  if (requiredActionCount > 0 && actionCount < requiredActionCount) {
    failures.push({
      dimension: 'actionability',
      expected: requiredActionCount,
      actual: actionCount,
      severity: 'block',
      message:
        'The applicant-facing next actions are below the required minimum.',
    });
  }

  const passed = !failures.some((failure) => failure.severity === 'block');
  const stats: CaseStats = {
    policyChecks,
    policyMatches,
    stateChecks,
    stateMatches,
    fabricatedInsightCount,
    unknownPolicyCount,
    schoolCount,
    contractPass: contractFailures.length === 0,
    actionabilityScore,
    journeyScore: passed ? 1 : 0,
  };

  return {
    caseId: goldCase.id,
    passed,
    failures,
    durationMs: 0,
    journeyScore: stats.journeyScore,
    actionabilityScore,
    stats,
  };
}

function buildAggregate(
  caseResults: Array<GoldReplayCaseResult & { stats: CaseStats }>,
): ReplayAggregate {
  const totals = caseResults.reduce(
    (acc, result) => {
      acc.passedCases += result.passed ? 1 : 0;
      acc.policyChecks += result.stats.policyChecks;
      acc.policyMatches += result.stats.policyMatches;
      acc.stateChecks += result.stats.stateChecks;
      acc.stateMatches += result.stats.stateMatches;
      acc.fabricatedInsightCount += result.stats.fabricatedInsightCount;
      acc.unknownPolicyCount += result.stats.unknownPolicyCount;
      acc.schoolCount += result.stats.schoolCount;
      acc.actionabilityTotal += result.actionabilityScore;
      acc.contractPasses += result.stats.contractPass ? 1 : 0;
      acc.journeyTotal += result.journeyScore;
      return acc;
    },
    {
      passedCases: 0,
      policyChecks: 0,
      policyMatches: 0,
      stateChecks: 0,
      stateMatches: 0,
      fabricatedInsightCount: 0,
      unknownPolicyCount: 0,
      schoolCount: 0,
      actionabilityTotal: 0,
      contractPasses: 0,
      journeyTotal: 0,
    },
  );

  const totalCases = caseResults.length;
  const contractParityPass = totals.contractPasses === totalCases;
  return {
    totalCases,
    passedCases: totals.passedCases,
    policyCorrectnessRate:
      totals.policyChecks > 0 ? totals.policyMatches / totals.policyChecks : 1,
    weakStateCorrectnessRate:
      totals.stateChecks > 0 ? totals.stateMatches / totals.stateChecks : 1,
    fabricatedInsightCount: totals.fabricatedInsightCount,
    actionabilityMean:
      totalCases > 0 ? totals.actionabilityTotal / totalCases : 0,
    contractParityPass,
    webRenderPass: null,
    mobileRenderPass: null,
    journeyPassRate: null,
    unknownPolicyRate:
      totals.schoolCount > 0
        ? totals.unknownPolicyCount / totals.schoolCount
        : 0,
    goldPassRate: totalCases > 0 ? totals.passedCases / totalCases : 1,
  };
}

function roundMetric(value: number) {
  return Math.round(value * 10000) / 10000;
}

function roundOptionalMetric(value: number | null) {
  return typeof value === 'number' ? roundMetric(value) : null;
}

function buildTagCounts(cases: GoldCase[]) {
  return cases.reduce<Record<string, number>>((acc, goldCase) => {
    for (const tag of goldCase.tags) {
      acc[tag] = (acc[tag] ?? 0) + 1;
    }
    return acc;
  }, {});
}

function getCommitSha() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildMarkdownReport(input: {
  aggregate: ReplayAggregate;
  cases: GoldCase[];
  caseResults: Array<GoldReplayCaseResult & { stats: CaseStats }>;
  dataset: string;
  mode: ReplayMode;
  analysisVersion: string;
  commitSha: string;
}) {
  const lines = [
    '# Application Analysis Gold Replay',
    '',
    `- Dataset: \`${input.dataset}\``,
    `- Mode: \`${input.mode}\``,
    `- Analysis version: \`${input.analysisVersion}\``,
    `- Commit: \`${input.commitSha}\``,
    `- Total cases: \`${input.aggregate.totalCases}\``,
    `- Pass rate: \`${roundMetric(input.aggregate.goldPassRate)}\``,
    '',
    '## Metrics',
    '',
    `- policyCorrectnessRate: \`${roundMetric(input.aggregate.policyCorrectnessRate)}\``,
    `- weakStateCorrectnessRate: \`${roundMetric(input.aggregate.weakStateCorrectnessRate)}\``,
    `- fabricatedInsightCount: \`${input.aggregate.fabricatedInsightCount}\``,
    `- actionabilityMean: \`${roundMetric(input.aggregate.actionabilityMean)}\``,
    `- contractParityPass: \`${input.aggregate.contractParityPass}\``,
    `- webRenderPass: \`${input.aggregate.webRenderPass}\``,
    `- mobileRenderPass: \`${input.aggregate.mobileRenderPass}\``,
    `- journeyPassRate: \`${roundOptionalMetric(input.aggregate.journeyPassRate)}\``,
    `- unknownPolicyRate: \`${roundMetric(input.aggregate.unknownPolicyRate)}\``,
    '',
    '## Cases',
    '',
  ];

  for (const result of input.caseResults) {
    const goldCase = input.cases.find((item) => item.id === result.caseId);
    lines.push(`### ${result.caseId} ${result.passed ? 'PASS' : 'FAIL'}`);
    if (goldCase) {
      lines.push(`- ${goldCase.description}`);
    }
    lines.push(`- durationMs: \`${result.durationMs}\``);
    lines.push(`- failures: \`${result.failures.length}\``);
    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        lines.push(
          `  - [${failure.severity}] ${failure.dimension}: ${failure.message}`,
        );
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureEnvDefaults();
  const args = parseArgs(process.argv.slice(2));
  const goldCases = await loadGoldCases(args);
  if (goldCases.length === 0) {
    throw new Error('No gold cases matched the provided filters.');
  }

  const analysisVersion = [
    ...new Set(
      goldCases.map(
        (item) =>
          item.analysisSnapshot.analysisVersion ??
          item.analysisSnapshot['analysisVersion'],
      ),
    ),
  ];
  if (analysisVersion.length !== 1 || typeof analysisVersion[0] !== 'string') {
    throw new Error(
      'Gold replay expects a single analysisVersion across the selected cases.',
    );
  }

  const prisma = new PrismaClient();
  const configService = new ConfigService(process.env);
  const llmService = new LLMService(
    configService,
    new OpenAIProvider(configService),
  );
  const analysisService = new ProfileApplicationAnalysisV2Service(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    llmService,
    {} as never,
  );

  const dataset =
    args.mode === 'live' ? 'gold:live:nightly:v1' : 'gold:deterministic:v1';
  const commitSha = getCommitSha();
  const createdAt = new Date();
  const reportStem = `gold-replay-${args.mode}-${createdAt
    .toISOString()
    .replace(/[:.]/g, '-')}`;

  const replayRun = await prisma.applicationAnalysisReplayRun.create({
    data: {
      analysisVersion: analysisVersion[0],
      dataset,
      status: 'RUNNING',
      createdBy: 'gold-replay-script',
      startedAt: createdAt,
      summary: toJson({
        totalCases: goldCases.length,
        caseIds: goldCases.map((item) => item.id),
        tagCounts: buildTagCounts(goldCases),
        dataset,
        mode: args.mode,
        commitSha,
        limit: args.limit ?? null,
        selectedTag: args.tag ?? null,
        persistRun: args.persistRun,
        renderParityMode: {
          web: 'pending',
          mobile: 'pending',
        },
      }),
    },
  });

  try {
    const caseResults: Array<GoldReplayCaseResult & { stats: CaseStats }> = [];

    for (const goldCase of goldCases) {
      const startedAt = Date.now();
      try {
        const snapshot = reviveDates<AnalysisSnapshot>(
          goldCase.analysisSnapshot,
        );
        const response = await analysisService.runSnapshot(snapshot, {
          debug: true,
          mode: args.mode,
          persistRun: args.persistRun,
        });
        const result = compareCase(goldCase, response);
        result.durationMs = Date.now() - startedAt;
        caseResults.push(result);

        await prisma.applicationAnalysisReplayCaseResult.create({
          data: {
            replayRunId: replayRun.id,
            runId: response.meta.runId ?? null,
            caseId: goldCase.id,
            sourceType: goldCase.profileSnapshotRef
              ? 'FIXTURE_REF'
              : 'INLINE_SNAPSHOT',
            status: result.passed ? 'PASSED' : 'FAILED',
            traceId: response.meta.traceId,
            outputPayload: toJson(response),
            metrics: toJson({
              actionabilityScore: roundMetric(result.actionabilityScore),
              journeyScore: roundMetric(result.journeyScore),
              contractPass: result.stats.contractPass,
              policyChecks: result.stats.policyChecks,
              policyMatches: result.stats.policyMatches,
              fabricatedInsightCount: result.stats.fabricatedInsightCount,
            }),
            failures: toJson(result.failures),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gold replay case failed unexpectedly.';
        const failure: GoldReplayFailure = {
          dimension: 'contract',
          expected: 'successful replay execution',
          actual: message,
          severity: 'block',
          message,
        };
        const failedResult: GoldReplayCaseResult & { stats: CaseStats } = {
          caseId: goldCase.id,
          passed: false,
          failures: [failure],
          durationMs: Date.now() - startedAt,
          journeyScore: 0,
          actionabilityScore: 0,
          stats: {
            policyChecks: 0,
            policyMatches: 0,
            stateChecks: 0,
            stateMatches: 0,
            fabricatedInsightCount: 1,
            unknownPolicyCount: 0,
            schoolCount: 0,
            contractPass: false,
            actionabilityScore: 0,
            journeyScore: 0,
          },
        };
        caseResults.push(failedResult);

        await prisma.applicationAnalysisReplayCaseResult.create({
          data: {
            replayRunId: replayRun.id,
            caseId: goldCase.id,
            sourceType: goldCase.profileSnapshotRef
              ? 'FIXTURE_REF'
              : 'INLINE_SNAPSHOT',
            status: 'FAILED',
            failures: toJson([failure]),
          },
        });
      }
    }

    const aggregate = buildAggregate(caseResults);
    await mkdir(GOLD_REPORTS_DIR, { recursive: true });
    const reportJsonPath = path.join(GOLD_REPORTS_DIR, `${reportStem}.json`);
    const reportMarkdownPath = path.join(GOLD_REPORTS_DIR, `${reportStem}.md`);

    const reportPayload = {
      generatedAt: new Date().toISOString(),
      dataset,
      mode: args.mode,
      analysisVersion: analysisVersion[0],
      commitSha,
      aggregate: {
        ...aggregate,
        policyCorrectnessRate: roundMetric(aggregate.policyCorrectnessRate),
        weakStateCorrectnessRate: roundMetric(
          aggregate.weakStateCorrectnessRate,
        ),
        actionabilityMean: roundMetric(aggregate.actionabilityMean),
        journeyPassRate: roundOptionalMetric(aggregate.journeyPassRate),
        unknownPolicyRate: roundMetric(aggregate.unknownPolicyRate),
        goldPassRate: roundMetric(aggregate.goldPassRate),
      },
      cases: caseResults,
    };
    await writeFile(reportJsonPath, JSON.stringify(reportPayload, null, 2));
    await writeFile(
      reportMarkdownPath,
      buildMarkdownReport({
        aggregate,
        cases: goldCases,
        caseResults,
        dataset,
        mode: args.mode,
        analysisVersion: analysisVersion[0],
        commitSha,
      }),
    );

    const failures = caseResults
      .filter((result) => !result.passed)
      .map(
        (result) => `${result.caseId}: ${result.failures.length} failure(s)`,
      );

    await prisma.applicationAnalysisReplayRun.update({
      where: { id: replayRun.id },
      data: {
        status: failures.length === 0 ? 'COMPLETED' : 'FAILED',
        finishedAt: new Date(),
        summary: toJson({
          totalCases: goldCases.length,
          caseIds: goldCases.map((item) => item.id),
          tagCounts: buildTagCounts(goldCases),
          dataset,
          mode: args.mode,
          commitSha,
          limit: args.limit ?? null,
          selectedTag: args.tag ?? null,
          persistRun: args.persistRun,
          reportPath: path.relative(
            path.resolve(__dirname, '..'),
            reportMarkdownPath,
          ),
          reportJsonPath: path.relative(
            path.resolve(__dirname, '..'),
            reportJsonPath,
          ),
          renderParityMode: {
            web: 'pending',
            mobile: 'pending',
          },
        }),
        metrics: toJson({
          policyCorrectnessRate: roundMetric(aggregate.policyCorrectnessRate),
          weakStateCorrectnessRate: roundMetric(
            aggregate.weakStateCorrectnessRate,
          ),
          fabricatedInsightCount: aggregate.fabricatedInsightCount,
          actionabilityMean: roundMetric(aggregate.actionabilityMean),
          contractParityPass: aggregate.contractParityPass,
          webRenderPass: aggregate.webRenderPass,
          mobileRenderPass: aggregate.mobileRenderPass,
          journeyPassRate: roundOptionalMetric(aggregate.journeyPassRate),
          unknownPolicyRate: roundMetric(aggregate.unknownPolicyRate),
          goldPassRate: roundMetric(aggregate.goldPassRate),
        }),
        failures: toJson(failures),
      },
    });

    await prisma.$disconnect();

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gold replay failed unexpectedly.';
    await prisma.applicationAnalysisReplayRun.update({
      where: { id: replayRun.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        failures: toJson([message]),
      },
    });
    await prisma.$disconnect();
    throw error;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
