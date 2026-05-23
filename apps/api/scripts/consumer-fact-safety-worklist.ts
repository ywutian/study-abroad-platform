#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'CONSUMER_FACT_SAFETY_READY'
  | 'CONSUMER_FACT_SAFETY_REVIEW'
  | 'BLOCKED_CONSUMER_FACT_SAFETY';
type RowState = 'trusted' | 'review' | 'blocked';
type Severity = 'critical' | 'warning' | 'info';
type GateStatus = 'present' | 'missing' | 'not_required';
type GateName = 'source' | 'freshness' | 'conflict' | 'weakState';

interface Args {
  out: string;
  markdown: string;
  csv: string;
}

interface SignalSpec {
  id: string;
  patterns: string[];
  blockWhenMatched?: boolean;
  description: string;
}

interface ConsumerSpec {
  id: string;
  priority: 'P0' | 'P1';
  consumer: string;
  surface: string;
  files: string[];
  fields: string[];
  gateSignals: Record<GateName, string[]>;
  unsafeSignals: SignalSpec[];
  requiredGates: GateName[];
  highRisk: boolean;
  consumerPolicy: string;
  recommendedAction: string;
}

interface SignalHit {
  file: string;
  line: number;
  signal: string;
  text: string;
}

interface UnsafeHit {
  id: string;
  description: string;
  blockWhenMatched: boolean;
  hits: SignalHit[];
}

