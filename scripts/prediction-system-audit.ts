import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  ROUND_MULTIPLIERS,
  VERIFIED_OUTCOME_STATUSES,
  calculateConfidence,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
  computeAucRoc,
  computeBrierScore,
  computeCalibrationCurve,
  computeECE,
  computeLogLoss,
  enforceMonotonicity,
  resolveCanonicalPredictionOutcome,
} from '../packages/shared/src/scoring';
import { runPredictionAccuracyReport } from './prediction-accuracy-report';

type AuditOptions = {
  days: number;
  minVerified: number;
  outputDir: string;
  importDir?: string;
  scorecardApiKey: string;
};

type ModuleInventoryEntry = {
  module: 'prediction' | 'recommendation' | 'quick-match' | 'ranking';
  outputKind: string;
  sourceBoundary: string[];
  eligibleForFormalAccuracy: boolean;
  notes: string[];
  evidence: string[];
  observedPredictionRows?: number;
};

type ClaimDisposition = '可保留' | '需降级表述' | '需立即下线或替换';

type ClaimFinding = {
  id: string;
  severity: 'P1' | 'P2' | 'P3';
  disposition: ClaimDisposition;
  summary: string;
  detail: string;
  file: string;
  line: number | null;
  evidence: string;
};

type CodeFinding = {
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  impact: string;
  recommendation: string;
  evidence: string[];
};

type ExternalBaselineRow = {
  schoolName: string;
  officialSchoolName: string | null;
  scorecardId: number | null;
  officialAdmissionRatePct: number | null;
  officialSatAvg: number | null;
  officialActMid: number | null;
  internalMatchedName: string | null;
  internalAcceptanceRatePct: number | null;
  internalSatAvg: number | null;
  internalActAvg: number | null;
  acceptanceRateDeltaPct: number | null;
  satDelta: number | null;
  actDelta: number | null;
  sourceUrl: string;
};

type SyntheticProfileSpec = {
  id: string;
  label: string;
  round: string;
  profile: {
    gpa?: number;
    gpaScale?: number;
    testScores?: Array<{ type: string; score: number }>;
    activities?: Array<{
      category: string;
      role: string;
      hoursPerWeek?: number;
      weeksPerYear?: number;
    }>;
    awards?: Array<{
      level: string;
      competition?: { tier: number } | null;
    }>;
  };
};

type SyntheticSchoolSpec = {
  id: string;
  label: string;
  school: {
    acceptanceRate: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
    actAvg?: number;
    act25?: number;
    act75?: number;
    usNewsRank?: number;
    graduationRate?: number;
  };
};

type SyntheticCheckResult = {
  name: string;
  passed: boolean;
  detail: string;
};

type OfflineEvalRow = {
  predictionId: string;
  profileId: string | null;
  schoolId: string;
  schoolName: string;
  source: string | null;
  modelVersion: string | null;
  probability: number;
  probabilityLow: number | null;
  probabilityHigh: number | null;
  tier: string | null;
  confidence: string | null;
  applicationRound: string | null;
  applicationYear: string | null;
  cohortKey: string | null;
  createdAt: string | null;
  selectivityBand: string;
  label: 0 | 1;
  verifiedStatus: string;
};

type OfflineGroupMetrics = {
  group: string;
  sampleCount: number;
  admittedCount: number;
  rejectedCount: number;
  brier: number;
  ece: number;
  logLoss: number;
  auc: number | null;
};

type OfflineImportReport =
  | {
      status: 'missing_input';
      message: string;
      schema: {
        requiredFiles: string[];
        optionalFiles: string[];
      };
    }
  | {
      status: 'no_verified_outcomes';
      message: string;
      parsedFiles: string[];
      inventory: Array<{ status: string; result: string; count: number }>;
    }
  | {
      status: 'ok';
      parsedFiles: string[];
      sampleCount: number;
      overall: OfflineGroupMetrics;
      bySource: OfflineGroupMetrics[];
      byModelVersion: OfflineGroupMetrics[];
      byRound: OfflineGroupMetrics[];
      byCohort: OfflineGroupMetrics[];
      bySchool: OfflineGroupMetrics[];
      bySelectivityBand: OfflineGroupMetrics[];
      calibrationBins: Array<{
        predictedMean: number;
        actualRate: number;
        count: number;
      }>;
      confidenceSummary: Array<{
        confidence: string;
        count: number;
        admitRate: number | null;
      }>;
      tierMonotonicity: {
        passes: boolean;
        tiers: Array<{
          tier: string;
          count: number;
          admitRate: number | null;
        }>;
      };
      quickMatchStandalone: OfflineGroupMetrics | null;
      nonQuickMatchOverall: OfflineGroupMetrics | null;
    };

type RecommendationConsistencyReport = {
  anchorClamp: {
    scenarios: number;
    maxDeviationPctPoints: number;
    violations: number;
  };
  quickMatchVsPrediction: {
    comparedRows: number;
    avgAbsDeltaPctPoints: number;
    tierDisagreements: number;
    sampleDiffs: Array<{
      profile: string;
      school: string;
      quickMatchProbability: number;
      predictionProbability: number;
      quickMatchTier: string;
      predictionTier: string;
    }>;
  };
  rankingBoundary: {
    isProbabilityEngine: false;
    rationale: string;
    evidence: string[];
  };
};

type SyntheticStressReport = {
  checks: SyntheticCheckResult[];
  scenarioCount: number;
};

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'docs', 'audits', `prediction-system-${TODAY}`);

function loadApiEnv() {
  const envPath = path.join(ROOT, 'apps/api/.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] != null) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv: string[]): AuditOptions {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    i += 1;
  }

  const parsedDays = Number(values.get('days') ?? '365');
  const parsedMinVerified = Number(values.get('min-verified') ?? '200');

  return {
    days: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 365,
    minVerified:
      Number.isFinite(parsedMinVerified) && parsedMinVerified > 0 ? parsedMinVerified : 200,
    outputDir: path.resolve(values.get('out-dir') ?? DEFAULT_OUTPUT_DIR),
    importDir: values.get('import-dir') ? path.resolve(values.get('import-dir')!) : undefined,
    scorecardApiKey:
      values.get('scorecard-api-key') ?? process.env.COLLEGE_SCORECARD_API_KEY ?? 'DEMO_KEY',
  };
}

