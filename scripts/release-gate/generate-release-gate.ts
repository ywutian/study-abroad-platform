import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  BASELINE_SMOKE_IDS,
  externalPrerequisiteSummaries,
  getHumanReviewJourneys,
  getJourneyDefinition,
  JOURNEY_REGISTRY_VERSION,
  qualityDimensionLabels,
  type JourneyDefinition,
} from './registry';
import { formatQualityDimensions, IMPACT_MAPPING_VERSION, inferImpactSet } from './impact-mapping';

const ROOT = process.cwd();

interface CliArgs {
  releaseId: string;
  environment: string;
  candidateVersion: string;
  base: string;
  head: string;
  runtimeAuditId?: string;
  runtimeAuditContext?: string;
  runtimeEvidenceRoot?: string;
  outputDir?: string;
  changedFiles?: string[];
}

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

  const releaseId = values.get('release-id');
  if (!releaseId) {
    throw new Error('Missing required argument: --release-id');
  }

  return {
    releaseId,
    environment: values.get('environment') ?? 'pre-release',
    candidateVersion: values.get('candidate-version') ?? currentHeadShortSha(),
    base: values.get('base') ?? 'HEAD~1',
    head: values.get('head') ?? 'HEAD',
    runtimeAuditId: values.get('runtime-audit-id') ?? undefined,
    runtimeAuditContext: values.get('runtime-audit-context') ?? undefined,
    runtimeEvidenceRoot: values.get('runtime-evidence-root') ?? undefined,
    outputDir: values.get('output-dir'),
    changedFiles: values.get('changed-files')
      ? values
          .get('changed-files')!
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined,
  };
}

function currentHeadShortSha() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
}