interface WorklistRow {
  id: string;
  priority: 'P0' | 'P1';
  consumer: string;
  surface: string;
  fields: string[];
  rowState: RowState;
  severity: Severity;
  highRisk: boolean;
  gateStatus: Record<GateName, GateStatus>;
  missingGates: GateName[];
  unsafeSignals: UnsafeHit[];
  consumerPolicy: string;
  recommendedAction: string;
  requiredEvidence: string[];
  prohibitedActions: string[];
  evidence: {
    files: string[];
    missingFiles: string[];
    gateHits: Record<GateName, SignalHit[]>;
  };
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');

const SPECS: ConsumerSpec[] = [
  {
    id: 'essay_public_prompt_source_gate',
    priority: 'P0',
    consumer: 'essay',
    surface: 'public essay prompt endpoints',
    files: ['apps/api/src/modules/essay/essay-prompt.service.ts'],
    fields: ['EssayPrompt.prompt', 'EssayPromptSource.sourceUrl'],
    gateSignals: {
      source: ['sources: { some: { sourceUrl: { not: null } } }'],
      freshness: ['year', 'applicationYear'],
      conflict: ['status: EssayStatus.VERIFIED', 'status: VERIFIED'],
      weakState: ['admin', 'review', 'source-less'],
    },
    unsafeSignals: [],
    requiredGates: ['source'],
    highRisk: true,
    consumerPolicy:
      'Public essay prompt consumers may expose only verified prompts with sourceUrl evidence.',
    recommendedAction: 'accept-source-gated-public-essay-endpoints',
  },
  {
    id: 'timeline_deadline_generation_source_gate',
    priority: 'P0',
    consumer: 'timeline',
    surface: 'ApplicationTimeline generation from SchoolDeadline/metadata',
    files: ['apps/api/src/modules/timeline/timeline-application.service.ts'],
    fields: [
      'SchoolDeadline.source',
      'School.metadata.deadlines',
      'ApplicationTimeline.deadline',
    ],
    gateSignals: {
      source: ['source:', 'SchoolDeadline.source', 'dl.source'],
      freshness: ['year: applicationYear', 'selectEffectiveDeadlines'],
      conflict: ['review', 'conflict', 'policy evidence'],
      weakState: ['fallback', 'generic planning placeholder'],
    },
    unsafeSignals: [
      {
        id: 'metadata_deadline_fallback',
        patterns: ['metadata?.deadlines', 'metadata.deadlines'],
        blockWhenMatched: true,
        description:
          'Timeline generation can derive school-specific deadlines from School.metadata.deadlines without provenance.',
      },
      {
        id: 'default_rd_fallback',
        patterns: ['new Date(applicationYear, 0, 15)', 'Jan 15 typical RD'],
        blockWhenMatched: true,
        description:
          'Timeline generation can create a concrete Jan 15 RD deadline when no school-specific source exists.',
      },
    ],
    requiredGates: ['source', 'freshness'],
    highRisk: true,
    consumerPolicy:
      'Timeline generation must distinguish sourced current-year deadlines from metadata/default heuristics before user-facing execution.',
    recommendedAction: 'add-deadline-source-review-gate-or-weak-state-output',
  },
  {
    id: 'timeline_essay_task_source_gate',
    priority: 'P0',
    consumer: 'timeline',
    surface: 'ApplicationTask essay prompt generation',
    files: ['apps/api/src/modules/timeline/timeline-application.service.ts'],
    fields: ['ApplicationTask.essayPrompt', 'EssayPromptSource.sourceUrl'],
    gateSignals: {
      source: ['sources: { some: { sourceUrl: { not: null } } }'],
      freshness: ['year', 'applicationYear'],
      conflict: ['status: VERIFIED', 'status: EssayStatus.VERIFIED'],
      weakState: ['补充文书', 'Common App Personal Statement'],
    },
    unsafeSignals: [
      {
        id: 'generic_school_essay_task',
        patterns: ['完成学校补充文书', 'essayCount || 1'],
        description:
          'Generic school essay tasks can appear without mapping to a source-backed EssayPrompt.',
      },
    ],
    requiredGates: ['source'],
    highRisk: true,
    consumerPolicy:
      'School-specific essay tasks need source-backed prompt linkage or an explicit generic weak-state label.',
    recommendedAction: 'link-generated-essay-tasks-to-source-backed-prompts',
  },
  {
    id: 'recommendation_school_meta_source_gate',
    priority: 'P0',
    consumer: 'recommendation',
    surface: 'recommendation schoolMeta and probability anchors',
    files: [
      'apps/api/src/modules/recommendation/recommendation.constants.ts',
      'apps/api/src/modules/recommendation/recommendation.service.ts',
    ],
    fields: [
      'School.acceptanceRate',
      'School.testingPolicy',
      'School.satAvg',
      'School.actAvg',
      'School.retentionRate',
    ],
    gateSignals: {
      source: [
        'resolveTrustedSchoolField',
        'getNormalizedFieldProvenance',
        'getRecommendationFieldSource',
        'normalizeSchoolProvenance',
        'toSchoolFieldSource',
        'predictionEligible',
        'trustTier',
        'fieldTrustWeights',
      ],
      freshness: ['staleness', 'fetchedAt', 'updatedAt'],
      conflict: ['conflict', 'reviewStatus', 'realDataStatus'],
      weakState: [
        'confidence',
        'sourceUrls',
        'N/A',
        'weakFields',
        'hidden_until_field_provenance_exists',
      ],
    },
    unsafeSignals: [
      {
        id: 'raw_school_meta_mapping',
        patterns: ['mapSchoolMeta', 'clampPercentRate(school.acceptanceRate)'],
        blockWhenMatched: true,
        description:
          'Recommendation response maps raw school facts without a field-level provenance gate.',
      },
      {
        id: 'raw_anchor_probability_facts',
        patterns: [
          'school.acceptanceRate != null',
          'satAvg: school.satAvg ?? undefined',
          'actAvg: school.actAvg ?? undefined',
          'graduationRate != null',
        ],
        blockWhenMatched: true,
        description:
          'Recommendation probability anchoring selects raw school facts before calculating statistics.',
      },
    ],
    requiredGates: ['source', 'freshness', 'conflict', 'weakState'],
    highRisk: true,
    consumerPolicy:
      'Recommendations should not use raw school anchors unless provenance, freshness, conflict, and weak-state support are explicit.',
    recommendedAction: 'reuse-school-provenance-gates-for-recommendation-meta',
  },
  {
    id: 'recommendation_essay_prompt_source_gate',
    priority: 'P0',
    consumer: 'recommendation',
    surface: 'recommendation essayPromptCount and hasWhySchool',
    files: ['apps/api/src/modules/recommendation/recommendation.service.ts'],
    fields: ['EssayPrompt.status', 'EssayPromptSource.sourceUrl'],
    gateSignals: {
      source: ['sources: { some: { sourceUrl: { not: null } } }'],
      freshness: ['year', 'applicationYear'],
      conflict: ['status: EssayStatus.VERIFIED'],
      weakState: ['essayPromptCount', 'hasWhySchool'],
    },
    unsafeSignals: [
      {
        id: 'verified_prompt_without_source_filter',
        patterns: ['status: EssayStatus.VERIFIED'],
        blockWhenMatched: true,
        description:
          'Recommendation essay enrichment counts VERIFIED prompts without requiring EssayPromptSource.sourceUrl.',
      },
    ],
    requiredGates: ['source'],
    highRisk: true,
    consumerPolicy:
      'Recommendation essay counts must use the same source-backed gate as public essay and timeline consumers.',
    recommendedAction: 'filter-recommendation-essay-enrichment-by-source-url',
  },
  {
    id: 'school_list_essay_count_source_gate',
    priority: 'P0',
    consumer: 'school-list',
    surface: 'school-list essayPromptCount',
    files: ['apps/api/src/modules/school-list/school-list.service.ts'],
    fields: ['EssayPrompt.status', 'EssayPromptSource.sourceUrl'],
    gateSignals: {
      source: ['sources: { some: { sourceUrl: { not: null } } }'],
      freshness: ['applicationYear', 'year'],
      conflict: ['status: EssayStatus.VERIFIED'],
      weakState: ['essayPromptCount'],
    },
    unsafeSignals: [
      {
        id: 'verified_prompt_count_without_source_filter',
        patterns: ['status: EssayStatus.VERIFIED'],
        blockWhenMatched: true,
        description:
          'School-list essayPromptCount can count VERIFIED prompts without sourceUrl evidence.',
      },
    ],
    requiredGates: ['source'],
    highRisk: true,
    consumerPolicy:
      'School-list essay counts must align with the source-backed essay prompt consumer gate.',
    recommendedAction: 'filter-school-list-essay-count-by-source-url',
  },
  {
    id: 'ai_school_tools_fact_source_gate',
    priority: 'P0',
    consumer: 'chat',
    surface: 'AI school details and school comparison tools',
    files: ['apps/api/src/modules/ai-agent/tools/school-tools.service.ts'],
    fields: [
      'School.acceptanceRate',
      'School.testingPolicy',
      'School.metadata.deadlines',
      'EssayPrompt.prompt',
    ],
    gateSignals: {
      source: ['sourceUrl: true', 'rankings', 'sources: { some'],
      freshness: ['year', 'updatedAt'],
      conflict: ['review', 'conflict'],
      weakState: ['N/A', 'annotateDeadlines'],
    },
    unsafeSignals: [
      {
        id: 'raw_acceptance_rate_in_chat',
        patterns: ['clampPercentRate(fullSchool.acceptanceRate)'],
        blockWhenMatched: true,
        description:
          'AI school details return raw acceptance rate without field provenance support.',
      },
      {
        id: 'metadata_deadlines_in_chat',
        patterns: ['metadata.deadlines || {}'],
        blockWhenMatched: true,
        description:
          'AI school details expose metadata deadlines without source/freshness review.',
      },
      {
        id: 'verified_prompts_without_source_in_chat',
        patterns: ["status: 'VERIFIED'"],
        blockWhenMatched: true,
        description:
          'AI school details return VERIFIED prompts without requiring sourceUrl evidence.',
      },
    ],
    requiredGates: ['source', 'weakState'],
    highRisk: true,
    consumerPolicy:
      'Chat tools should return sourced facts with weak-state labels, not raw school metadata or source-less prompts.',
    recommendedAction: 'add-source-backed-school-tool-presenters',
  },
  {
    id: 'ai_essay_tools_prompt_source_gate',
    priority: 'P0',
    consumer: 'chat',
    surface: 'AI essay prompt search and review context',
    files: ['apps/api/src/modules/ai-agent/tools/essay-tools.service.ts'],
    fields: ['EssayPrompt.prompt', 'EssayPromptSource.sourceUrl'],
    gateSignals: {
      source: ['sources: { some: { sourceUrl: { not: null } } }'],
      freshness: ['year'],
      conflict: ['status: VERIFIED', "status: 'VERIFIED'"],
      weakState: ['No matching essay prompts found'],
    },
    unsafeSignals: [
      {
        id: 'find_unique_prompt_context_without_source',
        patterns: ['essayPrompt.findUnique'],
        blockWhenMatched: true,
        description:
          'Essay review context can fetch an EssayPrompt by ID without checking source evidence.',
      },
      {
        id: 'search_verified_prompts_without_source',
        patterns: ["status: 'VERIFIED'"],
        blockWhenMatched: true,
        description:
          'AI prompt search can return VERIFIED prompts without sourceUrl evidence.',
      },
    ],
    requiredGates: ['source'],
    highRisk: true,
    consumerPolicy:
      'AI essay tools must not quote source-less verified prompts into chat or review context.',
    recommendedAction: 'source-gate-ai-essay-prompt-lookups',
  },
  {
    id: 'ai_timeline_deadline_source_gate',
    priority: 'P0',
    consumer: 'chat',
    surface: 'AI timeline deadline tool',
    files: ['apps/api/src/modules/ai-agent/tools/timeline-tools.service.ts'],
    fields: ['School.metadata.deadlines', 'SchoolDeadline.source'],
    gateSignals: {
      source: ['SchoolDeadline', 'sourceUrl', 'source'],
      freshness: ['year', 'eventDate'],
      conflict: ['review', 'conflict'],
      weakState: ['error', 'Please provide school IDs'],
    },
    unsafeSignals: [
      {
        id: 'metadata_deadlines_in_ai_timeline',
        patterns: ['metadata.deadlines || {}'],
        blockWhenMatched: true,
        description:
          'AI timeline deadline tool reads School.metadata.deadlines directly instead of sourced SchoolDeadline rows.',
      },
    ],
    requiredGates: ['source', 'freshness'],
    highRisk: true,
    consumerPolicy:
      'AI timeline tools must cite sourced current-year deadlines or return a review/unknown state.',
    recommendedAction: 'switch-ai-timeline-tool-to-sourced-school-deadlines',
  },
  {
    id: 'application_analysis_policy_evidence_gate',
    priority: 'P0',
    consumer: 'application-analysis',
    surface: 'application analysis policy card',
    files: [
      'apps/api/src/modules/profile/profile-application-analysis-v2.helpers.ts',
    ],
    fields: [
      'SchoolPolicyEvidence',
      'School.testingPolicy',
      'School.metadata.deadlines',
      'international aid policy',
    ],
    gateSignals: {
      source: ['ApprovedPolicyEvidence', 'sourceUrl', 'evidenceIds'],
      freshness: ['sourcePublishedAt', 'expiresAt'],
      conflict: ['unknowns', 'UNKNOWN'],
      weakState: [
        'policySourceQuality',
        'unknowns',
        'resolveFirstPartyRoundContext',
      ],
    },
    unsafeSignals: [
      {
        id: 'raw_policy_fallback',
        patterns: [
          'resolveSchoolTestingPolicy(item)',
          'resolveSchoolIntlAidPolicy(item, profile)',
          'resolveSchoolRoundContext(item, profile)',
        ],
        description:
          'Application analysis falls back to raw school policy fields when approved evidence is absent.',
      },
      {
        id: 'metadata_standard_deadline_fallback',
        patterns: ['readStringMetadata(metadata'],
        description:
          'Application analysis can emit standard deadlines from metadata without approved evidence.',
      },
    ],
    requiredGates: ['source', 'weakState'],
    highRisk: true,
    consumerPolicy:
      'Application analysis may use approved policy evidence directly; raw fallback facts must stay unknown/review or visibly weak-state.',
    recommendedAction: 'separate-approved-evidence-from-review-only-fallbacks',
  },
  {
    id: 'prediction_school_anchor_trust_gate',
    priority: 'P0',
    consumer: 'prediction',
    surface: 'prediction school anchor transformer',
    files: [
      'apps/api/src/modules/prediction/prediction-transformer.service.ts',
      'packages/shared/src/utils/school-provenance.ts',
      'apps/api/src/modules/school/school-provenance.helpers.ts',
    ],
    fields: [
      'School.acceptanceRate',
      'School.testingPolicy',
      'School.provenance',
      'TrustTier',
    ],
    gateSignals: {
      source: [
        'getNormalizedFieldProvenance',
        'normalizeFieldProvenance',
        'isPredictionEligibleTrustTier',
        'TRUST_TIER_PREDICTION_WEIGHT',
      ],
      freshness: [
        'staleness',
        'deriveProvenanceStaleness',
        "provenance.staleness === 'STALE'",
      ],
      conflict: [
        'realDataStatus',
        'MANUAL_REVIEW',
        'TERMINAL_REAL_DATA_STATUSES',
      ],
      weakState: [
        'fieldTrustWeights',
        'averagePredictionWeight',
        'return { value: undefined, weight }',
      ],
    },
    unsafeSignals: [
      {
        id: 'missing_provenance_allows_value',
        patterns: ['return { value: transform ? transform(value)'],
        description:
          'Prediction transformer allows raw values through when field provenance is absent.',
      },
      {
        id: 'heuristic_inferred_exception',
        patterns: ['isHeuristicFallback'],
        description:
          'Prediction transformer permits inferred heuristic values with weight instead of hard exclusion.',
      },
    ],
    requiredGates: ['source', 'freshness', 'weakState'],
    highRisk: true,
    consumerPolicy:
      'Prediction can use weighted sourced anchors, but missing provenance, stale values, and inferred heuristics need explicit policy review.',
    recommendedAction: 'harden-prediction-provenance-fallback-policy',
  },
];

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(REPORT_ROOT, `consumer-fact-safety-worklist-${stamp}.json`),
    )!,
  );
  return {
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

function main() {
  const args = parseArgs();
  const rows = SPECS.map(buildRow).sort(compareRows);
  const blockedRows = rows.filter((row) => row.rowState === 'blocked');
  const reviewRows = rows.filter((row) => row.rowState === 'review');
  const trustedRows = rows.filter((row) => row.rowState === 'trusted');
  const status: PacketStatus =
    blockedRows.length > 0
      ? 'BLOCKED_CONSUMER_FACT_SAFETY'
      : reviewRows.length > 0
        ? 'CONSUMER_FACT_SAFETY_REVIEW'
        : 'CONSUMER_FACT_SAFETY_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-consumer-fact-safety-worklist',
    status,
    destructiveWriteAllowedByThisPlan: false,
    runtimeConsumerChangesAllowedByThisPlan: false,
    summary: {
      totalRows: rows.length,
      trustedRows: trustedRows.length,
      reviewRows: reviewRows.length,
      blockedRows: blockedRows.length,
      highRiskRows: rows.filter((row) => row.highRisk).length,
      highRiskBlockedRows: blockedRows.filter((row) => row.highRisk).length,
      missingSourceGateRows: rows.filter((row) =>
        row.missingGates.includes('source'),
      ).length,
      missingFreshnessGateRows: rows.filter((row) =>
        row.missingGates.includes('freshness'),
      ).length,
      missingConflictGateRows: rows.filter((row) =>
        row.missingGates.includes('conflict'),
      ).length,
      missingWeakStateGateRows: rows.filter((row) =>
        row.missingGates.includes('weakState'),
      ).length,
      unsafeSignalRows: rows.filter((row) => row.unsafeSignals.length > 0)
        .length,
      byConsumer: countBy(rows, (row) => row.consumer),
      byState: countBy(rows, (row) => row.rowState),
      byMissingGate: countMissingGates(rows),
    },
    reviewContract: {
      readOnly: true,
      scope:
        'Static runtime consumer safety worklist for P0/P1 facts used by prediction, recommendation, essay, timeline, chat, school-list, and application analysis.',
      acceptedResolutionRequires: [
        'source/provenance gates are present for externally sourced facts',
        'freshness/cycle-year gates are present for cycle-sensitive facts',
        'conflict/review/terminal states prevent authoritative consumption',
        'weak-state or unknown state is visible when data support is incomplete',
      ],
      prohibitedActions: [
        'do not treat static detection as proof that runtime values are safe',
        'do not expose source-less essay prompts through chat, timeline, recommendation, or school-list counts',
        'do not use metadata/default deadline fallbacks as authoritative application deadlines',
        'do not use raw school anchors in prediction or recommendation without provenance policy',
      ],
    },
    nextCampaign: buildNextCampaign(blockedRows, reviewRows),
    rows,
  };
  writeReport(args, report);
  printSummary(args, report);
}

