import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const REVIEW_VERSION = '2026-04-05.v1';
const CHECKLIST_PATH = 'docs/PREDICTION_V5_REVIEW_CHECKLIST.md';
const RESEARCH_REPORT_PATH = 'docs/PREDICTION_V5_RESEARCH_REPORT.md';
const ADR_PATH = 'docs/adr/0016-prediction-ml-primary-architecture.md';

type Verdict = 'PENDING' | 'GO' | 'CONDITIONAL' | 'HOLD';
type ValidationStatus = 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED';
type IssueStatus = 'CONFIRMED' | 'UNVERIFIED' | 'NOT_IMPLEMENTED' | 'DOC_MISMATCH';
type Severity = 'P0' | 'P1' | 'P2' | 'P3';

interface AgentDefinition {
  id: string;
  wave: 1 | 2;
  focus: string;
  checklistIds: string[];
  scope: string;
}

interface ValidationCommandDefinition {
  id: string;
  label: string;
  command: string;
}

interface ValidationCommandResult extends ValidationCommandDefinition {
  logPath: string;
  status: ValidationStatus;
  exitCode: number | null;
  startedAt?: string;
  finishedAt?: string;
}

interface Manifest {
  reviewVersion: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
  timezone: string;
  reviewRoot: string;
  summaryDoc: string;
  issueDirectory: string;
  issueIndex: string;
  summaryPath: string;
  codexRunPlanPath: string;
  checklistPath: string;
  researchReportPath: string;
  adrPath: string;
  verdict: Verdict;
  defaultDimensionStatus: Record<string, 'PENDING' | 'PASS' | 'ISSUE'>;
  agents: Array<AgentDefinition & { notePath: string; briefPath: string }>;
  validation: ValidationCommandResult[];
}

interface IssueMetadata {
  title: string;
  severity: Severity;
  status: IssueStatus;
  checklist_ids: string[];
  impacted_paths: string[];
  reported_by_agent: string;
  corroborated_by: string[];
  confidence: number;
}

interface ParsedIssue extends IssueMetadata {
  filePath: string;
  relativePath: string;
}

interface CliCommand {
  command: 'init' | 'validate' | 'refresh-summary' | 'create-issue';
  values: Map<string, string>;
}

const WAVE_1_AGENTS: AgentDefinition[] = [
  {
    id: 'math-logodds-reviewer',
    wave: 1,
    focus: 'A1、A3、Tier 0 融合公式、极端值行为',
    checklistIds: ['A1', 'A3', 'A4'],
    scope:
      'shared score/log-odds utilities, hook modifier math, cold-start fusion, extreme input behavior',
  },
  {
    id: 'calibration-spike-reviewer',
    wave: 1,
    focus: 'A2、A5、校准接线、beta-calibration / spike-coherence 是否真正进入主链路',
    checklistIds: ['A2', 'A5'],
    scope:
      'beta calibration helpers, spike coherence helper, calibration service wiring, dead-code vs live-path confirmation',
  },
  {
    id: 'pipeline-flag-cache-reviewer',
    wave: 1,
    focus: 'B1、B2、E1、E3，覆盖 feature flag、shadow、engineMode 缓存隔离',
    checklistIds: ['B1', 'B2', 'E1', 'E3'],
    scope:
      'PredictionService orchestration, feature flag lookups, shadow fallback, cache key separation, validation of query placement',
  },
  {
    id: 'output-persistence-reviewer',
    wave: 1,
    focus: 'B3、B4，覆盖 servedTrace、hook redaction、result shape、reporting/persistence',
    checklistIds: ['B3', 'B4'],
    scope:
      'reportActualResult, persistence, servedTrace, public hook redaction, result completeness, snapshot consistency',
  },
  {
    id: 'security-privacy-reviewer',
    wave: 1,
    focus: 'C1-C5，覆盖 hook 注入、隐私、LLM explanation、限流、flag 权限',
    checklistIds: ['C1', 'C2', 'C3', 'C4', 'C5'],
    scope:
      'hard-coded hook coefficients, public/private field boundaries, LLM prompt isolation, throttle, admin feature flag access',
  },
  {
    id: 'dto-shared-reviewer',
    wave: 1,
    focus: 'D1、D3，覆盖 DTO/shared types 同步和 backward compatibility',
    checklistIds: ['D1', 'D3'],
    scope:
      'PredictionResultDto, shared prediction types, optional field compatibility, type drift between API and shared package',
  },
  {
    id: 'agent-tool-reviewer',
    wave: 1,
    focus: 'D2，覆盖 analyze_admission_chance、tool config、兼容字段依赖',
    checklistIds: ['D2'],
    scope:
      'AI agent tool consumers, recommendation tools, tool config/docs, required prediction fields for analyze_admission_chance',
  },
  {
    id: 'web-consumer-reviewer',
    wave: 1,
    focus: 'web hooks/components/admin calibration UI 的 prediction 消费',
    checklistIds: ['D1', 'D3', 'D4'],
    scope:
      'web prediction hooks/components/admin prediction surfaces and whether new optional fields stay backward compatible',
  },
  {
    id: 'mobile-consumer-reviewer',
    wave: 1,
    focus: 'mobile service/screen/test 的 prediction 消费和报结果路径',
    checklistIds: ['D4'],
    scope:
      'mobile prediction service, screen, tests, dashboard consumption, report-result path compatibility',
  },
  {
    id: 'workflow-docs-reviewer',
    wave: 1,
    focus:
      'prediction policy/shadow/workflow/admin rollout，以及 checklist/ADR/research 与代码一致性',
    checklistIds: ['B1', 'B3', 'C5', 'E2', 'F1', 'F2'],
    scope:
      'prediction policy/shadow/workflow/admin rollout, doc/code mismatches, claimed-vs-implemented checks, rollout safety',
  },
];