function gitChangedFiles(base: string, head: string) {
  const output = execFileSync('git', ['diff', '--name-only', base, head], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function ensureDir(target: string) {
  await fs.mkdir(target, { recursive: true });
}

async function writeText(filePath: string, contents: string) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

async function writeJson(filePath: string, value: unknown) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeExecutableShell(filePath: string, contents: string) {
  await writeText(filePath, contents);
  await fs.chmod(filePath, 0o755);
}

function outputRoot(args: CliArgs) {
  return args.outputDir
    ? path.resolve(ROOT, args.outputDir)
    : path.join(ROOT, 'e2e-report', 'releases', args.releaseId);
}

function formatExecutionOwner(journey: JourneyDefinition) {
  return journey.defaultExecutionOwner;
}

function formatValidationType(journey: JourneyDefinition) {
  return journey.validationType;
}

function buildExternalPrerequisitesSection(journeys: readonly JourneyDefinition[]) {
  const rows = journeys
    .filter((journey) => (journey.externalPrerequisites?.length ?? 0) > 0)
    .flatMap((journey) =>
      (journey.externalPrerequisites ?? []).map(
        (prerequisite) =>
          `| ${journey.id} | ${prerequisite.scope} | ${prerequisite.blockingPolicy} | 如缺失，相关子检查应记 \`BLOCKED\`（外部依赖），不得误记为产品启动/页面崩溃 | ${prerequisite.unblockAction} |`
      )
    );

  if (rows.length === 0) {
    return ['## 外部前置能力 / Capability Gates', '', '- none', ''];
  }

  return [
    '## 外部前置能力 / Capability Gates',
    '',
    '| journey_id | capability scope | blocking policy | missing means | unblock action |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

function buildGateMasterMarkdown(
  args: CliArgs,
  gateJourneys: JourneyDefinition[],
  impact: ReturnType<typeof inferImpactSet>
) {
  const lines = [
    '# 发版门禁总表',
    '',
    '| 字段 | 内容 |',
    '| --- | --- |',
    `| \`release_id\` | \`${args.releaseId}\` |`,
    `| \`registry_version\` | \`${JOURNEY_REGISTRY_VERSION}\` |`,
    `| \`impact_mapping_used\` | \`docs/RELEASE_IMPACT_MAPPING.md (${IMPACT_MAPPING_VERSION})\` |`,
    `| \`候选版本\` | \`${args.candidateVersion}\` |`,
    `| \`commit / tag\` | \`${args.head}\` |`,
    `| \`环境\` | \`${args.environment}\` |`,
    '',
    '## 总表',
    '',
    '| journey_id | title | baseline_smoke | execution_owner | validation_type | quality_dimensions_checked | tester | status | evidence_link | issue_link | waiver | decision | notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...gateJourneys.map((journey) => {
      const quality = qualityDimensionLabels(journey.qualityDimensions).join(' / ');
      return `| ${journey.id} | ${journey.title} | ${journey.baselineSmoke ? 'yes' : 'no'} | ${formatExecutionOwner(journey)} | ${formatValidationType(journey)} | ${quality} |  |  |  |  |  |  |  |`;
    }),
    '',
    ...buildExternalPrerequisitesSection(gateJourneys),
    '## Impact 摘要',
    '',
    `- 命中的规则: ${impact.matchedRules.length > 0 ? impact.matchedRules.map((rule) => `\`${rule.id}\``).join(', ') : 'none'}`,
    `- 受影响旅程: ${impact.impactedJourneyIds.length > 0 ? impact.impactedJourneyIds.map((id) => `\`${id}\``).join(', ') : 'none'}`,
    `- 最终门禁集: ${impact.gateJourneyIds.map((id) => `\`${id}\``).join(', ')}`,
    `- 是否建议 Full Audit: ${impact.requiresFullAudit ? 'yes' : 'no'}`,
    '',
    '## 体验质量维度总览',
    '',
    '| 维度 | 是否本轮必查 | 当前结论 | 备注 |',
    '| --- | --- | --- | --- |',
    `| 布局合理性 | ${impact.qualityDimensions.includes('layout') ? 'yes' : 'optional'} |  |  |`,
    `| AI Agent 功能与输出合理性 | ${impact.qualityDimensions.includes('ai-quality') ? 'yes' : 'optional'} |  |  |`,
    `| Web / Mobile 复用合理性 | ${impact.qualityDimensions.includes('cross-platform') ? 'yes' : 'optional'} |  |  |`,
    `| 专业留学中介感 | ${impact.qualityDimensions.includes('consultancy-quality') ? 'yes' : 'optional'} |  |  |`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildTaskCardMarkdown(args: CliArgs, journey: JourneyDefinition) {
  const task = journey.humanTask;
  if (!task) {
    throw new Error(`Journey ${journey.id} does not define a humanTask`);
  }
  const rubrics = [];
  if (journey.qualityDimensions.includes('ai-quality')) {
    rubrics.push('docs/AI_AGENT_EVALUATION_RUBRIC.md');
  }
  if (
    journey.qualityDimensions.includes('cross-platform') ||
    journey.qualityDimensions.includes('layout')
  ) {
    rubrics.push('docs/CROSS_PLATFORM_REUSE_RUBRIC.md');
  }
  if (journey.qualityDimensions.includes('consultancy-quality')) {
    rubrics.push('docs/PROFESSIONAL_CONSULTANCY_RUBRIC.md');
  }

  const lines = [
    '# 人工 E2E 测试任务卡',
    '',
    '| 字段 | 内容 |',
    '| --- | --- |',
    `| \`release_id\` | \`${args.releaseId}\` |`,
    `| \`journey_id\` | \`${journey.id}\` |`,
    `| \`registry_version\` | \`${JOURNEY_REGISTRY_VERSION}\` |`,
    `| \`persona\` | \`${journey.persona}\` |`,
    `| \`platform\` | \`${journey.platform}\` |`,
    '| `execution_owner` | `human` |',
    `| \`validation_type\` | \`${journey.validationType}\` |`,
    `| \`重点体验维度\` | ${qualityDimensionLabels(journey.qualityDimensions).join(' / ')} |`,
    `| \`参考 Rubric\` | ${rubrics.join(' / ')} |`,
    '',
    '## 你要验证什么',
    '',
    task.summary,
    '',
    '## 入口',
    '',
    `- ${task.entry}`,
    '',
    '## 操作步骤',
    '',
    ...task.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## 你应该看到什么',
    '',
    ...task.expectedResults.map((result) => `- ${result}`),
    '',
    ...(journey.externalPrerequisites && journey.externalPrerequisites.length > 0
      ? [
          '## 已知外部前置',
          '',
          ...externalPrerequisiteSummaries(journey.externalPrerequisites).map(
            (summary) => `- ${summary}`
          ),
          '- 如果本轮未提供上述前置，请把相关失败记为外部阻塞，不要把它写成页面本身坏了。',
          '',
        ]
      : []),
    ...(task.observationPrompts && task.observationPrompts.length > 0
      ? ['## 重点观察', '', ...task.observationPrompts.map((prompt) => `- ${prompt}`), '']
      : []),
  ];

  return `${lines.join('\n')}\n`;
}