function buildRow(spec: ConsumerSpec): WorklistRow {
  const fileContents = spec.files.map((file) => {
    const fullPath = path.resolve(REPO_ROOT, file);
    return {
      file,
      fullPath,
      exists: fs.existsSync(fullPath),
      text: fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '',
    };
  });
  const missingFiles = fileContents
    .filter((file) => !file.exists)
    .map((file) => file.file);
  const gateHits = Object.fromEntries(
    (['source', 'freshness', 'conflict', 'weakState'] as GateName[]).map(
      (gate) => [
        gate,
        findPatternHits(fileContents, spec.gateSignals[gate] ?? []),
      ],
    ),
  ) as Record<GateName, SignalHit[]>;
  const gateStatus = Object.fromEntries(
    (['source', 'freshness', 'conflict', 'weakState'] as GateName[]).map(
      (gate) => [
        gate,
        spec.requiredGates.includes(gate)
          ? gateHits[gate].length > 0
            ? 'present'
            : 'missing'
          : gateHits[gate].length > 0
            ? 'present'
            : 'not_required',
      ],
    ),
  ) as Record<GateName, GateStatus>;
  const missingGates = spec.requiredGates.filter(
    (gate) => gateStatus[gate] === 'missing',
  );
  const unsafeSignals = spec.unsafeSignals
    .map((signal) => ({
      id: signal.id,
      description: signal.description,
      blockWhenMatched: Boolean(signal.blockWhenMatched),
      hits: findPatternHits(fileContents, signal.patterns),
    }))
    .filter((signal) => signal.hits.length > 0);
  const blockingUnsafe = unsafeSignals.some(
    (signal) => signal.blockWhenMatched,
  );
  const rowState: RowState =
    missingFiles.length > 0 ||
    (spec.highRisk && missingGates.includes('source')) ||
    blockingUnsafe
      ? 'blocked'
      : missingGates.length > 0 || unsafeSignals.length > 0
        ? 'review'
        : 'trusted';
  const severity: Severity =
    rowState === 'blocked'
      ? 'critical'
      : rowState === 'review'
        ? spec.priority === 'P0'
          ? 'warning'
          : 'info'
        : 'info';

  return {
    id: spec.id,
    priority: spec.priority,
    consumer: spec.consumer,
    surface: spec.surface,
    fields: spec.fields,
    rowState,
    severity,
    highRisk: spec.highRisk,
    gateStatus,
    missingGates,
    unsafeSignals,
    consumerPolicy: spec.consumerPolicy,
    recommendedAction:
      rowState === 'trusted' ? 'accept' : spec.recommendedAction,
    requiredEvidence: requiredEvidence(spec, missingGates),
    prohibitedActions: prohibitedActions(spec),
    evidence: {
      files: fileContents.map((file) => file.file),
      missingFiles,
      gateHits,
    },
  };
}