const WAVE_2_AGENTS: AgentDefinition[] = [
  {
    id: 'repro-reviewer',
    wave: 2,
    focus: '对 Wave 1 中分歧最大的 2-3 个 finding 做复核',
    checklistIds: [],
    scope: 'targeted repro and cross-agent dispute resolution for the highest-risk findings',
  },
  {
    id: 'gap-triage-reviewer',
    wave: 2,
    focus: '专门确认 NOT_IMPLEMENTED 和 DOC_MISMATCH 是否应升级 severity',
    checklistIds: [],
    scope:
      'severity escalation for gaps between code and documents, especially dead code, disconnected features, and rollout blockers',
  },
];

const VALIDATION_COMMANDS: ValidationCommandDefinition[] = [
  {
    id: 'api-prediction-jest',
    label: 'API prediction jest suites',
    command: 'pnpm --filter api test -- --runInBand prediction',
  },
  {
    id: 'api-typecheck',
    label: 'API typecheck',
    command: 'pnpm --filter api exec tsc --noEmit --project tsconfig.build.json',
  },
  {
    id: 'web-typecheck',
    label: 'Web typecheck',
    command: 'pnpm --filter web exec tsc --noEmit',
  },
  {
    id: 'mobile-typecheck',
    label: 'Mobile typecheck',
    command: 'pnpm --filter study-abroad-mobile exec tsc --noEmit',
  },
  {
    id: 'mobile-prediction-jest',
    label: 'Mobile prediction jest',
    command: 'pnpm --filter study-abroad-mobile test -- --runInBand prediction',
  },
  {
    id: 'lint-integration',
    label: 'Repo integration lint',
    command: 'pnpm lint:integration',
  },
];

function parseCli(argv: string[]): CliCommand {
  const [rawCommand, ...remaining] = argv;
  const hasNamedCommand =
    rawCommand === 'init' ||
    rawCommand === 'validate' ||
    rawCommand === 'refresh-summary' ||
    rawCommand === 'create-issue';
  const command =
    rawCommand === 'validate' || rawCommand === 'refresh-summary' || rawCommand === 'create-issue'
      ? rawCommand
      : 'init';
  const rest = hasNamedCommand ? remaining : argv;

  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return { command, values };
}

function getNowIso() {
  return new Date().toISOString();
}

function getTimezone(values: Map<string, string>) {
  return (
    values.get('timezone') ??
    process.env.TZ ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'America/Los_Angeles'
  );
}

function formatRunId(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}-${values.hour}${values.minute}`;
}

function resolveRunId(values: Map<string, string>) {
  const timezone = getTimezone(values);
  return values.get('run-id') ?? formatRunId(new Date(), timezone);
}

function resolveReviewRoot(runId: string, values: Map<string, string>) {
  return path.resolve(
    ROOT,
    values.get('run-root') ?? path.join('e2e-report', `prediction-v5-review-${runId}`)
  );
}

function resolveSummaryDoc(runId: string, values: Map<string, string>) {
  const reviewDate = runId.slice(0, 10);
  return path.resolve(
    ROOT,
    values.get('summary-doc') ??
      path.join('docs', `PREDICTION_V5_MULTI_AGENT_REVIEW_${reviewDate}.md`)
  );
}

function toRelative(filePath: string) {
  const relative = path.relative(ROOT, filePath);
  return relative.length > 0 ? relative : '.';
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeText(filePath: string, contents: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

async function writeJson(filePath: string, value: unknown) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeExecutable(filePath: string, contents: string) {
  await writeText(filePath, contents);
  await fs.chmod(filePath, 0o755);
}

async function loadManifest(runRoot: string) {
  const filePath = path.join(runRoot, 'manifest.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as Manifest;
}

async function saveManifest(manifest: Manifest) {
  manifest.updatedAt = getNowIso();
  await writeJson(path.join(manifest.reviewRoot, 'manifest.json'), manifest);
}

function renderAgentNote(agent: AgentDefinition, runRoot: string) {
  return `# ${agent.id}

