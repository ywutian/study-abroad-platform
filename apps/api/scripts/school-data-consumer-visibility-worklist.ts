#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FULL_FIELD_AUDIT_SPECS } from './lib/field-source-matrix';

type VisibilityStatus = 'PASS' | 'REVIEW';
type RowStatus = 'ACCEPTED' | 'REVIEW';
type Severity = 'critical' | 'warning' | 'info';

interface Args {
  out: string;
  markdown: string;
  maxFiles: number;
  maxFileBytes: number;
}

interface SurfaceSpec {
  id: string;
  label: string;
  priority: 'P0' | 'P1' | 'P2';
  roots: string[];
  expectedFields: string[];
  highRiskConsumer: boolean;
}

interface FieldRule {
  field: string;
  priority: 'P0' | 'P1' | 'P2';
  externallySourced: boolean;
}

interface FileHit {
  file: string;
  fieldMentions: number;
  provenanceMentions: number;
  weakStateMentions: number;
}

interface WorklistRow {
  domain: 'school_data_consumer_visibility';
  severity: Severity;
  status: RowStatus;
  action: 'accept' | 'review-consumer-visibility' | 'add-consumer-reference';
  blocker:
    | 'none'
    | 'missing_consumer_reference'
    | 'missing_provenance_visibility'
    | 'missing_weak_state_visibility';
  field: string;
  fieldPriority: 'P0' | 'P1' | 'P2';
  surfaceId: string;
  surfaceLabel: string;
  surfacePriority: 'P0' | 'P1' | 'P2';
  highRiskConsumer: boolean;
  counts: {
    scannedFiles: number;
    fieldFiles: number;
    fieldMentions: number;
    provenanceFiles: number;
    weakStateFiles: number;
  };
  evidence: {
    files: FileHit[];
    provenanceSignals: string[];
    weakStateSignals: string[];
  };
  rationale: string;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
]);
const PROVENANCE_SIGNALS = [
  'provenance',
  'sourceUrl',
  'sourceQuality',
  'trustTier',
  'verifiedAt',
  'verifiedBy',
  'dataSupport',
  'sourceLabel',
  'source',
];
const WEAK_STATE_SIGNALS = [
  'unknown',
  'fallback',
  'missing',
  'unavailable',
  'confidence',
  'confidenceReason',
  'dataSupport',
  'N/A',
  'not available',
  'weak',
];
const FIELD_ALIASES: Record<string, string[]> = {
  cdsAdmitBands: ['cdsAdmitBands', 'SchoolCdsAdmitBand', 'cds band'],
  programRates: [
    'programRates',
    'SchoolProgram',
    'acceptanceRateEstimate',
    'program selectivity',
  ],
  deadlines: ['deadlines', 'SchoolDeadline', 'ApplicationTask'],
  essayPrompts: ['essayPrompts', 'EssayPrompt', 'SchoolEssaySource'],
  campusCover: ['campusCover', 'SchoolMediaAsset', 'CAMPUS_COVER'],
  needBlindInternational: ['needBlindInternational', 'need-blind'],
};
const P0_FIELDS = new Set([
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'transferAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
  'sat25',
  'sat75',
  'satAvg',
  'satMath25',
  'satMath75',
  'satReading25',
  'satReading75',
  'act25',
  'act75',
  'actAvg',
  'gpaDistribution',
  'cdsAdmitBands',
  'testingPolicy',
  'testOptional',
  'needBlindInternational',
  'deadlines',
  'essayPrompts',
]);
const EXTRA_FIELD_RULES: FieldRule[] = [
  {
    field: 'needBlindInternational',
    priority: 'P0',
    externallySourced: true,
  },
  {
    field: 'campusCover',
    priority: 'P1',
    externallySourced: true,
  },
];
const SURFACES: SurfaceSpec[] = [
  {
    id: 'api_school_detail',
    label: 'API school detail/search/admin data-health surface',
    priority: 'P0',
    roots: ['apps/api/src/modules/school'],
    expectedFields: [
      'acceptanceRate',
      'intlAcceptanceRate',
      'sat25',
      'sat75',
      'act25',
      'act75',
      'gpaDistribution',
      'testingPolicy',
      'testOptional',
      'deadlines',
      'essayPrompts',
      'programRates',
      'campusCover',
    ],
    highRiskConsumer: false,
  },
  {
    id: 'prediction_engine',
    label: 'Prediction engine and statistical/counselor surfaces',
    priority: 'P0',
    roots: ['apps/api/src/modules/prediction', 'packages/shared/src/scoring'],
    expectedFields: [
      'acceptanceRate',
      'intlAcceptanceRate',
      'oosAcceptanceRate',
      'transferAcceptanceRate',
      'edAcceptanceRate',
      'eaAcceptanceRate',
      'sat25',
      'sat75',
      'act25',
      'act75',
      'gpaDistribution',
      'cdsAdmitBands',
      'testingPolicy',
      'needBlindInternational',
      'programRates',
    ],
    highRiskConsumer: true,
  },
  {
    id: 'web_school_pages',
    label: 'Web school search/detail/recommendation cards',
    priority: 'P0',
    roots: [
      'apps/web/src/app/[locale]/(main)/schools',
      'apps/web/src/components/features/schools',
      'apps/web/src/components/features/school-selector.tsx',
    ],
    expectedFields: [
      'acceptanceRate',
      'sat25',
      'sat75',
      'testingPolicy',
      'deadlines',
      'essayPrompts',
      'tuition',
      'averageNetPrice',
      'graduationRate',
      'studentFacultyRatio',
      'description',
      'campusCover',
    ],
    highRiskConsumer: false,
  },
  {
    id: 'web_prediction_results',
    label: 'Web prediction result and AI context surfaces',
    priority: 'P0',
    roots: [
      'apps/web/src/components/features/prediction',
      'apps/web/src/hooks/use-prediction.ts',
    ],
    expectedFields: [
      'acceptanceRate',
      'intlAcceptanceRate',
      'sat25',
      'sat75',
      'act25',
      'act75',
      'testingPolicy',
      'needBlindInternational',
    ],
    highRiskConsumer: true,
  },
  {
    id: 'essay_ai_context',
    label: 'Essay AI school-context surface',
    priority: 'P0',
    roots: ['apps/api/src/modules/essay'],
    expectedFields: ['acceptanceRate', 'testingPolicy', 'essayPrompts'],
    highRiskConsumer: true,
  },
  {
    id: 'agent_chat_context',
    label: 'Agent chat context and school recommendation cards',
    priority: 'P1',
    roots: [
      'apps/api/src/modules/ai',
      'apps/api/src/modules/ai-agent',
      'apps/web/src/components/features/agent-chat',
      'apps/web/src/app/[locale]/(main)/chat',
    ],
    expectedFields: [
      'acceptanceRate',
      'testingPolicy',
      'deadlines',
      'essayPrompts',
      'programRates',
      'campusCover',
    ],
    highRiskConsumer: true,
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
      path.join(REPORT_ROOT, `school-data-consumer-visibility-${stamp}.json`),
    )!,
  );
  return {
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    maxFiles: Number(get('--max-files', '5000')),
    maxFileBytes: Number(get('--max-file-bytes', `${1024 * 1024}`)),
  };
}