function findPatternHits(
  files: Array<{ file: string; text: string; exists: boolean }>,
  patterns: string[],
): SignalHit[] {
  const hits: SignalHit[] = [];
  for (const file of files) {
    if (!file.exists) continue;
    const lines = file.text.split('\n');
    for (const pattern of patterns) {
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.includes(pattern)) {
          hits.push({
            file: file.file,
            line: index + 1,
            signal: pattern,
            text: line.trim().slice(0, 220),
          });
        }
      }
    }
  }
  return hits;
}

function requiredEvidence(spec: ConsumerSpec, missingGates: GateName[]) {
  if (missingGates.length === 0) {
    return [
      'keep the existing source/freshness/conflict/weak-state gate covered by tests',
    ];
  }
  return missingGates.map((gate) => {
    if (gate === 'source') {
      return `${spec.consumer} ${spec.surface} must show source/provenance gate evidence for ${spec.fields.join(', ')}`;
    }
    if (gate === 'freshness') {
      return `${spec.consumer} ${spec.surface} must check cycle year, fetchedAt, expiresAt, or staleness before authoritative use`;
    }
    if (gate === 'conflict') {
      return `${spec.consumer} ${spec.surface} must respect review/conflict/terminal disposition before authoritative use`;
    }
    return `${spec.consumer} ${spec.surface} must expose weak/unknown/confidence state when support is incomplete`;
  });
}