> Raw findings stub for the coordinator-owned prediction v5 review run.

## Metadata

| Field | Value |
| --- | --- |
| \`agent_id\` | \`${agent.id}\` |
| \`wave\` | \`${agent.wave}\` |
| \`review_root\` | \`${toRelative(runRoot)}\` |
| \`focus\` | ${agent.focus} |
| \`checklist_ids\` | ${agent.checklistIds.length > 0 ? agent.checklistIds.map((id) => `\`${id}\``).join(', ') : '-'} |

## Covered IDs

- 

## Findings

- 

## PASS Items

- 

## UNVERIFIED Items

- 

## Commands Run

- 

## Open Questions

- 
`;
}

function renderAgentBrief(agent: AgentDefinition, runRoot: string) {
  return `# ${agent.id}

## Role

- Wave: \`${agent.wave}\`
- Focus: ${agent.focus}
- Scope: ${agent.scope}
- Review root: \`${toRelative(runRoot)}\`

## Rules

- Only report bugs, risks, regressions, \`NOT_IMPLEMENTED\`, or \`DOC_MISMATCH\`.
- Do not report generic refactor ideas or style comments.
- Distinguish clearly between:
  - implemented and live
  - implemented but disconnected
  - documented but missing
  - unverified because evidence is insufficient
- Treat \`beta-calibration\`, \`spike-coherence\`, \`quotaDisclosure\`, and \`generateExplanation()\` as non-pass if they are not wired into the served path.

## Required Output Format

- Covered IDs
- Findings
- PASS Items
- UNVERIFIED Items
- Commands Run
- Open Questions

Write the raw result into:

- \`agent-notes/${agent.id}.md\`

If you identify a canonical issue, the coordinator should create a file under:

- \`issues/<severity>__<checklist-id>__<slug>.md\`
`;
}

function renderValidationReadme(validation: ValidationCommandResult[]) {
  return `# Validation Logs

> This directory stores raw command output for the prediction v5 multi-agent review.

## Commands

${validation
  .map((item) => `- \`${item.id}\` -> \`${item.command}\` -> \`${item.logPath}\``)
  .join('\n')}
`;
}

function renderIssueTemplate(metadata: IssueMetadata) {
  return `<!-- prediction-v5-issue
${JSON.stringify(metadata, null, 2)}
-->
# ${metadata.title}

## Impacted Paths

${metadata.impacted_paths.length > 0 ? metadata.impacted_paths.map((item) => `- ${item}`).join('\n') : '- '}

## Evidence

- 

## Why It Matters


## Repro Or Verification

- 

## Suggested Fix