function buildImpactMarkdown(args: CliArgs, impact: ReturnType<typeof inferImpactSet>) {
  const lines = [
    '# Impact Set',
    '',
    '| 字段 | 内容 |',
    '| --- | --- |',
    `| \`release_id\` | \`${args.releaseId}\` |`,
    `| \`registry_version\` | \`${JOURNEY_REGISTRY_VERSION}\` |`,
    `| \`impact_mapping_version\` | \`${IMPACT_MAPPING_VERSION}\` |`,
    '',
    '## Changed Files',
    '',
    ...impact.changedFiles.map((filePath) => `- \`${filePath}\``),
    '',
    '## Matched Rules',
    '',
    ...impact.matchedRules.map(
      (rule) =>
        `- \`${rule.id}\` ${rule.label}: ${rule.journeys.map((journeyId) => `\`${journeyId}\``).join(', ')}`
    ),
    '',
    '## Result',
    '',
    `- 受影响旅程: ${impact.impactedJourneyIds.map((id) => `\`${id}\``).join(', ') || 'none'}`,
    `- 最终门禁集: ${impact.gateJourneyIds.map((id) => `\`${id}\``).join(', ')}`,
    `- 必查质量维度: ${formatQualityDimensions(impact.qualityDimensions).join(' / ') || 'none'}`,
    `- 建议升级 Full Audit: ${impact.requiresFullAudit ? 'yes' : 'no'}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildCodexRunPlanMarkdown(
  args: CliArgs,
  gateJourneys: JourneyDefinition[],
  impact: ReturnType<typeof inferImpactSet>
) {
  const codexJourneys = gateJourneys.filter((journey) => journey.defaultExecutionOwner !== 'human');
  const lines = [
    '# Codex Run Plan',
    '',
    `- release_id: \`${args.releaseId}\``,
    `- registry_version: \`${JOURNEY_REGISTRY_VERSION}\``,
    `- impact_mapping_version: \`${IMPACT_MAPPING_VERSION}\``,
    '',
    '## Codex Must Run',
    '',
    ...codexJourneys.map(
      (journey) =>
        `- \`${journey.id}\` ${journey.title} | ${journey.validationType} | ${qualityDimensionLabels(
          journey.qualityDimensions
        ).join(' / ')}`
    ),
    '',
    '## Notes',
    '',
    `- Baseline Smoke IDs: ${BASELINE_SMOKE_IDS.map((id) => `\`${id}\``).join(', ')}`,
    `- Impact rules hit: ${impact.matchedRules.map((rule) => `\`${rule.id}\``).join(', ') || 'none'}`,
    '',
    '## 已知外部前置',
    '',
    ...(gateJourneys.some((journey) => (journey.externalPrerequisites?.length ?? 0) > 0)
      ? gateJourneys
          .filter((journey) => (journey.externalPrerequisites?.length ?? 0) > 0)
          .flatMap((journey) =>
            externalPrerequisiteSummaries(journey.externalPrerequisites).map(
              (summary) => `- \`${journey.id}\` ${summary}`
            )
          )
      : ['- none']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function buildRunCommand(configPath: string) {
  return `pnpm exec tsx scripts/runtime-release-gate.ts --config "${configPath}"`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const changedFiles = args.changedFiles ?? gitChangedFiles(args.base, args.head);
  const impact = inferImpactSet(changedFiles);
  const gateJourneys = impact.gateJourneyIds
    .map((id) => getJourneyDefinition(id))
    .filter((journey): journey is JourneyDefinition => Boolean(journey));
  const humanJourneys = getHumanReviewJourneys(impact.gateJourneyIds);

  const outDir = outputRoot(args);
  const taskDir = path.join(outDir, 'human-task-cards');
  const configPath = path.join(outDir, 'codex-run-config.json');
  const runCommand = buildRunCommand(configPath);

  await ensureDir(outDir);
  await ensureDir(taskDir);

  await writeJson(path.join(outDir, 'impact-set.json'), {
    releaseId: args.releaseId,
    registryVersion: JOURNEY_REGISTRY_VERSION,
    impactMappingVersion: IMPACT_MAPPING_VERSION,
    changedFiles,
    matchedRules: impact.matchedRules,
    impactedJourneyIds: impact.impactedJourneyIds,
    gateJourneyIds: impact.gateJourneyIds,
    qualityDimensions: impact.qualityDimensions,
    requiresFullAudit: impact.requiresFullAudit,
  });

  await writeJson(configPath, {
    releaseId: args.releaseId,
    registryVersion: JOURNEY_REGISTRY_VERSION,
    impactMappingVersion: IMPACT_MAPPING_VERSION,
    environment: args.environment,
    candidateVersion: args.candidateVersion,
    base: args.base,
    head: args.head,
    gateJourneyIds: impact.gateJourneyIds,
    baselineSmokeIds: BASELINE_SMOKE_IDS,
    humanReviewJourneyIds: humanJourneys.map((journey) => journey.id),
    runtimeAuditScript: 'scripts/runtime-journey-audit.ts',
    runtimeAuditId: args.runtimeAuditId ?? args.releaseId,
    runtimeAuditContext: args.runtimeAuditContext ?? `release gate ${args.releaseId}`,
    runtimeEvidenceRoot:
      args.runtimeEvidenceRoot ?? path.join('e2e-report', 'releases', args.releaseId, 'journeys'),
    journeysCsv: impact.gateJourneyIds.join(','),
    suggestedCommand: runCommand,
  });

  await writeText(path.join(outDir, 'impact-set.md'), buildImpactMarkdown(args, impact));
  await writeText(
    path.join(outDir, 'release-gate-master.md'),
    buildGateMasterMarkdown(args, gateJourneys, impact)
  );
  await writeText(
    path.join(outDir, 'codex-run-plan.md'),
    buildCodexRunPlanMarkdown(args, gateJourneys, impact)
  );
  await writeExecutableShell(
    path.join(outDir, 'run-codex-audit.sh'),
    `#!/usr/bin/env bash
set -euo pipefail

cd "${ROOT}"
pnpm exec tsx scripts/runtime-release-gate.ts --config "${configPath}"
`
  );

  for (const journey of humanJourneys) {
    await writeText(path.join(taskDir, `${journey.id}.md`), buildTaskCardMarkdown(args, journey));
  }

  const readmeLines = [
    `# Release Gate Package: ${args.releaseId}`,
    '',
    `- registry_version: \`${JOURNEY_REGISTRY_VERSION}\``,
    `- impact_mapping_version: \`${IMPACT_MAPPING_VERSION}\``,
    `- environment: \`${args.environment}\``,
    `- candidate_version: \`${args.candidateVersion}\``,
    '',
    '## Files',
    '',
    '- `impact-set.json` / `impact-set.md`',
    '- `release-gate-master.md`',
    '- `codex-run-plan.md`',
    '- `codex-run-config.json`',
    '- `run-codex-audit.sh`',
    '- `codex-runtime-result.json` / `codex-runtime-result.md` (after run)',
    '- `human-handoff.md` (after run)',
    '- `user-journey-audit-section.md` (after run)',
    '- `human-task-cards/`',
    '- gate package 会自动渲染 journey-level external prerequisites / capability gates',
    '',
    `- gate journeys: ${impact.gateJourneyIds.map((id) => `\`${id}\``).join(', ')}`,
    `- human review journeys: ${humanJourneys.map((journey) => `\`${journey.id}\``).join(', ') || 'none'}`,
    `- suggested codex command: \`${runCommand}\``,
    '',
  ];

  await writeText(path.join(outDir, 'README.md'), `${readmeLines.join('\n')}\n`);

  console.log(`Generated release gate package at ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