function prohibitedActions(spec: ConsumerSpec) {
  return [
    `do not mark ${spec.surface} closed solely because ${spec.fields.join(', ')} values exist`,
    'do not replace source gates with comments or UI-only copy',
    'do not write DB facts from this static worklist',
  ];
}

function buildNextCampaign(
  blockedRows: WorklistRow[],
  reviewRows: WorklistRow[],
) {
  const row = blockedRows[0] ?? reviewRows[0] ?? null;
  if (!row) {
    return {
      id: 'consumer_fact_safety_accept',
      reason:
        'All configured P0/P1 runtime consumer fact-safety checks are trusted.',
    };
  }
  return {
    id: 'consumer_fact_safety_runtime_gate',
    reason: `${row.consumer} ${row.surface} has ${row.rowState} fact-safety row ${row.id}; first action: ${row.recommendedAction}.`,
    firstRowId: row.id,
    consumer: row.consumer,
    surface: row.surface,
    rowState: row.rowState,
    missingGates: row.missingGates,
    unsafeSignals: row.unsafeSignals.map((signal) => signal.id),
    recommendedAction: row.recommendedAction,
  };
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = (report.rows ?? []) as WorklistRow[];
  return [
    '# Consumer Fact Safety Worklist',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total rows: ${report.summary.totalRows}`,
    `- Trusted rows: ${report.summary.trustedRows}`,
    `- Review rows: ${report.summary.reviewRows}`,
    `- Blocked rows: ${report.summary.blockedRows}`,
    `- Missing source gate rows: ${report.summary.missingSourceGateRows}`,
    `- Missing freshness gate rows: ${report.summary.missingFreshnessGateRows}`,
    `- Missing conflict gate rows: ${report.summary.missingConflictGateRows}`,
    `- Unsafe signal rows: ${report.summary.unsafeSignalRows}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign?.reason ?? 'none'}`,
    '',
    '## Rows',
    '',
    '| Row | State | Consumer | Surface | Missing gates | Unsafe signals | Recommended action |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${escapeMarkdown(row.id)} | ${row.rowState} | ${escapeMarkdown(row.consumer)} | ${escapeMarkdown(row.surface)} | ${row.missingGates.join('; ') || 'none'} | ${row.unsafeSignals.map((signal) => signal.id).join('; ') || 'none'} | ${escapeMarkdown(row.recommendedAction)} |`,
    ),
    '',
  ].join('\n');
}