- 
`;
}

function renderIssueIndex(runId: string, issues: ParsedIssue[]) {
  const confirmed = issues.filter((issue) => issue.status === 'CONFIRMED');
  const byStatus = {
    CONFIRMED: issues.filter((issue) => issue.status === 'CONFIRMED').length,
    UNVERIFIED: issues.filter((issue) => issue.status === 'UNVERIFIED').length,
    NOT_IMPLEMENTED: issues.filter((issue) => issue.status === 'NOT_IMPLEMENTED').length,
    DOC_MISMATCH: issues.filter((issue) => issue.status === 'DOC_MISMATCH').length,
  };

  const lines = [
    `# Prediction v5 Issues Index · ${runId}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| \`total_issues\` | \`${issues.length}\` |`,
    `| \`confirmed\` | \`${byStatus.CONFIRMED}\` |`,
    `| \`unverified\` | \`${byStatus.UNVERIFIED}\` |`,
    `| \`not_implemented\` | \`${byStatus.NOT_IMPLEMENTED}\` |`,
    `| \`doc_mismatch\` | \`${byStatus.DOC_MISMATCH}\` |`,
    '',
  ];

  if (issues.length === 0) {
    lines.push('0 confirmed findings.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }

  lines.push(
    '| File | Severity | Status | Checklist IDs | Agent | Confidence |',
    '| --- | --- | --- | --- | --- | --- |',
    ...issues.map(
      (issue) =>
        `| [${path.basename(issue.relativePath)}](${path.basename(issue.relativePath)}) | \`${issue.severity}\` | \`${issue.status}\` | ${issue.checklist_ids.map((id) => `\`${id}\``).join(', ')} | \`${issue.reported_by_agent}\` | \`${issue.confidence.toFixed(2)}\` |`
    ),
    ''
  );

  if (confirmed.length === 0) {
    lines.push('No confirmed issues yet. Continue triage before setting final verdict.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderSummary(
  manifest: Manifest,
  issues: ParsedIssue[],
  validation: ValidationCommandResult[]
) {
  const confirmed = issues.filter((issue) => issue.status === 'CONFIRMED');
  const docMismatch = issues.filter((issue) => issue.status === 'DOC_MISMATCH');
  const validationPass = validation.filter((item) => item.status === 'PASS').length;
  const validationFail = validation.filter((item) => item.status === 'FAIL').length;

  return `# Prediction v5 Multi-Agent Review Summary

> Coordinator-owned summary for \`${manifest.runId}\`. Update the dimension table and verdict after triage is complete.

## Metadata

| Field | Value |
| --- | --- |
| \`run_id\` | \`${manifest.runId}\` |
| \`review_version\` | \`${manifest.reviewVersion}\` |
| \`review_root\` | \`${toRelative(manifest.reviewRoot)}\` |
| \`summary_doc\` | \`${toRelative(manifest.summaryDoc)}\` |
| \`created_at\` | \`${manifest.createdAt}\` |
| \`updated_at\` | \`${manifest.updatedAt}\` |
| \`checklist\` | \`${manifest.checklistPath}\` |
| \`verdict\` | \`${manifest.verdict}\` |

## Dimension Status

| Area | Status | Notes |
| --- | --- | --- |
| \`A\` 数学正确性 | \`${manifest.defaultDimensionStatus.A}\` | Fill after triage |
| \`B\` 数据流完整性 | \`${manifest.defaultDimensionStatus.B}\` | Fill after triage |
| \`C\` 安全性 | \`${manifest.defaultDimensionStatus.C}\` | Fill after triage |
| \`D\` 兼容性 | \`${manifest.defaultDimensionStatus.D}\` | Fill after triage |
| \`E\` 性能 | \`${manifest.defaultDimensionStatus.E}\` | Fill after triage |
| \`F\` 测试覆盖 | \`${manifest.defaultDimensionStatus.F}\` | Fill after triage |
| \`full prediction surface\` | \`${manifest.defaultDimensionStatus.full_prediction_surface}\` | Consumers, workflow, docs consistency |

## Findings Table

${
  issues.length > 0
    ? `| File | Severity | Status | Checklist IDs | Agent |\n| --- | --- | --- | --- | --- |\n${issues
        .map(
          (issue) =>
            `| [${path.basename(issue.relativePath)}](./issues/${path.basename(issue.relativePath)}) | \`${issue.severity}\` | \`${issue.status}\` | ${issue.checklist_ids.map((id) => `\`${id}\``).join(', ')} | \`${issue.reported_by_agent}\` |`
        )
        .join('\n')}`
    : 'No issues recorded yet.'
}

## Doc / Code Mismatch Table

${
  docMismatch.length > 0
    ? `| File | Severity | Checklist IDs | Agent |\n| --- | --- | --- | --- |\n${docMismatch
        .map(
          (issue) =>
            `| [${path.basename(issue.relativePath)}](./issues/${path.basename(issue.relativePath)}) | \`${issue.severity}\` | ${issue.checklist_ids.map((id) => `\`${id}\``).join(', ')} | \`${issue.reported_by_agent}\` |`
        )
        .join('\n')}`
    : 'No doc/code mismatch issues recorded yet.'
}

## Validation Summary

| Command | Status | Exit Code | Log |
| --- | --- | --- | --- |
${validation
  .map(
    (item) =>
      `| \`${item.id}\` | \`${item.status}\` | \`${item.exitCode ?? '-'}\` | [${path.basename(item.logPath)}](./validation/${path.basename(item.logPath)}) |`
  )
  .join('\n')}

- Validation pass count: \`${validationPass}\`
- Validation fail count: \`${validationFail}\`
- Confirmed issue count: \`${confirmed.length}\`

## Final Verdict

- Current value: \`${manifest.verdict}\`
- Allowed values: \`GO\`, \`CONDITIONAL\`, \`HOLD\`
- Update this section after:
  - Wave 1 triage is complete
  - Wave 2 repro agents are run when needed
  - issue severities and statuses are stable
`;
}