function main() {
  const args = parseArgs();
  const fieldRules = buildFieldRules();
  const filesBySurface = Object.fromEntries(
    SURFACES.map((surface) => [surface.id, collectSurfaceFiles(surface, args)]),
  ) as Record<string, string[]>;
  const rows = SURFACES.flatMap((surface) =>
    surface.expectedFields.map((field) =>
      inspectFieldSurface(
        field,
        fieldRules.get(field) ?? {
          field,
          priority: 'P1',
          externallySourced: true,
        },
        surface,
        filesBySurface[surface.id] ?? [],
      ),
    ),
  ).sort(compareRows);
  const summary = buildSummary(rows);
  const status: VisibilityStatus =
    summary.reviewRows > 0 || summary.missingConsumerReferences > 0
      ? 'REVIEW'
      : 'PASS';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-school-data-consumer-visibility-worklist',
    status,
    nextAction: status === 'PASS' ? 'accept' : 'review',
    destructiveWriteAllowedByThisPlan: false,
    summary,
    surfaces: SURFACES.map((surface) => ({
      id: surface.id,
      label: surface.label,
      priority: surface.priority,
      highRiskConsumer: surface.highRiskConsumer,
      roots: surface.roots,
      scannedFiles: filesBySurface[surface.id]?.length ?? 0,
      expectedFields: surface.expectedFields,
    })),
    rows,
    recommendedSequence: buildRecommendedSequence(status, summary),
    nextCampaign: buildNextCampaign(status, summary),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  printSummary(args.out, args.markdown, report);
}

function buildFieldRules() {
  const rules = new Map<string, FieldRule>();
  for (const spec of FULL_FIELD_AUDIT_SPECS) {
    rules.set(spec.key, {
      field: spec.key,
      priority: P0_FIELDS.has(spec.key)
        ? 'P0'
        : spec.userGenerated
          ? 'P2'
          : 'P1',
      externallySourced: !spec.userGenerated,
    });
  }
  for (const rule of EXTRA_FIELD_RULES) rules.set(rule.field, rule);
  return rules;
}