function renderCsv(rows: WorklistRow[]) {
  const header = [
    'id',
    'priority',
    'consumer',
    'surface',
    'rowState',
    'severity',
    'fields',
    'missingGates',
    'unsafeSignals',
    'recommendedAction',
    'consumerPolicy',
  ];
  const body = rows.map((row) =>
    [
      row.id,
      row.priority,
      row.consumer,
      row.surface,
      row.rowState,
      row.severity,
      row.fields.join('; '),
      row.missingGates.join('; '),
      row.unsafeSignals.map((signal) => signal.id).join('; '),
      row.recommendedAction,
      row.consumerPolicy,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...body].join('\n')}\n`;
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        totalRows: report.summary.totalRows,
        trustedRows: report.summary.trustedRows,
        reviewRows: report.summary.reviewRows,
        blockedRows: report.summary.blockedRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

function countBy<T>(rows: T[], keyFn: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function countMissingGates(rows: WorklistRow[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const gate of row.missingGates) counts[gate] = (counts[gate] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
}

function compareRows(a: WorklistRow, b: WorklistRow) {
  const stateScore: Record<RowState, number> = {
    blocked: 3,
    review: 2,
    trusted: 1,
  };
  const priorityScore = { P0: 2, P1: 1 };
  return (
    stateScore[b.rowState] - stateScore[a.rowState] ||
    priorityScore[b.priority] - priorityScore[a.priority] ||
    Number(b.highRisk) - Number(a.highRisk) ||
    a.consumer.localeCompare(b.consumer) ||
    a.id.localeCompare(b.id)
  );
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

main();