function renderTopLevelSummary(
  manifest: Manifest,
  issues: ParsedIssue[],
  validation: ValidationCommandResult[]
) {
  const reviewDate = manifest.runId.slice(0, 10);
  const issueCounts = {
    total: issues.length,
    confirmed: issues.filter((issue) => issue.status === 'CONFIRMED').length,
    unverified: issues.filter((issue) => issue.status === 'UNVERIFIED').length,
    notImplemented: issues.filter((issue) => issue.status === 'NOT_IMPLEMENTED').length,
    docMismatch: issues.filter((issue) => issue.status === 'DOC_MISMATCH').length,
  };

  return `# Prediction v5 Multi-Agent Review · ${reviewDate}

> Canonical entrypoint for the prediction v5 multi-agent review workflow. The latest run artifacts live under \`${toRelative(manifest.reviewRoot)}\`.

## Latest Run

| Field | Value |
| --- | --- |
| \`run_id\` | \`${manifest.runId}\` |
| \`review_root\` | \`${toRelative(manifest.reviewRoot)}\` |
| \`summary\` | [summary.md](/Users/yitianwu/Documents/study-abroad-platform/${toRelative(manifest.summaryPath)}) |
| \`issues_index\` | [issues/index.md](/Users/yitianwu/Documents/study-abroad-platform/${toRelative(manifest.issueIndex)}) |
| \`codex_run_plan\` | [codex-run-plan.md](/Users/yitianwu/Documents/study-abroad-platform/${toRelative(manifest.codexRunPlanPath)}) |
| \`verdict\` | \`${manifest.verdict}\` |

## Commands

\`\`\`bash
pnpm prediction-v5-review:init
pnpm prediction-v5-review:validate -- --run-root "${toRelative(manifest.reviewRoot)}"
pnpm prediction-v5-review:refresh -- --run-root "${toRelative(manifest.reviewRoot)}"
\`\`\`

## Current Counts

| Field | Value |
| --- | --- |
| \`total_issues\` | \`${issueCounts.total}\` |
| \`confirmed\` | \`${issueCounts.confirmed}\` |
| \`unverified\` | \`${issueCounts.unverified}\` |
| \`not_implemented\` | \`${issueCounts.notImplemented}\` |
| \`doc_mismatch\` | \`${issueCounts.docMismatch}\` |
| \`validation_pass\` | \`${validation.filter((item) => item.status === 'PASS').length}\` |
| \`validation_fail\` | \`${validation.filter((item) => item.status === 'FAIL').length}\` |

## Workflow Rules

- Every review run creates a fresh evidence root under \`e2e-report/prediction-v5-review-<run-id>/\`.
- Canonical issues live under the run-local \`issues/\` directory, one file per finding.
- The coordinator owns dedupe, severity, verdict, and final summary.
- Do not mark a checklist item \`PASS\` unless implementation, live-path wiring, consumer compatibility, and validation all hold.
`;
}

function renderCodexRunPlan(manifest: Manifest) {
  const wave1 = manifest.agents.filter((agent) => agent.wave === 1);
  const wave2 = manifest.agents.filter((agent) => agent.wave === 2);

  return `# Prediction v5 Codex Run Plan

## Review Root

- \`${toRelative(manifest.reviewRoot)}\`

## Wave 1

${wave1
  .map(
    (agent) =>
      `- \`${agent.id}\` -> brief: \`${toRelative(agent.briefPath)}\` -> note stub: \`${toRelative(agent.notePath)}\``
  )
  .join('\n')}

## Wave 2

${wave2
  .map(
    (agent) =>
      `- \`${agent.id}\` -> brief: \`${toRelative(agent.briefPath)}\` -> note stub: \`${toRelative(agent.notePath)}\``
  )
  .join('\n')}

## Validation Commands

${manifest.validation.map((item) => `- \`${item.id}\`: \`${item.command}\``).join('\n')}

## Canonical Files

- Manifest: \`${toRelative(path.join(manifest.reviewRoot, 'manifest.json'))}\`
- Summary: \`${toRelative(manifest.summaryPath)}\`
- Issue index: \`${toRelative(manifest.issueIndex)}\`
- Top-level doc: \`${toRelative(manifest.summaryDoc)}\`
`;
}

function renderAgentTemplateDoc() {
  return `# Prediction v5 Agent Note Template

## Metadata

| Field | Value |
| --- | --- |
| \`agent_id\` |  |
| \`wave\` |  |
| \`review_root\` |  |
| \`focus\` |  |
| \`checklist_ids\` |  |

## Covered IDs

- 

## Findings

- 

## PASS Items

- 

## UNVERIFIED Items

- 

## Commands Run

- 

## Open Questions

- 
`;
}