function collectSurfaceFiles(surface: SurfaceSpec, args: Args) {
  const files: string[] = [];
  for (const root of surface.roots) {
    const absolute = path.resolve(REPO_ROOT, root);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
      if (isReadableCodeFile(absolute, args)) files.push(absolute);
      continue;
    }
    for (const file of collectFiles(absolute, args)) {
      files.push(file);
      if (files.length >= args.maxFiles) return files;
    }
  }
  return files;
}

function inspectFieldSurface(
  field: string,
  fieldRule: FieldRule,
  surface: SurfaceSpec,
  files: string[],
): WorklistRow {
  const aliases = [field, ...(FIELD_ALIASES[field] ?? [])];
  const hits = files.flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const fieldMentions = countSignals(text, aliases);
    if (fieldMentions === 0) return [];
    return [
      {
        file: path.relative(REPO_ROOT, file),
        fieldMentions,
        provenanceMentions: countSignals(text, PROVENANCE_SIGNALS),
        weakStateMentions: countSignals(text, WEAK_STATE_SIGNALS),
      },
    ];
  });
  const fieldMentions = hits.reduce((sum, hit) => sum + hit.fieldMentions, 0);
  const provenanceFiles = hits.filter((hit) => hit.provenanceMentions > 0);
  const weakStateFiles = hits.filter((hit) => hit.weakStateMentions > 0);
  const blocker = chooseBlocker({
    fieldRule,
    surface,
    hits,
    provenanceFiles,
    weakStateFiles,
  });
  const status: RowStatus = blocker === 'none' ? 'ACCEPTED' : 'REVIEW';
  const severity = chooseSeverity(fieldRule, surface, blocker);
  return {
    domain: 'school_data_consumer_visibility',
    severity,
    status,
    action:
      blocker === 'none'
        ? 'accept'
        : blocker === 'missing_consumer_reference'
          ? 'add-consumer-reference'
          : 'review-consumer-visibility',
    blocker,
    field,
    fieldPriority: fieldRule.priority,
    surfaceId: surface.id,
    surfaceLabel: surface.label,
    surfacePriority: surface.priority,
    highRiskConsumer: surface.highRiskConsumer,
    counts: {
      scannedFiles: files.length,
      fieldFiles: hits.length,
      fieldMentions,
      provenanceFiles: provenanceFiles.length,
      weakStateFiles: weakStateFiles.length,
    },
    evidence: {
      files: hits.slice(0, 20),
      provenanceSignals: PROVENANCE_SIGNALS,
      weakStateSignals: WEAK_STATE_SIGNALS,
    },
    rationale: buildRationale(field, surface, blocker),
  };
}

function chooseBlocker(input: {
  fieldRule: FieldRule;
  surface: SurfaceSpec;
  hits: FileHit[];
  provenanceFiles: FileHit[];
  weakStateFiles: FileHit[];
}): WorklistRow['blocker'] {
  if (input.hits.length === 0) return 'missing_consumer_reference';
  if (input.fieldRule.externallySourced && input.provenanceFiles.length === 0) {
    return 'missing_provenance_visibility';
  }
  if (input.surface.highRiskConsumer && input.weakStateFiles.length === 0) {
    return 'missing_weak_state_visibility';
  }
  return 'none';
}

function chooseSeverity(
  fieldRule: FieldRule,
  surface: SurfaceSpec,
  blocker: WorklistRow['blocker'],
): Severity {
  if (blocker === 'none') return 'info';
  if (fieldRule.priority === 'P0' && surface.priority === 'P0') {
    return surface.highRiskConsumer || blocker === 'missing_consumer_reference'
      ? 'critical'
      : 'warning';
  }
  return 'warning';
}

function buildRationale(
  field: string,
  surface: SurfaceSpec,
  blocker: WorklistRow['blocker'],
) {
  if (blocker === 'none') {
    return `${field} has a code reference plus provenance or weak-state visibility signals in ${surface.label}.`;
  }
  if (blocker === 'missing_consumer_reference') {
    return `${field} is expected for ${surface.label}, but no static code reference was found.`;
  }
  if (blocker === 'missing_provenance_visibility') {
    return `${field} is referenced in ${surface.label}, but the matching files do not include source/provenance visibility terms.`;
  }
  return `${field} is referenced in high-risk consumer ${surface.label}, but the matching files do not include weak-state/confidence terms.`;
}

function buildSummary(rows: WorklistRow[]) {
  const reviewRows = rows.filter((row) => row.status === 'REVIEW');
  const criticalRows = reviewRows.filter((row) => row.severity === 'critical');
  return {
    surfaces: SURFACES.length,
    fields: new Set(rows.map((row) => row.field)).size,
    rows: rows.length,
    acceptedRows: rows.length - reviewRows.length,
    reviewRows: reviewRows.length,
    criticalReviewRows: criticalRows.length,
    missingConsumerReferences: rows.filter(
      (row) => row.blocker === 'missing_consumer_reference',
    ).length,
    missingProvenanceVisibility: rows.filter(
      (row) => row.blocker === 'missing_provenance_visibility',
    ).length,
    missingWeakStateVisibility: rows.filter(
      (row) => row.blocker === 'missing_weak_state_visibility',
    ).length,
    highRiskReviewRows: reviewRows.filter((row) => row.highRiskConsumer).length,
    p0ReviewRows: reviewRows.filter((row) => row.fieldPriority === 'P0').length,
  };
}

