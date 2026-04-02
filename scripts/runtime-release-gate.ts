import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  externalPrerequisiteSummaries,
  getJourneyDefinition,
  JOURNEY_REGISTRY_VERSION,
  qualityDimensionLabels,
  type ExternalPrerequisite,
  type JourneyDefinition,
  type QualityDimension,
} from './release-gate/registry';

type JourneyStatus = 'PASS' | 'ISSUE' | 'BROKEN' | 'BLOCKED' | 'SKIPPED';

interface ReleaseGateConfig {
  releaseId: string;
  registryVersion: string;
  impactMappingVersion: string;
  environment: string;
  candidateVersion: string;
  base: string;
  head: string;
  gateJourneyIds: string[];
  baselineSmokeIds: string[];
  humanReviewJourneyIds: string[];
  runtimeAuditScript: string;
  runtimeAuditId?: string;
  runtimeAuditContext?: string;
  runtimeEvidenceRoot?: string;
  legacyEvidenceRoot?: string;
  journeysCsv: string;
  suggestedCommand: string;
}

interface JourneyRecord {
  id: string;
  title: string;
  account: string;
  registryVersion?: string;
  registryStatus?: string;
  executionOwner?: string;
  validationType?: string;
  baselineSmoke?: boolean;
  qualityDimensionsChecked?: QualityDimension[];
  externalPrerequisites?: ExternalPrerequisite[];
  blockedByExternalPrerequisites?: string[];
  impactMappingUsed?: string[];
  prerequisites: string[];
  steps: string[];
  userVisibleResult: string;
  score: number;
  status: JourneyStatus;
  evidence: string[];
  notes?: string[];
  issues?: Array<{
    summary: string;
    rootCause?: string;
    acceptance?: string;
  }>;
  generatedAt?: string;
}

interface CliArgs {
  configPath: string;
  skipExec: boolean;
}

const ROOT = process.cwd();

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const configPath = values.get('config');
  if (!configPath) {
    throw new Error('Missing required argument: --config <path-to-codex-run-config.json>');
  }

  return {
    configPath: path.resolve(ROOT, configPath),
    skipExec: values.get('skip-exec') === 'true',
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}