function renderIssueTemplateDoc() {
  return `<!-- prediction-v5-issue
{
  "title": "<fill-in>",
  "severity": "P2",
  "status": "CONFIRMED",
  "checklist_ids": ["A1"],
  "impacted_paths": ["apps/api/src/modules/prediction/example.ts"],
  "reported_by_agent": "math-logodds-reviewer",
  "corroborated_by": [],
  "confidence": 0.85
}
-->
# <fill-in>

## Impacted Paths

- 

## Evidence

- 

## Why It Matters


## Repro Or Verification

- 

## Suggested Fix

- 
`;
}

function renderSummaryTemplateDoc() {
  return `# Prediction v5 Review Summary Template

## Metadata

| Field | Value |
| --- | --- |
| \`run_id\` |  |
| \`review_root\` |  |
| \`summary_doc\` |  |
| \`verdict\` | PENDING |

## Dimension Status

| Area | Status | Notes |
| --- | --- | --- |
| \`A\` 数学正确性 | PENDING |  |
| \`B\` 数据流完整性 | PENDING |  |
| \`C\` 安全性 | PENDING |  |
| \`D\` 兼容性 | PENDING |  |
| \`E\` 性能 | PENDING |  |
| \`F\` 测试覆盖 | PENDING |  |
| \`full prediction surface\` | PENDING |  |

## Findings Table

| File | Severity | Status | Checklist IDs | Agent |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Doc / Code Mismatch Table

| File | Severity | Checklist IDs | Agent |
| --- | --- | --- | --- |
|  |  |  |  |

## Validation Summary

| Command | Status | Exit Code | Log |
| --- | --- | --- | --- |
|  |  |  |  |

## Final Verdict

- \`GO\` / \`CONDITIONAL\` / \`HOLD\`
`;
}

function parseIssueMetadata(filePath: string, raw: string): ParsedIssue | null {
  const match = raw.match(/<!--\s*prediction-v5-issue\s*([\s\S]*?)-->/);
  if (!match) return null;

  try {
    const metadata = JSON.parse(match[1].trim()) as IssueMetadata;
    return {
      ...metadata,
      filePath,
      relativePath: toRelative(filePath),
    };
  } catch (error) {
    console.warn(
      `[prediction-v5-review] failed to parse metadata in ${toRelative(filePath)}: ${String(error)}`
    );
    return null;
  }
}

async function scanIssues(issueDir: string) {
  const entries = await fs.readdir(issueDir, { withFileTypes: true });
  const issues: ParsedIssue[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === 'index.md') continue;
    const filePath = path.join(issueDir, entry.name);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = parseIssueMetadata(filePath, raw);
    if (parsed) issues.push(parsed);
  }
  issues.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return issues;
}