function buildRecommendedSequence(
  status: VisibilityStatus,
  summary: ReturnType<typeof buildSummary>,
) {
  if (status === 'PASS') {
    return [
      'Keep this report attached to the platform closure audit as consumer evidence.',
      'Continue with DB-backed school data coverage once schema compatibility clears.',
    ];
  }
  return [
    'Review critical P0 rows first, especially prediction, essay AI, web prediction, and chat context consumers.',
    'For missing consumer references, confirm whether the field should be exposed or explicitly terminal for that surface.',
    'For missing provenance visibility, add source/provenance/support labels to the surface or route the row to admin review.',
    `Current review load: ${summary.reviewRows} rows, including ${summary.criticalReviewRows} critical rows.`,
  ];
}

function buildNextCampaign(
  status: VisibilityStatus,
  summary: ReturnType<typeof buildSummary>,
) {
  if (status === 'PASS') {
    return {
      id: 'school_data_coverage_backfill',
      reason:
        'Consumer visibility has static evidence; continue field coverage and provenance closure.',
    };
  }
  if (summary.criticalReviewRows > 0) {
    return {
      id: 'school_data_consumer_visibility_p0_review',
      reason:
        'Critical school data consumers lack either references, provenance visibility, or weak-state visibility.',
    };
  }
  return {
    id: 'school_data_consumer_visibility_review',
    reason:
      'School data consumer visibility has review rows that should be triaged before declaring closure.',
  };
}

function renderMarkdown(report: {
  generatedAt: string;
  status: VisibilityStatus;
  summary: ReturnType<typeof buildSummary>;
  rows: WorklistRow[];
  recommendedSequence: string[];
}) {
  const topRows = report.rows
    .filter((row) => row.status === 'REVIEW')
    .slice(0, 30);
  const lines = [
    '# School Data Consumer Visibility Worklist',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    ...Object.entries(report.summary).map(
      ([key, value]) => `- ${key}: ${value}`,
    ),
    '',
    '## Recommended Sequence',
    '',
    ...report.recommendedSequence.map((step) => `- ${step}`),
    '',
    '## Top Review Rows',
    '',
    ...topRows.map(
      (row) =>
        `- ${row.severity} ${row.surfaceId}.${row.field}: ${row.blocker} (${row.counts.fieldFiles} files)`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function compareRows(a: WorklistRow, b: WorklistRow) {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    statusWeight(b.status) - statusWeight(a.status) ||
    a.surfaceId.localeCompare(b.surfaceId) ||
    a.field.localeCompare(b.field)
  );
}

function severityWeight(severity: Severity) {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function statusWeight(status: RowStatus) {
  return status === 'REVIEW' ? 2 : 1;
}

function collectFiles(root: string, args: Args): string[] {
  const skipNames = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
  ]);
  const files: string[] = [];
  const entries = safeReadDir(root);
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(filePath, args));
    } else if (isReadableCodeFile(filePath, args)) {
      files.push(filePath);
    }
  }
  return files;
}

function isReadableCodeFile(file: string, args: Args) {
  const stat = safeStat(file);
  return Boolean(
    stat?.isFile() &&
    stat.size <= args.maxFileBytes &&
    CODE_EXTENSIONS.has(path.extname(file)),
  );
}

function countSignals(text: string, signals: string[]) {
  return signals.reduce((sum, signal) => {
    const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary =
      /^[A-Za-z0-9_]+$/.test(signal) && signal.length > 2 ? '\\b' : '';
    const regex = new RegExp(`${boundary}${escaped}${boundary}`, 'gi');
    return sum + (text.match(regex)?.length ?? 0);
  }, 0);
}

function safeReadDir(root: string) {
  try {
    return fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeStat(file: string) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

function printSummary(
  out: string,
  markdown: string,
  report: {
    status: VisibilityStatus;
    summary: ReturnType<typeof buildSummary>;
  },
) {
  console.log(`School data consumer visibility status: ${report.status}`);
  console.log(`Rows: ${report.summary.rows}`);
  console.log(`Review rows: ${report.summary.reviewRows}`);
  console.log(`Critical review rows: ${report.summary.criticalReviewRows}`);
  console.log(`JSON: ${out}`);
  console.log(`Markdown: ${markdown}`);
}

main();