async function writeJson(filePath: string, value: unknown) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function spawnAudit(
  scriptPath: string,
  journeysCsv: string,
  packageDir: string,
  options: {
    runtimeAuditId?: string;
    runtimeAuditContext?: string;
    runtimeEvidenceRoot?: string;
  } = {}
) {
  const absoluteScript = path.resolve(ROOT, scriptPath);
  const childArgs = ['exec', 'tsx', absoluteScript, '--journeys', journeysCsv, '--force-rerun'];
  if (options.runtimeAuditId) {
    childArgs.push('--audit-id', options.runtimeAuditId);
  }
  if (options.runtimeAuditContext) {
    childArgs.push('--audit-context', options.runtimeAuditContext);
  }
  if (options.runtimeEvidenceRoot) {
    childArgs.push('--evidence-root', options.runtimeEvidenceRoot);
  }
  const child = spawn('pnpm', childArgs, {
    cwd: ROOT,
    env: {
      ...process.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    stdout += text;
    process.stdout.write(text);
  });

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    stderr += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  await writeText(
    path.join(packageDir, 'codex-runtime.log'),
    ['# stdout', stdout, '', '# stderr', stderr].join('\n')
  );

  return { exitCode, stdout, stderr };
}

async function readJourneyRecords(evidenceRoot: string, ids: readonly string[]) {
  const records = await Promise.all(
    ids.map(async (id) => {
      const filePath = path.join(evidenceRoot, id, 'record.json');
      try {
        return await readJson<JourneyRecord>(filePath);
      } catch {
        return null;
      }
    })
  );
  return records.filter((record): record is JourneyRecord => Boolean(record));
}

function statusCounts(records: readonly JourneyRecord[]) {
  return records.reduce<Record<JourneyStatus, number>>(
    (acc, record) => {
      acc[record.status] += 1;
      return acc;
    },
    { PASS: 0, ISSUE: 0, BROKEN: 0, BLOCKED: 0, SKIPPED: 0 }
  );
}

function journeyQuality(journey: JourneyDefinition) {
  return qualityDimensionLabels(journey.qualityDimensions).join(' / ');
}

function conditionalBlockedScopes(journey: JourneyDefinition, record?: JourneyRecord) {
  if (!record || record.status !== 'BLOCKED') return [];
  const blockedScopes = new Set(record.blockedByExternalPrerequisites ?? []);
  return (journey.externalPrerequisites ?? [])
    .filter(
      (prerequisite) =>
        prerequisite.blockingPolicy === 'conditional' && blockedScopes.has(prerequisite.scope)
    )
    .map((prerequisite) => prerequisite.scope);
}

function isConditionalCapabilityBlocked(journey: JourneyDefinition, record?: JourneyRecord) {
  if (!record || record.status !== 'BLOCKED') return false;
  const blockedScopes = record.blockedByExternalPrerequisites ?? [];
  return (
    blockedScopes.length > 0 &&
    conditionalBlockedScopes(journey, record).length === blockedScopes.length
  );
}

function buildExternalPrerequisitesSection(
  journeys: readonly JourneyDefinition[],
  records?: Map<string, JourneyRecord>
) {
  const rows = journeys
    .filter((journey) => (journey.externalPrerequisites?.length ?? 0) > 0)
    .flatMap((journey) =>
      (journey.externalPrerequisites ?? []).map((prerequisite) => {
        const record = records?.get(journey.id);
        const currentNote = record?.issues?.[0]?.summary ?? record?.notes?.[0] ?? '';
        return `| ${journey.id} | ${prerequisite.scope} | ${prerequisite.blockingPolicy} | 如缺失，相关子检查应记 \`BLOCKED\`（外部依赖），不得误记为产品启动/页面崩溃 | ${prerequisite.unblockAction} | ${record?.status ?? ''} | ${currentNote} |`;
      })
    );

  if (rows.length === 0) {
    return ['## 外部前置能力 / Capability Gates', '', '- none', ''];
  }

  return [
    '## 外部前置能力 / Capability Gates',
    '',
    '| journey_id | capability scope | blocking policy | missing means | unblock action | current status | note |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

function buildDecision(status: JourneyStatus | 'MISSING', conditionalCapabilityBlocked = false) {
  switch (status) {
    case 'PASS':
      return 'keep';
    case 'ISSUE':
      return 'review';
    case 'BROKEN':
      return 'hold';
    case 'BLOCKED':
      return conditionalCapabilityBlocked ? 'conditional-capability' : 'waiver-or-hold';
    case 'SKIPPED':
      return 'review-skip';
    default:
      return 'missing';
  }
}

function buildGateMasterMarkdown(
  config: ReleaseGateConfig,
  journeys: JourneyDefinition[],
  records: Map<string, JourneyRecord>,
  evidenceRootRelative: string
) {
  const lines = [
    '# 发版门禁总表',
    '',
    '| 字段 | 内容 |',
    '| --- | --- |',
    `| \`release_id\` | \`${config.releaseId}\` |`,
    `| \`registry_version\` | \`${config.registryVersion}\` |`,
    `| \`impact_mapping_used\` | \`docs/RELEASE_IMPACT_MAPPING.md (${config.impactMappingVersion})\` |`,
    `| \`候选版本\` | \`${config.candidateVersion}\` |`,
    `| \`commit / tag\` | \`${config.head}\` |`,
    `| \`环境\` | \`${config.environment}\` |`,
    '',
    '## 总表',
    '',
    '| journey_id | title | baseline_smoke | execution_owner | validation_type | quality_dimensions_checked | tester | status | evidence_link | issue_link | waiver | decision | notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...journeys.map((journey) => {
      const record = records.get(journey.id);
      const evidenceLink = record ? `${evidenceRootRelative}/${journey.id}/record.json` : '';
      const issueSummary = record?.issues?.[0]?.summary ?? '';
      const notes = record?.notes?.[0] ?? '';
      return `| ${journey.id} | ${journey.title} | ${journey.baselineSmoke ? 'yes' : 'no'} | ${journey.defaultExecutionOwner} | ${journey.validationType} | ${journeyQuality(journey)} |  | ${record?.status ?? ''} | ${evidenceLink} | ${issueSummary} |  | ${buildDecision(record?.status ?? 'MISSING', isConditionalCapabilityBlocked(journey, record))} | ${notes} |`;
    }),
    '',
    ...buildExternalPrerequisitesSection(journeys, records),
    '## Codex Runtime Summary',
    '',
    `- evidence root: \`${evidenceRootRelative}\``,
    `- suggested command: \`${config.suggestedCommand}\``,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildRuntimeResultMarkdown(
  config: ReleaseGateConfig,
  records: readonly JourneyRecord[],
  evidenceRootRelative: string,
  exitCode: number
) {
  const counts = statusCounts(records);
  const journeys = config.gateJourneyIds
    .map((id) => getJourneyDefinition(id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey));
  const conditionalBlocked = journeys.filter((journey) =>
    isConditionalCapabilityBlocked(
      journey,
      records.find((record) => record.id === journey.id)
    )
  );
  const lines = [
    '# Codex Runtime Result',
    '',
    `- release_id: \`${config.releaseId}\``,
    `- registry_version: \`${config.registryVersion}\``,
    `- environment: \`${config.environment}\``,
    `- evidence_root: \`${evidenceRootRelative}\``,
    `- audit_exit_code: \`${exitCode}\``,
    '',
    '## Status Counts',
    '',
    `- PASS: ${counts.PASS}`,
    `- ISSUE: ${counts.ISSUE}`,
    `- BROKEN: ${counts.BROKEN}`,
    `- BLOCKED: ${counts.BLOCKED}`,
    `- SKIPPED: ${counts.SKIPPED}`,
    `- conditional capability blockers: ${conditionalBlocked.map((journey) => `\`${journey.id}\``).join(', ') || 'none'}`,
    '',
    '## Journey Results',
    '',
    '| journey_id | status | score | evidence |',
    '| --- | --- | --- | --- |',
    ...records.map(
      (record) =>
        `| ${record.id} | ${record.status} | ${record.score}/5 | ${evidenceRootRelative}/${record.id}/record.json |`
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildHumanHandoffMarkdown(config: ReleaseGateConfig, records: Map<string, JourneyRecord>) {
  const journeys = config.humanReviewJourneyIds
    .map((id) => getJourneyDefinition(id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey));

  const lines = [
    '# Human Handoff',
    '',
    '| journey_id | title | codex_status | ready_for_human | task_card | note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...journeys.map((journey) => {
      const record = records.get(journey.id);
      const ready =
        record?.status === 'PASS' ||
        record?.status === 'ISSUE' ||
        isConditionalCapabilityBlocked(journey, record);
      const prerequisiteNote = externalPrerequisiteSummaries(journey.externalPrerequisites).join(
        ' '
      );
      const note = ready
        ? `Codex 已完成首轮验证，可进入人工体验验证。${record?.status === 'BLOCKED' ? ' 当前仅剩 conditional capability gate 未解锁。' : ''}${prerequisiteNote ? ` 已知外部前置：${prerequisiteNote}` : ''}`
        : record?.status
          ? `Codex 状态为 ${record.status}，先不要分发给人工。${prerequisiteNote ? ` 已知外部前置：${prerequisiteNote}` : ''}`
          : `Codex 尚未产出记录。${prerequisiteNote ? ` 已知外部前置：${prerequisiteNote}` : ''}`;
      return `| ${journey.id} | ${journey.title} | ${record?.status ?? 'MISSING'} | ${ready ? 'yes' : 'no'} | human-task-cards/${journey.id}.md | ${note} |`;
    }),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function localAuditDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildGateRecommendation(records: readonly JourneyRecord[], expectedCount: number) {
  if (records.length < expectedCount) return 'HOLD';
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const journeys = records
    .map((record) => getJourneyDefinition(record.id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey));
  const hasHardBlocked = journeys.some((journey) => {
    const record = recordMap.get(journey.id);
    return record?.status === 'BLOCKED' && !isConditionalCapabilityBlocked(journey, record);
  });
  const hasConditionalBlocked = journeys.some((journey) =>
    isConditionalCapabilityBlocked(journey, recordMap.get(journey.id))
  );
  const counts = statusCounts(records);
  if (counts.BROKEN > 0 || hasHardBlocked) return 'HOLD';
  if (counts.ISSUE > 0 || counts.SKIPPED > 0 || hasConditionalBlocked) return 'CONDITIONAL';
  return 'READY';
}

function buildAuditLogSectionMarkdown(
  config: ReleaseGateConfig,
  journeys: readonly JourneyDefinition[],
  records: Map<string, JourneyRecord>,
  evidenceRootRelative: string,
  exitCode: number
) {
  const orderedRecords = journeys
    .map((journey) => records.get(journey.id))
    .filter((record): record is JourneyRecord => Boolean(record));
  const counts = statusCounts(orderedRecords);
  const recommendation = buildGateRecommendation(orderedRecords, journeys.length);
  const lines = [
    `## ${localAuditDate()} 发版门禁（${config.releaseId}）`,
    '',
    '### 元数据',
    '',
    '| 项目 | 内容 |',
    '| --- | --- |',
    `| 日期 | ${localAuditDate()} |`,
    `| release_id | \`${config.releaseId}\` |`,
    `| registry_version | \`${config.registryVersion}\` |`,
    `| 候选版本 | \`${config.candidateVersion}\` |`,
    `| 环境 | \`${config.environment}\` |`,
    `| evidence_root | \`${evidenceRootRelative}\` |`,
    `| Codex runtime exit code | \`${exitCode}\` |`,
    `| 放行建议 | \`${recommendation}\` |`,
    '',
    '### 状态汇总',
    '',
    '| 状态 | 数量 |',
    '| --- | --- |',
    `| PASS | ${counts.PASS} |`,
    `| ISSUE | ${counts.ISSUE} |`,
    `| BROKEN | ${counts.BROKEN} |`,
    `| BLOCKED | ${counts.BLOCKED} |`,
    `| SKIPPED | ${counts.SKIPPED} |`,
    '',
    ...buildExternalPrerequisitesSection(journeys, records),
    '### 门禁旅程结果',
    '',
    '| ID | 状态 | 评分 | 执行者 | 类型 | 证据 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...journeys.map((journey) => {
      const record = records.get(journey.id);
      const note = record?.issues?.[0]?.summary ?? record?.notes?.[0] ?? '';
      const evidence = record ? `${evidenceRootRelative}/${journey.id}/record.json` : '';
      return `| ${journey.id} | ${record?.status ?? 'MISSING'} | ${record ? `${record.score}/5` : ''} | ${journey.defaultExecutionOwner} | ${journey.validationType} | ${evidence} | ${note} |`;
    }),
    '',
    '### 人工补位建议',
    '',
    ...config.humanReviewJourneyIds.map((id) => {
      const journey = getJourneyDefinition(id);
      if (!journey) return `- \`${id}\`: missing journey definition`;
      const record = records.get(id);
      const ready =
        record?.status === 'PASS' ||
        record?.status === 'ISSUE' ||
        isConditionalCapabilityBlocked(journey, record);
      return `- \`${id}\` ${journey.title}: ${ready ? (record?.status === 'BLOCKED' ? '可分发给人工体验验证，但仅剩 conditional capability gate 未解锁' : '可分发给人工体验验证') : `先不要分发（当前状态 ${record?.status ?? 'MISSING'}）`}`;
    }),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readJson<ReleaseGateConfig>(args.configPath);
  const packageDir = path.dirname(args.configPath);
  const evidenceRootRelative =
    config.runtimeEvidenceRoot ??
    config.legacyEvidenceRoot ??
    path.join('e2e-report', 'releases', config.releaseId, 'journeys');
  const evidenceRootAbsolute = path.resolve(ROOT, evidenceRootRelative);
  const runtimeAuditScript = config.runtimeAuditScript;

  let exitCode = 0;
  if (!args.skipExec) {
    const result = await spawnAudit(runtimeAuditScript, config.journeysCsv, packageDir, {
      runtimeAuditId: config.runtimeAuditId ?? config.releaseId,
      runtimeAuditContext: config.runtimeAuditContext ?? `release gate ${config.releaseId}`,
      runtimeEvidenceRoot: evidenceRootRelative,
    });
    exitCode = result.exitCode;
  }

  const records = await readJourneyRecords(evidenceRootAbsolute, config.gateJourneyIds);
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const journeys = config.gateJourneyIds
    .map((id) => getJourneyDefinition(id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey));

  await writeJson(path.join(packageDir, 'codex-runtime-result.json'), {
    releaseId: config.releaseId,
    registryVersion: config.registryVersion ?? JOURNEY_REGISTRY_VERSION,
    environment: config.environment,
    evidenceRoot: evidenceRootRelative,
    exitCode,
    records,
    counts: statusCounts(records),
  });

  await writeText(
    path.join(packageDir, 'codex-runtime-result.md'),
    buildRuntimeResultMarkdown(config, records, evidenceRootRelative, exitCode)
  );
  await writeText(
    path.join(packageDir, 'release-gate-master.md'),
    buildGateMasterMarkdown(config, journeys, recordMap, evidenceRootRelative)
  );
  await writeText(
    path.join(packageDir, 'human-handoff.md'),
    buildHumanHandoffMarkdown(config, recordMap)
  );
  await writeText(
    path.join(packageDir, 'user-journey-audit-section.md'),
    buildAuditLogSectionMarkdown(config, journeys, recordMap, evidenceRootRelative, exitCode)
  );

  console.log(`Updated release gate package at ${packageDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