async function initCommand(values: Map<string, string>) {
  const runId = resolveRunId(values);
  const timezone = getTimezone(values);
  const reviewRoot = resolveReviewRoot(runId, values);
  const summaryDoc = resolveSummaryDoc(runId, values);

  const agentNotesDir = path.join(reviewRoot, 'agent-notes');
  const issuesDir = path.join(reviewRoot, 'issues');
  const validationDir = path.join(reviewRoot, 'validation');
  const artifactsDir = path.join(reviewRoot, 'artifacts');
  const agentBriefsDir = path.join(artifactsDir, 'agent-briefs');

  await Promise.all([
    ensureDir(agentNotesDir),
    ensureDir(issuesDir),
    ensureDir(validationDir),
    ensureDir(artifactsDir),
    ensureDir(agentBriefsDir),
    ensureDir(path.join(ROOT, 'docs', 'templates')),
  ]);

  const createdAt = getNowIso();
  const allAgents = [...WAVE_1_AGENTS, ...WAVE_2_AGENTS];
  const manifest: Manifest = {
    reviewVersion: REVIEW_VERSION,
    runId,
    createdAt,
    updatedAt: createdAt,
    timezone,
    reviewRoot,
    summaryDoc,
    issueDirectory: path.join(issuesDir),
    issueIndex: path.join(issuesDir, 'index.md'),
    summaryPath: path.join(reviewRoot, 'summary.md'),
    codexRunPlanPath: path.join(reviewRoot, 'artifacts', 'codex-run-plan.md'),
    checklistPath: CHECKLIST_PATH,
    researchReportPath: RESEARCH_REPORT_PATH,
    adrPath: ADR_PATH,
    verdict: 'PENDING',
    defaultDimensionStatus: {
      A: 'PENDING',
      B: 'PENDING',
      C: 'PENDING',
      D: 'PENDING',
      E: 'PENDING',
      F: 'PENDING',
      full_prediction_surface: 'PENDING',
    },
    agents: allAgents.map((agent) => ({
      ...agent,
      notePath: path.join(agentNotesDir, `${agent.id}.md`),
      briefPath: path.join(agentBriefsDir, `${agent.id}.md`),
    })),
    validation: VALIDATION_COMMANDS.map((item) => ({
      ...item,
      logPath: path.join('validation', `${item.id}.log`),
      status: 'PENDING',
      exitCode: null,
    })),
  };

  await saveManifest(manifest);

  for (const agent of manifest.agents) {
    await writeText(agent.notePath, renderAgentNote(agent, reviewRoot));
    await writeText(agent.briefPath, renderAgentBrief(agent, reviewRoot));
  }

  await writeText(
    path.join(validationDir, 'README.md'),
    renderValidationReadme(manifest.validation)
  );
  await writeText(manifest.issueIndex, renderIssueIndex(runId, []));
  await writeText(manifest.summaryPath, renderSummary(manifest, [], manifest.validation));
  await writeJson(path.join(reviewRoot, 'artifacts', 'review-config.json'), {
    runId: manifest.runId,
    reviewVersion: manifest.reviewVersion,
    reviewRoot: toRelative(manifest.reviewRoot),
    summaryDoc: toRelative(manifest.summaryDoc),
    checklistPath: manifest.checklistPath,
    researchReportPath: manifest.researchReportPath,
    adrPath: manifest.adrPath,
    agents: manifest.agents.map((agent) => ({
      id: agent.id,
      wave: agent.wave,
      focus: agent.focus,
      checklistIds: agent.checklistIds,
      notePath: toRelative(agent.notePath),
      briefPath: toRelative(agent.briefPath),
    })),
    validation: manifest.validation.map((item) => ({
      id: item.id,
      label: item.label,
      command: item.command,
      logPath: item.logPath,
    })),
  });
  await writeText(manifest.codexRunPlanPath, renderCodexRunPlan(manifest));
  await writeText(
    path.join(reviewRoot, 'artifacts', 'agent-note-template.md'),
    renderAgentTemplateDoc()
  );
  await writeText(
    path.join(reviewRoot, 'artifacts', 'issue-template.md'),
    renderIssueTemplateDoc()
  );
  await writeText(
    path.join(reviewRoot, 'artifacts', 'summary-template.md'),
    renderSummaryTemplateDoc()
  );
  await writeExecutable(
    path.join(reviewRoot, 'run-codex-prediction-v5-review.sh'),
    `#!/usr/bin/env bash
set -euo pipefail

cd "${ROOT}"
pnpm prediction-v5-review:validate -- --run-root "${toRelative(reviewRoot)}"
pnpm prediction-v5-review:refresh -- --run-root "${toRelative(reviewRoot)}"
`
  );
  await writeText(summaryDoc, renderTopLevelSummary(manifest, [], manifest.validation));

  await writeText(
    path.join(ROOT, 'docs', 'templates', 'prediction-v5-agent-note.md'),
    renderAgentTemplateDoc()
  );
  await writeText(
    path.join(ROOT, 'docs', 'templates', 'prediction-v5-issue.md'),
    renderIssueTemplateDoc()
  );
  await writeText(
    path.join(ROOT, 'docs', 'templates', 'prediction-v5-summary.md'),
    renderSummaryTemplateDoc()
  );

  console.log(
    JSON.stringify(
      {
        runId,
        reviewRoot: toRelative(reviewRoot),
        summaryDoc: toRelative(summaryDoc),
        agentCount: manifest.agents.filter((agent) => agent.wave === 1).length,
        wave2AgentCount: manifest.agents.filter((agent) => agent.wave === 2).length,
      },
      null,
      2
    )
  );
}