function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(target: string, data: unknown) {
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(target: string, data: string) {
  fs.writeFileSync(target, `${data.trimEnd()}\n`, 'utf8');
}

function round(value: number, digits: number = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPctString(value: number | null | undefined, digits: number = 2): string {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(digits)}%`;
}

function relativePath(target: string): string {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function findLine(filePath: string, needle: string): number | null {
  const lines = readFile(filePath).split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  return index >= 0 ? index + 1 : null;
}

function fileRef(filePath: string, line: number | null): string {
  return line == null ? relativePath(filePath) : `${relativePath(filePath)}:${line}`;
}

function extractProfileMetrics(profile: SyntheticProfileSpec['profile']) {
  const gpa = profile.gpa;
  const gpaScale = profile.gpaScale;
  const testScores = profile.testScores ?? [];
  const satScore = testScores.find((item) => item.type === 'SAT')?.score;
  const actScore = testScores.find((item) => item.type === 'ACT')?.score;
  const toeflScore = testScores.find((item) => item.type === 'TOEFL')?.score;
  const activities = profile.activities ?? [];
  const awards = profile.awards ?? [];
  const awardTierScores = awards.map((award) => award.competition?.tier ?? 0).filter(Boolean);

  return {
    gpa,
    gpaScale,
    satScore,
    actScore,
    toeflScore,
    activityCount: activities.length,
    awardCount: awards.length,
    nationalAwardCount: awards.filter((award) => award.level === 'NATIONAL').length,
    internationalAwardCount: awards.filter((award) => award.level === 'INTERNATIONAL').length,
    awardTierScores: awardTierScores.length > 0 ? awardTierScores : undefined,
    activityDetails: activities.map((activity) => ({
      category: activity.category,
      role: activity.role,
      totalHours: (activity.hoursPerWeek ?? 0) * (activity.weeksPerYear ?? 0),
    })),
  };
}

function resolveContextualAcceptanceRate(params: {
  school: SyntheticSchoolSpec['school'];
  roundContext: string | null;
}): number {
  const normalizedRound = (params.roundContext ?? 'RD').toUpperCase();
  const roundMultiplier = ROUND_MULTIPLIERS[normalizedRound] ?? 1;
  return round(params.school.acceptanceRate * roundMultiplier, 1);
}

function computeHeuristicPrediction(
  profileSpec: SyntheticProfileSpec,
  schoolSpec: SyntheticSchoolSpec,
  mode: 'quick-match' | 'prediction'
) {
  const profileMetrics = extractProfileMetrics(profileSpec.profile);
  const schoolMetrics = {
    acceptanceRate: schoolSpec.school.acceptanceRate,
    satAvg: schoolSpec.school.satAvg,
    sat25: schoolSpec.school.sat25,
    sat75: schoolSpec.school.sat75,
    actAvg: schoolSpec.school.actAvg,
    act25: schoolSpec.school.act25,
    act75: schoolSpec.school.act75,
    usNewsRank: schoolSpec.school.usNewsRank,
    graduationRate: schoolSpec.school.graduationRate,
  };
  const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
  let probability = calculateProbability(overallScore, schoolMetrics);

  if (mode === 'prediction') {
    const multiplier = ROUND_MULTIPLIERS[profileSpec.round] ?? 1;
    probability = clamp(probability * multiplier, 0.05, 0.95);
  }

  const contextualAcceptanceRate =
    mode === 'prediction'
      ? resolveContextualAcceptanceRate({
          school: schoolSpec.school,
          roundContext: profileSpec.round,
        })
      : schoolSpec.school.acceptanceRate;
  const tier = calculateTier(probability, {
    ...schoolMetrics,
    acceptanceRate: contextualAcceptanceRate,
  });

  return {
    overallScore,
    probability,
    tier,
    confidence: calculateConfidence(profileMetrics, schoolMetrics),
    schoolMeta: {
      acceptanceRate: contextualAcceptanceRate,
      satAvg: schoolSpec.school.satAvg,
      sat25: schoolSpec.school.sat25,
      sat75: schoolSpec.school.sat75,
      usNewsRank: schoolSpec.school.usNewsRank,
      graduationRate: schoolSpec.school.graduationRate,
    },
  };
}

function anchorRecommendationProbability(statsProb: number, llmProbPct: number): number {
  const stats = statsProb;
  const llm = clamp(llmProbPct / 100, 0, 1);
  const maxDeviation = 0.15;
  const anchored = Math.max(
    0,
    Math.min(1, Math.max(stats - maxDeviation, Math.min(stats + maxDeviation, llm)))
  );
  return Math.round(anchored * 100);
}

async function buildModuleInventory(prisma: PrismaClient): Promise<ModuleInventoryEntry[]> {
  let predictionGroups: Array<{
    source: string | null;
    modelVersion: string | null;
    _count: { _all: number };
  }> = [];
  try {
    predictionGroups = await prisma.predictionResult.groupBy({
      by: ['source', 'modelVersion'],
      _count: { _all: true },
    });
  } catch {
    predictionGroups = [];
  }

  const observedRows = (
    predicate: (row: { source: string | null; modelVersion: string | null }) => boolean
  ) => predictionGroups.filter(predicate).reduce((sum, row) => sum + row._count._all, 0);

  return [
    {
      module: 'prediction',
      outputKind: 'Served personal admit probability, tier, confidence, factors',
      sourceBoundary: ['v3-enterprise served (deterministic counselor engine)', 'legacy fusion'],
      eligibleForFormalAccuracy: true,
      notes: [
        'Formal accuracy claim must use verified ADMITTED/REJECTED outcomes only.',
        'Served probability is post-processed after calibration by major, feeder, round, and school multipliers.',
      ],
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/prediction/prediction.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/prediction/prediction.service.ts'),
            'fusedResult.probability = this.applyPlattCalibration('
          )
        ),
        fileRef(
          path.join(ROOT, 'docs/PREDICTION_CLOSED_LOOP_SOP.md'),
          findLine(
            path.join(ROOT, 'docs/PREDICTION_CLOSED_LOOP_SOP.md'),
            'SELF_REPORTED 可以帮助定位库存和运营优先级'
          )
        ),
      ],
      observedPredictionRows: observedRows(
        (row) => row.source !== 'quick-match' && row.modelVersion !== 'v1-stats'
      ),
    },
    {
      module: 'recommendation',
      outputKind: 'Estimated personal chance inside recommendation list',
      sourceBoundary: ['LLM recommendation output', 'stats anchor ±15pp'],
      eligibleForFormalAccuracy: false,
      notes: [
        'Recommendation probability is strategy guidance, not the formal prediction accuracy surface.',
        'Current design clamps LLM estimatedProbability to within ±15 percentage points of the stats baseline.',
      ],
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/recommendation/recommendation.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/recommendation/recommendation.service.ts'),
            'const MAX_DEVIATION = 0.15;'
          )
        ),
        fileRef(
          path.join(ROOT, 'packages/shared/src/types/recommendation.ts'),
          findLine(
            path.join(ROOT, 'packages/shared/src/types/recommendation.ts'),
            'estimatedProbability: number;'
          )
        ),
      ],
    },
    {
      module: 'quick-match',
      outputKind: 'Heuristic probability/tier generated from shared scoring utilities',
      sourceBoundary: ['v1-stats', 'source=quick-match'],
      eligibleForFormalAccuracy: true,
      notes: [
        'Quick-match persists into PredictionResult and must be split out from main prediction accuracy reporting.',
        'Quick-match confidence is hard-coded low in the persistence bridge.',
      ],
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/school-list/school-list.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/school-list/school-list.service.ts'),
            "modelVersion: 'v1-stats'"
          )
        ),
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/school-list/school-list.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/school-list/school-list.service.ts'),
            "source: 'quick-match'"
          )
        ),
      ],
      observedPredictionRows: observedRows(
        (row) => row.source === 'quick-match' || row.modelVersion === 'v1-stats'
      ),
    },
    {
      module: 'ranking',
      outputKind: 'Weighted school ranking score, not admit probability',
      sourceBoundary: ['Ranking weights over school attributes'],
      eligibleForFormalAccuracy: false,
      notes: [
        'Ranking service normalizes school attributes and returns rank/score only.',
        'It should never be included in probability accuracy claims.',
      ],
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
            'async calculateRanking(weights: RankingWeights): Promise<RankedSchool[]>'
          )
        ),
      ],
    },
  ];
}

function buildClaimAudit(): ClaimFinding[] {
  const rules: Array<Omit<ClaimFinding, 'line'> & { needle: string }> = [
    {
      id: 'auth-accuracy-zh',
      severity: 'P1',
      disposition: '需立即下线或替换',
      summary: '认证页直接宣称 95% 预测准确率',
      detail:
        '当前仓库 verified outcome 样本数为 0，且 SOP 规定 verified < 200 不得对外宣称已验证准确率。',
      file: path.join(ROOT, 'apps/web/src/messages/zh.json'),
      needle: '"accuracy": "95% 预测准确率"',
      evidence: 'auth.layout.features.accuracy',
    },
    {
      id: 'auth-accuracy-en',
      severity: 'P1',
      disposition: '需立即下线或替换',
      summary: 'Auth page claims 95% prediction accuracy',
      detail:
        'The claim is unsupported by current verified-outcome inventory and contradicts the closed-loop SOP threshold.',
      file: path.join(ROOT, 'apps/web/src/messages/en.json'),
      needle: '"accuracy": "95% Prediction Accuracy"',
      evidence: 'auth.layout.features.accuracy',
    },
    {
      id: 'faq-accuracy-zh',
      severity: 'P1',
      disposition: '需立即下线或替换',
      summary: 'FAQ 将预测准确率表述为 95% 以上',
      detail:
        'FAQ answer overstates verified accuracy and should be replaced with a capability description or a gated statement tied to verified sample thresholds.',
      file: path.join(ROOT, 'apps/web/src/messages/zh.json'),
      needle: '"answer": "基于大量真实案例数据，我们的预测准确率达到 95% 以上。"',
      evidence: 'help.faqItems.predictionAccuracy.answer',
    },
    {
      id: 'faq-accuracy-en',
      severity: 'P1',
      disposition: '需立即下线或替换',
      summary: 'FAQ says prediction accuracy is over 95%',
      detail:
        'This is outward-facing marketing copy that currently has no verified sample support in the repo baseline.',
      file: path.join(ROOT, 'apps/web/src/messages/en.json'),
      needle:
        '"answer": "Based on large amounts of real case data, our prediction accuracy is over 95%."',
      evidence: 'help.faqItems.predictionAccuracy.answer',
    },
    {
      id: 'landing-calibration-en',
      severity: 'P2',
      disposition: '需降级表述',
      summary: 'Landing page markets calibrated probabilities as inherently more trustworthy',
      detail:
        'This quality framing should be downgraded until calibration quality is backed by verified-sample evidence.',
      file: path.join(ROOT, 'apps/web/src/messages/en.json'),
      needle:
        '"description": "Get calibrated probability ranges grounded in current data rather than consultant instinct or forum folklore."',
      evidence: 'home.showcase.items.04.description',
    },
    {
      id: 'landing-calibration-zh',
      severity: 'P2',
      disposition: '需降级表述',
      summary: '落地页把“持续校准的模型”包装成更可信概率',
      detail: '在 verified gate 未通过前，这类文案应保持能力描述，而不是可信度承诺。',
      file: path.join(ROOT, 'apps/web/src/messages/zh.json'),
      needle: '"description": "用持续校准的模型给出更可信的概率判断，而不是情绪化的乐观或悲观。"',
      evidence: 'home.showcase.items.04.description',
    },
    {
      id: 'admin-overall-accuracy',
      severity: 'P2',
      disposition: '需降级表述',
      summary: 'Admin overallAccuracy 是 bucket 中点误差近似值，不是正式 accuracy metric',
      detail:
        'This should stay internal and be labeled as an approximate calibration proxy, not “accuracy”.',
      file: path.join(
        ROOT,
        'apps/web/src/app/[locale]/(main)/admin/calibrations/_components/overview-tab.tsx'
      ),
      needle: 'Compute overall accuracy (average absolute error across buckets)',
      evidence: 'overview-tab overallAccuracy calculation',
    },
    {
      id: 'recommendation-disclaimer-zh',
      severity: 'P3',
      disposition: '可保留',
      summary: '推荐页已区分个人预估机会和学校整体录取率',
      detail:
        'This disclaimer is directionally correct and should remain visible because recommendation is not the formal prediction-accuracy surface.',
      file: path.join(ROOT, 'apps/web/src/messages/zh.json'),
      needle:
        '"probabilityTooltip": "这是基于你当前档案的个人预估，不等于学校整体录取率。如需更完整的概率分析，请使用录取预测功能。"',
      evidence: 'schoolRecommendation.probabilityTooltip',
    },
    {
      id: 'recommendation-disclaimer-en',
      severity: 'P3',
      disposition: '可保留',
      summary: 'Recommendation copy distinguishes school-wide rate from personal chance',
      detail:
        'This is the right boundary for recommendation and should remain part of the product narrative.',
      file: path.join(ROOT, 'apps/web/src/messages/en.json'),
      needle:
        '"probabilityTooltip": "This is a personal estimate based on your current profile, not the school\'s overall acceptance rate. For a fuller probability analysis, use Prediction."',
      evidence: 'schoolRecommendation.probabilityTooltip',
    },
  ];

  return rules.map((rule) => ({
    ...rule,
    line: findLine(rule.file, rule.needle),
  }));
}

function buildCodeFindings(): CodeFinding[] {
  const calibrationFile = path.join(
    ROOT,
    'apps/api/src/modules/prediction/prediction-calibration.service.ts'
  );
  const reportingFile = path.join(
    ROOT,
    'apps/api/src/modules/prediction/prediction-reporting.service.ts'
  );
  const trainingFile = path.join(
    ROOT,
    'apps/api/src/modules/prediction/ml/training-data.service.ts'
  );
  const predictionServiceFile = path.join(
    ROOT,
    'apps/api/src/modules/prediction/prediction.service.ts'
  );
  const schoolListFile = path.join(ROOT, 'apps/api/src/modules/school-list/school-list.service.ts');
  const accuracyFile = path.join(ROOT, 'scripts/prediction-accuracy-report.ts');
  const sopFile = path.join(ROOT, 'docs/PREDICTION_CLOSED_LOOP_SOP.md');
  const scoringDocFile = path.join(ROOT, 'docs/SCORING_SYSTEM.md');

  return [
    {
      id: 'p0-truth-contamination',
      priority: 'P0',
      title:
        'Legacy calibration consumes unverified SELF_REPORTED outcomes via PredictionResult.actualResult',
      impact:
        'Calibration and drift suggestions can be trained on contaminated truth while training-data and monitoring paths use verified-only outcomes. This creates conflicting truth regimes inside the same prediction system.',
      recommendation:
        'Gate all calibration/drift inputs through canonical verified outcome records only. Stop using PredictionResult.actualResult as calibration truth unless its provenance is verified.',
      evidence: [
        fileRef(reportingFile, findLine(reportingFile, 'actualResult,')),
        fileRef(reportingFile, findLine(reportingFile, 'actualResult:')),
        fileRef(
          calibrationFile,
          findLine(calibrationFile, 'where: { actualResult: { not: null } },')
        ),
        fileRef(trainingFile, findLine(trainingFile, 'status: { in: VERIFIED_OUTCOME_STATUSES },')),
        fileRef(sopFile, findLine(sopFile, 'SELF_REPORTED 可以帮助定位库存和运营优先级')),
      ],
    },
    {
      id: 'p1-calibration-ordering',
      priority: 'P1',
      title: 'Served probability is modified after Platt calibration',
      impact:
        'The number shown to users is no longer the same quantity that was calibrated if later major, feeder, round, and school multipliers materially move it.',
      recommendation:
        'Either calibrate the final served probability after all deterministic adjustments, or move post-calibration modifiers into the calibratable model input space.',
      evidence: [
        fileRef(
          predictionServiceFile,
          findLine(predictionServiceFile, 'fusedResult.probability = this.applyPlattCalibration(')
        ),
        fileRef(
          predictionServiceFile,
          findLine(predictionServiceFile, 'const MAJOR_MODIFIERS: Record<number, number> = {')
        ),
        fileRef(
          predictionServiceFile,
          findLine(predictionServiceFile, 'if (feederSignal?.isFeeder) {')
        ),
        fileRef(
          predictionServiceFile,
          findLine(predictionServiceFile, 'const roundMultiplier = schoolInput.applicationRound')
        ),
        fileRef(
          predictionServiceFile,
          findLine(
            predictionServiceFile,
            'const calibrationMap = await this.getSchoolCalibrations();'
          )
        ),
      ],
    },
    {
      id: 'p1-unsupported-marketing-claim',
      priority: 'P1',
      title: 'Outward-facing 95% accuracy claim conflicts with current verified baseline and SOP',
      impact:
        'The current claim exposes the product to trust and governance risk because the repo baseline shows zero verified ADMITTED/REJECTED outcomes in the last 365 days.',
      recommendation:
        'Immediately replace marketing copy with non-quantified language until prediction gate passes with verified sample threshold support.',
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/web/src/messages/zh.json'),
          findLine(path.join(ROOT, 'apps/web/src/messages/zh.json'), '"accuracy": "95% 预测准确率"')
        ),
        fileRef(
          path.join(ROOT, 'apps/web/src/messages/en.json'),
          findLine(
            path.join(ROOT, 'apps/web/src/messages/en.json'),
            '"accuracy": "95% Prediction Accuracy"'
          )
        ),
        fileRef(
          path.join(ROOT, 'apps/web/src/messages/zh.json'),
          findLine(
            path.join(ROOT, 'apps/web/src/messages/zh.json'),
            '"answer": "基于大量真实案例数据，我们的预测准确率达到 95% 以上。"'
          )
        ),
        fileRef(sopFile, findLine(sopFile, 'verified outcome 记录少于 200 条')),
      ],
    },
    {
      id: 'p1-source-mixing',
      priority: 'P1',
      title:
        'Quick-match writes v1-stats rows into PredictionResult and can be mixed into accuracy reporting',
      impact:
        'Without explicit source segmentation, the audit can combine a heuristic quick-match branch with the main prediction workflow and produce misleading aggregate metrics.',
      recommendation:
        'Split formal reporting by source and modelVersion, and exclude quick-match from any headline prediction accuracy number.',
      evidence: [
        fileRef(schoolListFile, findLine(schoolListFile, "source: 'quick-match'")),
        fileRef(schoolListFile, findLine(schoolListFile, "modelVersion: 'v1-stats'")),
        fileRef(
          accuracyFile,
          findLine(accuracyFile, 'const predictions = await prisma.predictionResult.findMany({')
        ),
      ],
    },
    {
      id: 'p2-admin-accuracy-proxy',
      priority: 'P2',
      title: 'Admin overallAccuracy is an unweighted bucket-midpoint proxy',
      impact:
        'The metric can be visually compelling but statistically misleading, especially at low sample counts or when bucket sizes differ materially.',
      recommendation:
        'Relabel the widget as approximate calibration fit, or replace it with Brier/ECE/verified-sample-aware metrics.',
      evidence: [
        fileRef(
          path.join(
            ROOT,
            'apps/web/src/app/[locale]/(main)/admin/calibrations/_components/overview-tab.tsx'
          ),
          findLine(
            path.join(
              ROOT,
              'apps/web/src/app/[locale]/(main)/admin/calibrations/_components/overview-tab.tsx'
            ),
            'Compute overall accuracy (average absolute error across buckets)'
          )
        ),
      ],
    },
    {
      id: 'p2-scoring-doc-drift',
      priority: 'P2',
      title:
        'SCORING_SYSTEM probability formula is stale and blurs base-rate vs personal-chance logic',
      impact:
        'When internal docs describe an outdated probability formula, product copy and operator explanations can drift away from the real scoring implementation.',
      recommendation:
        'Rewrite the probability section to match the current logistic formula and clearly separate school-wide rates from profile-conditioned personal estimates.',
      evidence: [
        fileRef(
          scoringDocFile,
          findLine(scoringDocFile, 'baseRate = school.acceptanceRate / 100 || 0.30')
        ),
        fileRef(
          path.join(ROOT, 'packages/shared/src/scoring/score.ts'),
          findLine(
            path.join(ROOT, 'packages/shared/src/scoring/score.ts'),
            'const threshold = 30 + selectivity * 45;'
          )
        ),
      ],
    },
  ];
}

function runPredictionGate(days: number, minVerified: number) {
  const result = spawnSync(
    'pnpm',
    ['prediction:gate', '--days', String(days), '--min-verified', String(minVerified)],
    {
      cwd: ROOT,
      encoding: 'utf8',
    }
  );

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function simpleCsvParse(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((parsedRow) => parsedRow.some((cell) => cell.length > 0));
}

function parseCsvFile(filePath: string): Array<Record<string, string>> {
  const rows = simpleCsvParse(readFile(filePath));
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] ?? '']))
  );
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: string | undefined): string | null {
  if (value == null || value === '') return null;
  return value;
}

function selectivityBand(ratePct: number | null): string {
  if (ratePct == null) return 'unknown';
  if (ratePct < 10) return 'ultra-selective';
  if (ratePct < 20) return 'highly-selective';
  if (ratePct < 40) return 'selective';
  return 'broad-access';
}

function computeGroupMetrics(rows: OfflineEvalRow[], group: string): OfflineGroupMetrics {
  const predictions = rows.map((row) => row.probability);
  const labels = rows.map((row) => row.label);
  const admittedCount = labels.reduce((sum, label) => sum + label, 0);
  const rejectedCount = rows.length - admittedCount;
  const positives = admittedCount;
  const negatives = rejectedCount;
  return {
    group,
    sampleCount: rows.length,
    admittedCount,
    rejectedCount,
    brier: round(computeBrierScore(predictions, labels), 6),
    ece: round(computeECE(predictions, labels, 10), 6),
    logLoss: round(computeLogLoss(predictions, labels), 6),
    auc: positives > 0 && negatives > 0 ? round(computeAucRoc(predictions, labels), 6) : null,
  };
}

function groupMetrics(
  rows: OfflineEvalRow[],
  getKey: (row: OfflineEvalRow) => string
): OfflineGroupMetrics[] {
  const groups = new Map<string, OfflineEvalRow[]>();
  for (const row of rows) {
    const key = getKey(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .map(([group, subset]) => computeGroupMetrics(subset, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.group.localeCompare(b.group));
}

function buildOfflineImportReport(importDir: string | undefined): OfflineImportReport {
  const requiredFiles = [
    'prediction_result.csv',
    'prediction_outcome_label_record.csv',
    'school.csv',
  ];
  const optionalFiles = ['admission_case.csv', 'school_recommendation.csv', 'school_list_item.csv'];

  if (!importDir) {
    return {
      status: 'missing_input',
      message:
        'No --import-dir was provided. CSV ingestion scaffold is implemented but no read-only export was supplied.',
      schema: {
        requiredFiles,
        optionalFiles,
      },
    };
  }

  const existingRequired = requiredFiles.map((name) => path.join(importDir, name));
  if (existingRequired.some((file) => !fs.existsSync(file))) {
    return {
      status: 'missing_input',
      message: `Import dir ${importDir} is missing one or more required CSV files.`,
      schema: {
        requiredFiles,
        optionalFiles,
      },
    };
  }

  const predictionRows = parseCsvFile(path.join(importDir, 'prediction_result.csv'));
  const outcomeRows = parseCsvFile(path.join(importDir, 'prediction_outcome_label_record.csv'));
  const schoolRows = parseCsvFile(path.join(importDir, 'school.csv'));
  const parsedFiles = requiredFiles
    .concat(optionalFiles.filter((name) => fs.existsSync(path.join(importDir, name))))
    .map((name) => relativePath(path.join(importDir, name)));

  const schoolMap = new Map(
    schoolRows.map((school) => [
      school.id,
      {
        name: school.name || school.nameZh || school.id,
        acceptanceRate: numberOrNull(school.acceptanceRate),
      },
    ])
  );

  const byPrediction = new Map<string, Array<Record<string, string>>>();
  for (const outcome of outcomeRows) {
    const bucket = byPrediction.get(outcome.predictionResultId) ?? [];
    bucket.push(outcome);
    byPrediction.set(outcome.predictionResultId, bucket);
  }

  const inventoryMap = new Map<string, number>();
  for (const outcome of outcomeRows) {
    const key = `${outcome.status}::${outcome.result}`;
    inventoryMap.set(key, (inventoryMap.get(key) ?? 0) + 1);
  }

  const rows: OfflineEvalRow[] = predictionRows
    .map((prediction) => {
      const labels = byPrediction.get(prediction.id) ?? [];
      const canonical = resolveCanonicalPredictionOutcome(
        labels.map((label) => ({
          result: label.result as any,
          status: label.status as any,
          isFinal: label.isFinal === 'true',
          createdAt: label.createdAt ? new Date(label.createdAt) : undefined,
          resolvedAt: label.resolvedAt ? new Date(label.resolvedAt) : undefined,
        }))
      );

      if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) return null;

      const school = schoolMap.get(prediction.schoolId);
      const acceptanceRate = school?.acceptanceRate ?? null;

      return {
        predictionId: prediction.id,
        profileId: stringOrNull(prediction.profileId),
        schoolId: prediction.schoolId,
        schoolName: school?.name ?? prediction.schoolId,
        source: stringOrNull(prediction.source),
        modelVersion: stringOrNull(prediction.modelVersion),
        probability: numberOrNull(prediction.probability) ?? 0,
        probabilityLow: numberOrNull(prediction.probabilityLow),
        probabilityHigh: numberOrNull(prediction.probabilityHigh),
        tier: stringOrNull(prediction.tier),
        confidence: stringOrNull(prediction.confidence),
        applicationRound: stringOrNull(prediction.applicationRound),
        applicationYear: stringOrNull(prediction.applicationYear),
        cohortKey: stringOrNull(prediction.cohortKey),
        createdAt: stringOrNull(prediction.createdAt),
        selectivityBand: selectivityBand(acceptanceRate),
        label: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
        verifiedStatus: canonical.canonicalRecord.status,
      } satisfies OfflineEvalRow;
    })
    .filter((row): row is OfflineEvalRow => Boolean(row));

  if (rows.length === 0) {
    return {
      status: 'no_verified_outcomes',
      message:
        'CSV import was parsed, but no verified ADMITTED/REJECTED outcomes survived canonical filtering.',
      parsedFiles,
      inventory: [...inventoryMap.entries()].map(([key, count]) => {
        const [status, result] = key.split('::');
        return { status, result, count };
      }),
    };
  }

  const confidenceSummary = ['low', 'medium', 'high'].map((confidence) => {
    const subset = rows.filter((row) => row.confidence === confidence);
    const admits = subset.reduce((sum, row) => sum + row.label, 0);
    return {
      confidence,
      count: subset.length,
      admitRate: subset.length ? round(admits / subset.length, 4) : null,
    };
  });

  const tierSummary = ['reach', 'match', 'safety'].map((tier) => {
    const subset = rows.filter((row) => row.tier === tier);
    const admits = subset.reduce((sum, row) => sum + row.label, 0);
    return {
      tier,
      count: subset.length,
      admitRate: subset.length ? round(admits / subset.length, 4) : null,
    };
  });
  const monotonicity =
    tierSummary.every((item) => item.count > 0) &&
    (tierSummary[0].admitRate ?? 0) < (tierSummary[1].admitRate ?? 0) &&
    (tierSummary[1].admitRate ?? 0) < (tierSummary[2].admitRate ?? 0);

  const quickMatchRows = rows.filter(
    (row) => row.source === 'quick-match' || row.modelVersion === 'v1-stats'
  );
  const nonQuickMatchRows = rows.filter(
    (row) => row.source !== 'quick-match' && row.modelVersion !== 'v1-stats'
  );

  return {
    status: 'ok',
    parsedFiles,
    sampleCount: rows.length,
    overall: computeGroupMetrics(rows, 'overall'),
    bySource: groupMetrics(rows, (row) => row.source ?? 'unknown'),
    byModelVersion: groupMetrics(rows, (row) => row.modelVersion ?? 'unknown'),
    byRound: groupMetrics(rows, (row) => row.applicationRound ?? 'UNKNOWN'),
    byCohort: groupMetrics(rows, (row) => row.cohortKey ?? 'UNKNOWN'),
    bySchool: groupMetrics(rows, (row) => row.schoolName),
    bySelectivityBand: groupMetrics(rows, (row) => row.selectivityBand),
    calibrationBins: computeCalibrationCurve(
      rows.map((row) => row.probability),
      rows.map((row) => row.label),
      10
    ).map((bin) => ({
      predictedMean: round(bin.predictedMean, 4),
      actualRate: round(bin.actualRate, 4),
      count: bin.count,
    })),
    confidenceSummary,
    tierMonotonicity: {
      passes: monotonicity,
      tiers: tierSummary,
    },
    quickMatchStandalone:
      quickMatchRows.length > 0 ? computeGroupMetrics(quickMatchRows, 'quick-match') : null,
    nonQuickMatchOverall:
      nonQuickMatchRows.length > 0
        ? computeGroupMetrics(nonQuickMatchRows, 'non-quick-match')
        : null,
  };
}

async function fetchScorecardSchool(
  schoolName: string,
  apiKey: string
): Promise<ExternalBaselineRow> {
  const fields = [
    'id',
    'school.name',
    'latest.admissions.admission_rate.overall',
    'latest.admissions.sat_scores.average.overall',
    'latest.admissions.act_scores.midpoint.cumulative',
  ].join(',');

  const url = new URL('https://api.data.gov/ed/collegescorecard/v1/schools.json');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('school.name', schoolName);
  url.searchParams.set('_fields', fields);
  url.searchParams.set('_per_page', '5');

  let json: { results?: Array<Record<string, number | string | null>> } | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url);
    lastStatus = response.status;
    if (response.ok) {
      json = (await response.json()) as {
        results?: Array<Record<string, number | string | null>>;
      };
      break;
    }

    if (response.status !== 429 || attempt === 3) {
      throw new Error(`College Scorecard request failed for ${schoolName}: ${response.status}`);
    }

    await sleep(500 * (attempt + 1));
  }

  if (!json) {
    throw new Error(
      `College Scorecard request failed for ${schoolName}: ${lastStatus ?? 'unknown'}`
    );
  }

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const expected = normalize(schoolName);
  const scored = (json.results ?? []).map((item) => {
    const name = typeof item['school.name'] === 'string' ? item['school.name'] : '';
    const normalized = normalize(name);
    const exactScore = normalized === expected ? 3 : 0;
    const containmentScore = normalized.includes(expected) || expected.includes(normalized) ? 1 : 0;
    return {
      item,
      score: exactScore + containmentScore,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const first = scored[0]?.item ?? null;

  return {
    schoolName,
    officialSchoolName: (first?.['school.name'] as string | undefined) ?? null,
    scorecardId: (first?.id as number | undefined) ?? null,
    officialAdmissionRatePct:
      typeof first?.['latest.admissions.admission_rate.overall'] === 'number'
        ? round(Number(first['latest.admissions.admission_rate.overall']) * 100, 2)
        : null,
    officialSatAvg:
      typeof first?.['latest.admissions.sat_scores.average.overall'] === 'number'
        ? Number(first['latest.admissions.sat_scores.average.overall'])
        : null,
    officialActMid:
      typeof first?.['latest.admissions.act_scores.midpoint.cumulative'] === 'number'
        ? Number(first['latest.admissions.act_scores.midpoint.cumulative'])
        : null,
    internalMatchedName: null,
    internalAcceptanceRatePct: null,
    internalSatAvg: null,
    internalActAvg: null,
    acceptanceRateDeltaPct: null,
    satDelta: null,
    actDelta: null,
    sourceUrl: url.toString(),
  };
}

async function buildExternalBaseline(
  prisma: PrismaClient,
  apiKey: string
): Promise<{
  sources: Array<{ label: string; url: string; use: string }>;
  rows: ExternalBaselineRow[];
  summary: {
    sampledSchools: number;
    internalMatches: number;
    officialMatches: number;
    avgAbsAcceptanceRateDeltaPct: number | null;
  };
}> {
  const sampledNames = [
    'Stanford University',
    'Harvard University',
    'Massachusetts Institute of Technology',
    'University of California-Los Angeles',
    'University of Michigan-Ann Arbor',
  ];

  const officialRows: ExternalBaselineRow[] = [];
  for (const sampledName of sampledNames) {
    officialRows.push(await fetchScorecardSchool(sampledName, apiKey));
    await sleep(250);
  }

  let internalSchools: Array<{
    id: string;
    name: string | null;
    nameZh: string | null;
    acceptanceRate: any;
    satAvg: number | null;
    actAvg: number | null;
  }> = [];
  try {
    internalSchools = await prisma.school.findMany({
      where: {
        OR: sampledNames.map((name) => ({
          name: { contains: name.split(' ')[0], mode: 'insensitive' as const },
        })),
      },
      select: {
        id: true,
        name: true,
        nameZh: true,
        acceptanceRate: true,
        satAvg: true,
        actAvg: true,
      },
      take: 50,
    });
  } catch {
    internalSchools = [];
  }

  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const rows = officialRows.map((row) => {
    const match = internalSchools.find((school) => {
      const internal = normalize(school.name ?? school.nameZh ?? '');
      const expected = normalize(row.schoolName);
      return internal === expected || internal.includes(expected) || expected.includes(internal);
    });

    const internalAcceptanceRatePct =
      match?.acceptanceRate != null ? round(Number(match.acceptanceRate), 2) : null;
    const internalSatAvg = match?.satAvg ?? null;
    const internalActAvg = match?.actAvg ?? null;

    return {
      ...row,
      internalMatchedName: match?.name ?? match?.nameZh ?? null,
      internalAcceptanceRatePct,
      internalSatAvg,
      internalActAvg,
      acceptanceRateDeltaPct:
        row.officialAdmissionRatePct != null && internalAcceptanceRatePct != null
          ? round(internalAcceptanceRatePct - row.officialAdmissionRatePct, 2)
          : null,
      satDelta:
        row.officialSatAvg != null && internalSatAvg != null
          ? internalSatAvg - row.officialSatAvg
          : null,
      actDelta:
        row.officialActMid != null && internalActAvg != null
          ? internalActAvg - row.officialActMid
          : null,
    };
  });

  const comparableAcceptanceDeltas = rows
    .map((row) => row.acceptanceRateDeltaPct)
    .filter((value): value is number => value != null)
    .map((value) => Math.abs(value));

  return {
    sources: [
      {
        label: 'College Scorecard API',
        url: 'https://collegescorecard.ed.gov/data/api/',
        use: 'Official admissions-rate and test-score baseline for school-level spot checks.',
      },
      {
        label: 'IPEDS',
        url: 'https://nces.ed.gov/ipeds/Home',
        use: 'Official federal postsecondary data system; validates institution-level data provenance and coverage.',
      },
      {
        label: 'Common Data Set',
        url: 'https://commondataset.org/',
        use: 'Common schema for institution-published admissions and enrollment details, often needed for fields not exposed in Scorecard.',
      },
      {
        label: 'Stanford CDS / IR example',
        url: 'https://irds.stanford.edu/data-findings/cds',
        use: 'Example school-operated institutional research page for manual round/intl-context checks.',
      },
    ],
    rows,
    summary: {
      sampledSchools: sampledNames.length,
      internalMatches: rows.filter((row) => row.internalMatchedName).length,
      officialMatches: rows.filter((row) => row.officialSchoolName).length,
      avgAbsAcceptanceRateDeltaPct:
        comparableAcceptanceDeltas.length > 0
          ? round(
              comparableAcceptanceDeltas.reduce((sum, value) => sum + value, 0) /
                comparableAcceptanceDeltas.length,
              2
            )
          : null,
    },
  };
}

function buildSyntheticScenarios(): {
  profiles: SyntheticProfileSpec[];
  schools: SyntheticSchoolSpec[];
} {
  return {
    profiles: [
      {
        id: 'missing',
        label: 'Sparse profile / missing critical inputs',
        round: 'RD',
        profile: {
          gpa: 3.2,
          gpaScale: 4,
        },
      },
      {
        id: 'baseline',
        label: 'Baseline applicant',
        round: 'RD',
        profile: {
          gpa: 3.65,
          gpaScale: 4,
          testScores: [
            { type: 'SAT', score: 1360 },
            { type: 'TOEFL', score: 102 },
          ],
          activities: [
            { category: 'CLUB', role: 'Member', hoursPerWeek: 3, weeksPerYear: 25 },
            { category: 'COMMUNITY_SERVICE', role: 'Volunteer', hoursPerWeek: 2, weeksPerYear: 20 },
          ],
          awards: [{ level: 'STATE', competition: { tier: 2 } }],
        },
      },
      {
        id: 'competitive',
        label: 'Competitive applicant',
        round: 'EA',
        profile: {
          gpa: 3.88,
          gpaScale: 4,
          testScores: [
            { type: 'SAT', score: 1490 },
            { type: 'TOEFL', score: 111 },
          ],
          activities: [
            { category: 'RESEARCH', role: 'Lead Researcher', hoursPerWeek: 6, weeksPerYear: 32 },
            { category: 'LEADERSHIP', role: 'President', hoursPerWeek: 4, weeksPerYear: 30 },
            { category: 'COMMUNITY_SERVICE', role: 'Founder', hoursPerWeek: 3, weeksPerYear: 20 },
          ],
          awards: [
            { level: 'NATIONAL', competition: { tier: 4 } },
            { level: 'STATE', competition: { tier: 3 } },
          ],
        },
      },
      {
        id: 'elite',
        label: 'Elite applicant',
        round: 'ED',
        profile: {
          gpa: 4.0,
          gpaScale: 4,
          testScores: [
            { type: 'SAT', score: 1570 },
            { type: 'TOEFL', score: 116 },
          ],
          activities: [
            { category: 'RESEARCH', role: 'Founder', hoursPerWeek: 8, weeksPerYear: 36 },
            { category: 'ACADEMIC', role: 'Captain', hoursPerWeek: 5, weeksPerYear: 28 },
            { category: 'INTERNSHIP', role: 'Lead', hoursPerWeek: 6, weeksPerYear: 12 },
          ],
          awards: [
            { level: 'INTERNATIONAL', competition: { tier: 5 } },
            { level: 'NATIONAL', competition: { tier: 4 } },
          ],
        },
      },
    ],
    schools: [
      {
        id: 'elite-private',
        label: 'Elite private',
        school: {
          acceptanceRate: 4,
          satAvg: 1550,
          sat25: 1500,
          sat75: 1580,
          actAvg: 35,
          act25: 34,
          act75: 36,
          usNewsRank: 3,
          graduationRate: 96,
        },
      },
      {
        id: 'highly-selective',
        label: 'Highly selective',
        school: {
          acceptanceRate: 12,
          satAvg: 1490,
          sat25: 1440,
          sat75: 1540,
          actAvg: 34,
          act25: 33,
          act75: 35,
          usNewsRank: 16,
          graduationRate: 92,
        },
      },
      {
        id: 'selective',
        label: 'Selective',
        school: {
          acceptanceRate: 27,
          satAvg: 1390,
          sat25: 1320,
          sat75: 1460,
          actAvg: 31,
          act25: 29,
          act75: 33,
          usNewsRank: 42,
          graduationRate: 88,
        },
      },
      {
        id: 'broad-access',
        label: 'Broad access',
        school: {
          acceptanceRate: 62,
          satAvg: 1180,
          sat25: 1110,
          sat75: 1250,
          actAvg: 25,
          act25: 22,
          act75: 28,
          usNewsRank: 118,
          graduationRate: 71,
        },
      },
    ],
  };
}

function buildRecommendationConsistency(): RecommendationConsistencyReport {
  const scenarios = buildSyntheticScenarios();

  let anchorScenarios = 0;
  let maxDeviationPctPoints = 0;
  let anchorViolations = 0;

  for (const profile of scenarios.profiles) {
    for (const school of scenarios.schools) {
      const stats = computeHeuristicPrediction(profile, school, 'quick-match');
      for (const llmPct of [5, 20, 50, 80, 95]) {
        anchorScenarios += 1;
        const anchoredPct = anchorRecommendationProbability(stats.probability, llmPct);
        const deviation = Math.abs(anchoredPct - stats.probability * 100);
        maxDeviationPctPoints = Math.max(maxDeviationPctPoints, deviation);
        // Product output is rounded to integer percentage points, so allow 0.5pp slack.
        if (deviation > 15.5) {
          anchorViolations += 1;
        }
      }
    }
  }

  const comparisonRows: RecommendationConsistencyReport['quickMatchVsPrediction']['sampleDiffs'] =
    [];
  let tierDisagreements = 0;
  let totalDelta = 0;
  let comparedRows = 0;

  for (const profile of scenarios.profiles) {
    const predictionBatch = scenarios.schools.map((school) => {
      const pred = computeHeuristicPrediction(profile, school, 'prediction');
      return {
        schoolId: school.id,
        label: school.label,
        probability: pred.probability,
        probabilityLow: clamp(pred.probability - 0.05, 0.01, 0.95),
        probabilityHigh: clamp(pred.probability + 0.05, pred.probability, 0.99),
        tier: pred.tier,
        schoolMeta: pred.schoolMeta,
      };
    });
    enforceMonotonicity(predictionBatch);

    for (const school of scenarios.schools) {
      const quick = computeHeuristicPrediction(profile, school, 'quick-match');
      const prediction = predictionBatch.find((item) => item.schoolId === school.id)!;
      const deltaPct = Math.abs(prediction.probability - quick.probability) * 100;
      comparedRows += 1;
      totalDelta += deltaPct;
      if (prediction.tier !== quick.tier) tierDisagreements += 1;
      if (comparisonRows.length < 8 && (deltaPct >= 5 || prediction.tier !== quick.tier)) {
        comparisonRows.push({
          profile: profile.label,
          school: school.label,
          quickMatchProbability: round(quick.probability * 100, 1),
          predictionProbability: round(prediction.probability * 100, 1),
          quickMatchTier: quick.tier,
          predictionTier: prediction.tier,
        });
      }
    }
  }

  return {
    anchorClamp: {
      scenarios: anchorScenarios,
      maxDeviationPctPoints: round(maxDeviationPctPoints, 2),
      violations: anchorViolations,
    },
    quickMatchVsPrediction: {
      comparedRows,
      avgAbsDeltaPctPoints: round(totalDelta / Math.max(comparedRows, 1), 2),
      tierDisagreements,
      sampleDiffs: comparisonRows,
    },
    rankingBoundary: {
      isProbabilityEngine: false,
      rationale:
        'RankingService calculates weighted school scores from school attributes and returns rank/score, with no profile-conditioned admit probability.',
      evidence: [
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
            'async calculateRanking(weights: RankingWeights): Promise<RankedSchool[]>'
          )
        ),
        fileRef(
          path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
          findLine(
            path.join(ROOT, 'apps/api/src/modules/ranking/ranking.service.ts'),
            'private calculateScore('
          )
        ),
      ],
    },
  };
}

function buildSyntheticStressReport(): SyntheticStressReport {
  const scenarios = buildSyntheticScenarios();
  const checks: SyntheticCheckResult[] = [];

  for (const school of scenarios.schools) {
    const series = scenarios.profiles.map(
      (profile) => computeHeuristicPrediction(profile, school, 'quick-match').probability
    );
    const monotonic = series.every(
      (value, index) => index === 0 || value >= series[index - 1] - 1e-9
    );
    checks.push({
      name: `单调性 / ${school.label}`,
      passed: monotonic,
      detail: `概率序列: ${series.map((value) => `${round(value * 100, 1)}%`).join(' -> ')}`,
    });
  }

  for (const profile of scenarios.profiles) {
    const series = scenarios.schools.map(
      (school) => computeHeuristicPrediction(profile, school, 'quick-match').probability
    );
    const sane = series.every((value, index) => index === 0 || value >= series[index - 1] - 1e-9);
    checks.push({
      name: `选择性方向 / ${profile.label}`,
      passed: sane,
      detail: `从最难到最易的概率序列: ${series.map((value) => `${round(value * 100, 1)}%`).join(' -> ')}`,
    });
  }

  const roundSchool = scenarios.schools[1];
  const roundProfile = scenarios.profiles[2];
  const rd = computeHeuristicPrediction(
    { ...roundProfile, round: 'RD' },
    roundSchool,
    'prediction'
  ).probability;
  const ea = computeHeuristicPrediction(
    { ...roundProfile, round: 'EA' },
    roundSchool,
    'prediction'
  ).probability;
  const ed = computeHeuristicPrediction(
    { ...roundProfile, round: 'ED' },
    roundSchool,
    'prediction'
  ).probability;
  checks.push({
    name: '轮次敏感性 / RD EA ED',
    passed: rd <= ea && ea <= ed,
    detail: `RD ${round(rd * 100, 1)}%, EA ${round(ea * 100, 1)}%, ED ${round(ed * 100, 1)}%`,
  });

  const sparse = computeHeuristicPrediction(
    scenarios.profiles[0],
    scenarios.schools[2],
    'quick-match'
  );
  const rich = computeHeuristicPrediction(
    scenarios.profiles[3],
    scenarios.schools[2],
    'quick-match'
  );
  checks.push({
    name: '缺失数据韧性 / confidence 降级',
    passed: sparse.confidence === 'low' && rich.confidence !== 'low',
    detail: `sparse=${sparse.confidence}, rich=${rich.confidence}`,
  });

  const stabilitySeries = Array.from(
    { length: 5 },
    () =>
      computeHeuristicPrediction(scenarios.profiles[2], scenarios.schools[1], 'quick-match')
        .probability
  );
  checks.push({
    name: '稳定性 / 重复运行一致',
    passed: stabilitySeries.every((value) => value === stabilitySeries[0]),
    detail: `重复 5 次输出: ${stabilitySeries.map((value) => round(value * 100, 2)).join(', ')}`,
  });

  return {
    checks,
    scenarioCount: scenarios.profiles.length * scenarios.schools.length,
  };
}

function renderTable(headers: string[], rows: string[][]): string {
  const divider = headers.map(() => '---');
  return [headers, divider, ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function renderSummaryMarkdown(params: {
  accuracyReport: Awaited<ReturnType<typeof runPredictionAccuracyReport>>;
  gate: ReturnType<typeof runPredictionGate>;
  importReport: OfflineImportReport;
  claims: ClaimFinding[];
  findings: CodeFinding[];
  externalBaseline: Awaited<ReturnType<typeof buildExternalBaseline>>;
  synthetic: SyntheticStressReport;
}): string {
  const mustReplace = params.claims.filter(
    (item) => item.disposition === '需立即下线或替换'
  ).length;
  const summaryVerdict =
    params.accuracyReport.sampleCount === 0 || mustReplace > 0
      ? '必须停止宣称'
      : params.importReport.status === 'ok' && params.importReport.sampleCount >= 200
        ? '可对外宣称'
        : '仅内部使用';

  const gateHeadline = params.gate.stdout
    ? params.gate.stdout.split('\n').slice(0, 6).join('\n')
    : params.gate.stderr || 'prediction:gate produced no output';

  return `
# 留学预测系统全面审计总结

## 主结论

- 审计日期: ${TODAY}
- 最终结论: **${summaryVerdict}**
- 当前仓库基线: \`pnpm prediction:accuracy --format json --days ${params.accuracyReport.windowDays}\` 返回 verified sampleCount = ${params.accuracyReport.sampleCount}
- 外部宣传状态: 发现 ${mustReplace} 条需要立即下线或替换的准确率文案

## 关键证据

- 本地 accuracy 基线没有任何 verified \`ADMITTED/REJECTED\` outcome，因此不能形成真实准确率结论。
- Closed-loop SOP 明确要求 verified outcome 少于 200 条时不得对外宣称“准确率已验证”。
- 现有 calibration path 仍会读取 \`PredictionResult.actualResult\`，而该字段会在 \`SELF_REPORTED\` 时立即写入。
- quick-match 以 \`source=quick-match\` / \`modelVersion=v1-stats\` 写入 \`PredictionResult\`，如果不拆分 source，会污染主 accuracy 汇总。

## prediction:gate 摘要

\`\`\`text
${gateHeadline}
\`\`\`

## 外部基线摘要

- 官方抽样学校数: ${params.externalBaseline.summary.sampledSchools}
- 匹配到官方 Scorecard 数据: ${params.externalBaseline.summary.officialMatches}
- 匹配到内部学校元数据: ${params.externalBaseline.summary.internalMatches}
- acceptance rate 平均绝对偏差: ${
    params.externalBaseline.summary.avgAbsAcceptanceRateDeltaPct == null
      ? 'n/a'
      : `${params.externalBaseline.summary.avgAbsAcceptanceRateDeltaPct}%`
  }

## 合成压力测试摘要

- 场景数: ${params.synthetic.scenarioCount}
- 通过检查数: ${params.synthetic.checks.filter((check) => check.passed).length}/${params.synthetic.checks.length}

## 离线导入状态

- ${(() => {
    if (params.importReport.status === 'missing_input') return params.importReport.message;
    if (params.importReport.status === 'no_verified_outcomes') return params.importReport.message;
    return `已解析 ${params.importReport.parsedFiles.length} 个 CSV 文件，verified sampleCount = ${params.importReport.sampleCount}`;
  })()}
`;
}

function renderFindingsMarkdown(findings: CodeFinding[]): string {
  const lines = ['# 审计发现', ''];
  for (const finding of findings) {
    lines.push(`## ${finding.priority} - ${finding.title}`);
    lines.push('');
    lines.push(`- 影响: ${finding.impact}`);
    lines.push(`- 建议: ${finding.recommendation}`);
    lines.push(`- 证据: ${finding.evidence.join('；')}`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderClaimsMarkdown(findings: ClaimFinding[]): string {
  const rows = findings.map((finding) => [
    finding.severity,
    finding.disposition,
    finding.summary,
    fileRef(finding.file, finding.line),
  ]);
  return `
# Claims Audit

${renderTable(['Severity', 'Disposition', 'Summary', 'File'], rows)}

## Notes

${findings
  .map((finding) => `- ${finding.id}: ${finding.detail} (${fileRef(finding.file, finding.line)})`)
  .join('\n')}
`;
}

function renderExternalBaselineMarkdown(
  data: Awaited<ReturnType<typeof buildExternalBaseline>>
): string {
  const sourceRows = data.sources.map((source) => [
    source.label,
    source.use,
    `[link](${source.url})`,
  ]);
  const comparisonRows = data.rows.map((row) => [
    row.schoolName,
    row.internalMatchedName ?? 'n/a',
    row.officialAdmissionRatePct == null ? 'n/a' : `${row.officialAdmissionRatePct}%`,
    row.internalAcceptanceRatePct == null ? 'n/a' : `${row.internalAcceptanceRatePct}%`,
    row.acceptanceRateDeltaPct == null ? 'n/a' : `${row.acceptanceRateDeltaPct}%`,
  ]);
  return `
# External Baseline

## Official Sources

${renderTable(['Source', 'Use', 'URL'], sourceRows)}

## Scorecard Spot Check

${renderTable(
  ['School', 'Internal match', 'Official acceptance', 'Internal acceptance', 'Delta'],
  comparisonRows
)}

## Coverage Notes

- College Scorecard gives an official, automatable school-level baseline for overall admission rates and test-score ranges.
- IPEDS and school-run CDS/IR pages remain necessary for fields the repo tracks but Scorecard does not expose well, such as round-specific or international-only context.
- This baseline is for metadata sanity checking, not for prediction truth labels.
`;
}

function renderSyntheticMarkdown(report: SyntheticStressReport): string {
  return `
# Synthetic Stress Report

${renderTable(
  ['Check', 'Passed', 'Detail'],
  report.checks.map((check) => [check.name, check.passed ? 'PASS' : 'CHECK', check.detail])
)}
`;
}

function renderRoadmapMarkdown(): string {
  return `
# Remediation Roadmap

1. Stop all outward-facing quantified accuracy claims until verified sample threshold and gate requirements are met.
2. Unify truth source policy so calibration, drift monitoring, training data, and dashboards all read the same verified canonical outcome set.
3. Split reporting by \`source\` and \`modelVersion\`, with quick-match reported independently from main prediction.
4. Recalibrate the final served probability after all deterministic modifiers, or refactor modifiers upstream into the calibrated model input.
5. Replace admin “overallAccuracy” proxy with verified-sample-aware Brier, ECE, and calibration visualizations.
6. Supply a read-only production CSV export and rerun this audit to populate real source/version/round/cohort accuracy tables.
`;
}

function renderImportSchemaMarkdown(importReport: OfflineImportReport): string {
  const schema =
    importReport.status === 'missing_input'
      ? importReport.schema
      : {
          requiredFiles: [
            'prediction_result.csv',
            'prediction_outcome_label_record.csv',
            'school.csv',
          ],
          optionalFiles: [
            'admission_case.csv',
            'school_recommendation.csv',
            'school_list_item.csv',
          ],
        };

  return `
# Read-only Import Schema

## Required CSV files

${schema.requiredFiles.map((file) => `- ${file}`).join('\n')}

## Optional CSV files

${schema.optionalFiles.map((file) => `- ${file}`).join('\n')}

## Required columns

- \`prediction_result\`: \`id, profileId, schoolId, source, modelVersion, probability, probabilityLow, probabilityHigh, tier, confidence, applicationRound, applicationYear, cohortKey, createdAt\`
- \`prediction_outcome_label_record\`: \`predictionResultId, result, status, isFinal, createdAt, resolvedAt, notes, evidenceUrl\`
- \`school\`: \`id, name, nameZh, acceptanceRate, intlAcceptanceRate, satAvg, sat25, sat75, actAvg, act25, act75, usNewsRank\`

## Truth rules

- Only \`COUNSELOR_VERIFIED\` / \`DOCUMENT_VERIFIED\` + \`ADMITTED\`/\`REJECTED\` enter formal accuracy.
- \`SELF_REPORTED\`, \`WAITLISTED\`, \`DEFERRED\`, \`WITHDRAWN\`, and unresolved states stay out of the headline accuracy metric.
- SQL dumps are intentionally not executed by this runner; export read-only CSVs instead.
`;
}

async function main() {
  loadApiEnv();
  const options = parseArgs(process.argv.slice(2));
  ensureDir(options.outputDir);
  const metricsDir = path.join(options.outputDir, 'metrics');
  ensureDir(metricsDir);

  const prisma = new PrismaClient();
  try {
    const [accuracyReport, moduleInventory] = await Promise.all([
      runPredictionAccuracyReport({ days: options.days, format: 'json' }),
      buildModuleInventory(prisma),
    ]);
    let externalBaseline: Awaited<ReturnType<typeof buildExternalBaseline>>;
    try {
      externalBaseline = await buildExternalBaseline(prisma, options.scorecardApiKey);
    } catch (error) {
      const cachedBaselineFile = path.join(metricsDir, 'external_baseline_sample.json');
      if (!fs.existsSync(cachedBaselineFile)) {
        throw error;
      }
      externalBaseline = JSON.parse(readFile(cachedBaselineFile)) as Awaited<
        ReturnType<typeof buildExternalBaseline>
      >;
    }

    const gate = runPredictionGate(options.days, options.minVerified);
    const claimAudit = buildClaimAudit();
    const codeFindings = buildCodeFindings();
    const recommendationConsistency = buildRecommendationConsistency();
    const syntheticStress = buildSyntheticStressReport();
    const importReport = buildOfflineImportReport(options.importDir);

    writeJson(path.join(metricsDir, 'module_inventory.json'), moduleInventory);
    writeJson(path.join(metricsDir, 'prediction_accuracy_eval.json'), {
      localDbBaseline: accuracyReport,
      offlineImport: importReport,
      gate,
      staticRisks: codeFindings.filter(
        (finding) => finding.priority === 'P0' || finding.priority === 'P1'
      ),
    });
    writeJson(
      path.join(metricsDir, 'recommendation_consistency_eval.json'),
      recommendationConsistency
    );
    writeJson(path.join(metricsDir, 'marketing_claim_audit.json'), claimAudit);
    writeJson(path.join(metricsDir, 'external_baseline_sample.json'), externalBaseline);
    writeJson(path.join(metricsDir, 'synthetic_stress_eval.json'), syntheticStress);

    writeText(
      path.join(options.outputDir, 'audit_summary.md'),
      renderSummaryMarkdown({
        accuracyReport,
        gate,
        importReport,
        claims: claimAudit,
        findings: codeFindings,
        externalBaseline,
        synthetic: syntheticStress,
      })
    );
    writeText(path.join(options.outputDir, 'findings.md'), renderFindingsMarkdown(codeFindings));
    writeText(path.join(options.outputDir, 'claims-audit.md'), renderClaimsMarkdown(claimAudit));
    writeText(
      path.join(options.outputDir, 'external-baseline.md'),
      renderExternalBaselineMarkdown(externalBaseline)
    );
    writeText(
      path.join(options.outputDir, 'synthetic-stress-report.md'),
      renderSyntheticMarkdown(syntheticStress)
    );
    writeText(path.join(options.outputDir, 'remediation-roadmap.md'), renderRoadmapMarkdown());
    writeText(
      path.join(options.outputDir, 'data-import-schema.md'),
      renderImportSchemaMarkdown(importReport)
    );

    console.log(`Prediction system audit written to ${relativePath(options.outputDir)}`);
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(
      '[prediction-system-audit] failed:',
      error instanceof Error ? (error.stack ?? error.message) : error
    );
    process.exitCode = 1;
  });
}