async function runShellCommand(command: string, cwd: string, logFilePath: string) {
  const startedAt = getNowIso();
  await ensureDir(path.dirname(logFilePath));
  const header = [`# command: ${command}`, `# cwd: ${cwd}`, `# started_at: ${startedAt}`, ''].join(
    '\n'
  );
  await writeText(logFilePath, header);

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn('/bin/zsh', ['-lc', command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const pendingWrites: Array<Promise<unknown>> = [];

    const handleChunk = (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      pendingWrites.push(fs.appendFile(logFilePath, text, 'utf8'));
    };

    child.stdout.on('data', (chunk: Buffer) => {
      handleChunk(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      handleChunk(chunk);
    });
    child.on('error', async (error) => {
      const text = `\n[spawn-error] ${String(error)}\n`;
      process.stderr.write(text);
      await fs.appendFile(logFilePath, text, 'utf8');
      resolve(1);
    });
    child.on('close', (code) => {
      void Promise.allSettled(pendingWrites).then(() => {
        resolve(code ?? 1);
      });
    });
  });

  const finishedAt = getNowIso();
  await fs.appendFile(
    logFilePath,
    `\n# finished_at: ${finishedAt}\n# exit_code: ${exitCode}\n`,
    'utf8'
  );

  return { exitCode, startedAt, finishedAt };
}

async function validateCommand(values: Map<string, string>) {
  const runRoot = values.get('run-root')
    ? path.resolve(ROOT, values.get('run-root')!)
    : resolveReviewRoot(resolveRunId(values), values);
  const selectedIds = new Set(splitCsv(values.get('only')));
  const printConfig = values.get('print-config') === 'true';
  const continueOnError = values.get('continue-on-error') !== 'false';

  const manifest = await loadManifest(runRoot);
  const selected = manifest.validation.filter(
    (item) => selectedIds.size === 0 || selectedIds.has(item.id)
  );

  if (printConfig) {
    console.log(
      JSON.stringify(
        {
          runId: manifest.runId,
          runRoot: toRelative(runRoot),
          selectedValidation: selected.map((item) => ({
            id: item.id,
            command: item.command,
            logPath: item.logPath,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  for (const item of manifest.validation) {
    if (selectedIds.size > 0 && !selectedIds.has(item.id)) {
      item.status = item.status === 'PENDING' ? 'SKIPPED' : item.status;
    }
  }

  for (const item of selected) {
    const logFilePath = path.join(runRoot, item.logPath);
    const result = await runShellCommand(item.command, ROOT, logFilePath);
    item.exitCode = result.exitCode;
    item.startedAt = result.startedAt;
    item.finishedAt = result.finishedAt;
    item.status = result.exitCode === 0 ? 'PASS' : 'FAIL';
    if (result.exitCode !== 0 && !continueOnError) {
      break;
    }
  }

  await saveManifest(manifest);
  await refreshSummaryArtifacts(manifest);
}

async function refreshSummaryArtifacts(manifest: Manifest) {
  const issues = await scanIssues(manifest.issueDirectory);
  await writeText(manifest.issueIndex, renderIssueIndex(manifest.runId, issues));
  await writeText(manifest.summaryPath, renderSummary(manifest, issues, manifest.validation));
  await writeText(
    manifest.summaryDoc,
    renderTopLevelSummary(manifest, issues, manifest.validation)
  );
}

async function refreshSummaryCommand(values: Map<string, string>) {
  const runRoot = values.get('run-root')
    ? path.resolve(ROOT, values.get('run-root')!)
    : resolveReviewRoot(resolveRunId(values), values);
  const manifest = await loadManifest(runRoot);
  await refreshSummaryArtifacts(manifest);
}

async function createIssueCommand(values: Map<string, string>) {
  const runRoot = values.get('run-root')
    ? path.resolve(ROOT, values.get('run-root')!)
    : resolveReviewRoot(resolveRunId(values), values);
  const manifest = await loadManifest(runRoot);

  const title = values.get('title');
  const severity = (values.get('severity') ?? 'P2').toUpperCase() as Severity;
  const status = (values.get('status') ?? 'CONFIRMED').toUpperCase() as IssueStatus;
  const checklistIds = splitCsv(values.get('checklist-ids'));
  const reportedByAgent = values.get('reported-by-agent') ?? 'coordinator';

  if (!title || checklistIds.length === 0) {
    throw new Error('create-issue requires --title and --checklist-ids A1,B2 style values.');
  }

  const metadata: IssueMetadata = {
    title,
    severity,
    status,
    checklist_ids: checklistIds,
    impacted_paths: splitCsv(values.get('impacted-paths')),
    reported_by_agent: reportedByAgent,
    corroborated_by: splitCsv(values.get('corroborated-by')),
    confidence: Number(values.get('confidence') ?? '0.8'),
  };

  const slug = values.get('slug') ?? slugify(title);
  const checklistId = checklistIds[0];
  const fileName = `${severity}__${checklistId}__${slug}.md`;
  const filePath = path.join(manifest.issueDirectory, fileName);

  if (values.get('force') !== 'true') {
    try {
      await fs.access(filePath);
      throw new Error(
        `Issue file already exists: ${toRelative(filePath)}. Pass --force true to overwrite.`
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // file does not exist, continue
    }
  }

  await writeText(filePath, renderIssueTemplate(metadata));
  await refreshSummaryArtifacts(manifest);
  console.log(JSON.stringify({ issueFile: toRelative(filePath) }, null, 2));
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.command === 'validate') {
    await validateCommand(cli.values);
    return;
  }
  if (cli.command === 'refresh-summary') {
    await refreshSummaryCommand(cli.values);
    return;
  }
  if (cli.command === 'create-issue') {
    await createIssueCommand(cli.values);
    return;
  }
  await initCommand(cli.values);
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
