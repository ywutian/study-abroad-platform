import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Prisma, PrismaClient } from '@prisma/client';

type GovernanceMode = 'pr' | 'nightly';

interface ParsedArgs {
  mode: GovernanceMode;
}

interface CommandResult {
  name: string;
  command: string;
  args: string[];
  exitCode: number;
  success: boolean;
  durationMs: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const inline = argv.find((value) => value.startsWith('--mode='));
  const nextIndex = argv.indexOf('--mode');
  const modeValue = inline
    ? inline.slice('--mode='.length)
    : nextIndex >= 0
      ? argv[nextIndex + 1]
      : undefined;

  return {
    mode: modeValue === 'nightly' ? 'nightly' : 'pr',
  };
}

function asRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function workflowRunUrl() {
  const server = process.env.GITHUB_SERVER_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (server && repo && runId) {
    return `${server}/${repo}/actions/runs/${runId}`;
  }
  return null;
}

function getCommitSha() {
  return process.env.GITHUB_SHA ?? 'local';
}

async function runCommand(
  name: string,
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<CommandResult> {
  const startedAt = Date.now();
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...env,
      },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  return {
    name,
    command,
    args,
    exitCode,
    success: exitCode === 0,
    durationMs: Date.now() - startedAt,
  };
}

async function findLatestReplayRun(prisma: PrismaClient, dataset: string) {
  return prisma.applicationAnalysisReplayRun.findFirst({
    where: { dataset },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

async function writeGovernanceReport(input: {
  mode: GovernanceMode;
  deterministicReplayId: string | null;
  liveReplayId: string | null;
  suites: CommandResult[];
  deterministicMetrics: Record<string, unknown>;
  liveMetrics: Record<string, unknown>;
}) {
  const reportsDir = path.join(ROOT, 'apps', 'api', 'gold-cases', 'reports');
  await mkdir(reportsDir, { recursive: true });
  const stem = `application-analysis-governance-${input.mode}-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
  const jsonPath = path.join(reportsDir, `${stem}.json`);
  const markdownPath = path.join(reportsDir, `${stem}.md`);
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    commitSha: getCommitSha(),
    workflowRunUrl: workflowRunUrl(),
    deterministicReplayId: input.deterministicReplayId,
    liveReplayId: input.liveReplayId,
    deterministicMetrics: input.deterministicMetrics,
    liveMetrics: input.liveMetrics,
    suites: input.suites,
  };
  const markdown = [
    '# Application Analysis Governance',
    '',
    `- Mode: \`${input.mode}\``,
    `- Commit: \`${getCommitSha()}\``,
    `- Workflow: \`${workflowRunUrl() ?? 'local'}\``,
    `- Deterministic replay: \`${input.deterministicReplayId ?? 'n/a'}\``,
    `- Live replay: \`${input.liveReplayId ?? 'n/a'}\``,
    '',
    '## Suites',
    '',
    ...input.suites.map(
      (suite) => `- ${suite.name}: \`${suite.success ? 'PASS' : 'FAIL'}\` (${suite.durationMs}ms)`
    ),
    '',
    '## Deterministic Metrics',
    '',
    `- webRenderPass: \`${String(input.deterministicMetrics.webRenderPass ?? 'null')}\``,
    `- mobileRenderPass: \`${String(input.deterministicMetrics.mobileRenderPass ?? 'null')}\``,
    `- webVisualPass: \`${String(input.deterministicMetrics.webVisualPass ?? 'null')}\``,
    `- liveGoldPassRate: \`${String(input.deterministicMetrics.liveGoldPassRate ?? 'null')}\``,
    `- journeyPassRate: \`${String(input.deterministicMetrics.journeyPassRate ?? 'null')}\``,
    '',
  ].join('\n');

  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${markdown}\n`, 'utf8');

  return {
    reportPath: path.relative(path.join(ROOT, 'apps', 'api'), markdownPath),
    reportJsonPath: path.relative(path.join(ROOT, 'apps', 'api'), jsonPath),
  };
}

const ROOT = process.cwd();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const suiteEnv = {
      ENABLE_E2E_FIXTURES: 'true',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4101',
    };

    const suites: CommandResult[] = [];
    suites.push(
      await runCommand('deterministic-replay', 'pnpm', [
        '--filter',
        'api',
        'gold:replay',
        '--',
        '--mode=deterministic',
      ])
    );
    suites.push(
      await runCommand(
        'web-dom-parity',
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          'e2e/application-analysis-render.spec.ts',
          '--reporter=list',
        ],
        suiteEnv
      )
    );
    suites.push(
      await runCommand('mobile-rn-parity', 'pnpm', [
        '--filter',
        'study-abroad-mobile',
        'test',
        '--',
        'src/__tests__/screens/profile-analysis.test.tsx',
        '--runInBand',
      ])
    );

    let liveReplay = null as Awaited<ReturnType<typeof findLatestReplayRun>> | null;
    let liveReplayMetrics: Record<string, unknown> = {};
    if (args.mode === 'nightly') {
      suites.push(
        await runCommand('live-replay', 'pnpm', [
          '--filter',
          'api',
          'gold:replay',
          '--',
          '--mode=live',
          '--tag=nightly-live',
          '--limit=5',
          '--persist-run',
        ])
      );
      suites.push(
        await runCommand(
          'web-visual-parity',
          'pnpm',
          [
            'exec',
            'playwright',
            'test',
            'e2e/application-analysis-visual.spec.ts',
            '--reporter=list',
          ],
          suiteEnv
        )
      );
      suites.push(
        await runCommand('runtime-journey-audit', 'pnpm', [
          'exec',
          'tsx',
          'scripts/runtime-journey-audit.ts',
          '--journeys',
          'AA1',
          '--audit-id',
          'application-analysis-nightly',
        ])
      );
      liveReplay = await findLatestReplayRun(prisma, 'gold:live:nightly:v1');
      liveReplayMetrics = asRecord(liveReplay?.metrics);
    }

    const deterministicReplay = await findLatestReplayRun(prisma, 'gold:deterministic:v1');
    if (!deterministicReplay) {
      throw new Error('Deterministic governance replay was not recorded.');
    }

    const deterministicMetrics = {
      ...asRecord(deterministicReplay.metrics),
      webRenderPass: suites.find((suite) => suite.name === 'web-dom-parity')?.success ?? false,
      mobileRenderPass: suites.find((suite) => suite.name === 'mobile-rn-parity')?.success ?? false,
      webVisualPass:
        args.mode === 'nightly'
          ? (suites.find((suite) => suite.name === 'web-visual-parity')?.success ?? false)
          : null,
      liveGoldPassRate:
        args.mode === 'nightly'
          ? typeof liveReplayMetrics.goldPassRate === 'number'
            ? liveReplayMetrics.goldPassRate
            : liveReplay?.status === 'COMPLETED'
              ? 1
              : 0
          : null,
      journeyPassRate:
        args.mode === 'nightly'
          ? suites.find((suite) => suite.name === 'runtime-journey-audit')?.success
            ? 1
            : 0
          : null,
    } satisfies Record<string, unknown>;

    suites.push(
      await runCommand('governance-evaluation-record', 'pnpm', [
        '--filter',
        'api',
        'exec',
        'ts-node',
        '--transpile-only',
        'scripts/run-application-analysis-governance-evaluation.ts',
        '--analysis-version',
        deterministicReplay.analysisVersion,
        '--actor-id',
        'governance-runner',
        '--allow-fixture-evidence',
        'true',
      ])
    );

    const reportPaths = await writeGovernanceReport({
      mode: args.mode,
      deterministicReplayId: deterministicReplay.id,
      liveReplayId: liveReplay?.id ?? null,
      suites,
      deterministicMetrics,
      liveMetrics: liveReplayMetrics,
    });

    const previousSummary = asRecord(deterministicReplay.summary);
    const deterministicSummary = {
      ...previousSummary,
      workflowMode: args.mode,
      provenance: {
        commitSha: getCommitSha(),
        workflowRunUrl: workflowRunUrl(),
        artifactNames: ['gold-cases/reports', 'e2e-report'],
        suiteResults: suites,
        updatedAt: new Date().toISOString(),
      },
      liveReplayId: liveReplay?.id ?? null,
      liveDataset: liveReplay?.dataset ?? null,
      liveReportPath: asRecord(liveReplay?.summary).reportPath ?? null,
      replayReportPath: previousSummary.reportPath ?? null,
      replayReportJsonPath: previousSummary.reportJsonPath ?? null,
      reportPath: reportPaths.reportPath,
      reportJsonPath: reportPaths.reportJsonPath,
      renderParityMode: {
        web: 'dom_blocking',
        mobile: 'rn_screen',
        webVisual: args.mode === 'nightly' ? 'screenshot_diff' : null,
      },
    };

    const mergedFailures = [
      ...((Array.isArray(deterministicReplay.failures)
        ? deterministicReplay.failures
        : []) as string[]),
      ...suites.filter((suite) => !suite.success).map((suite) => `${suite.name} failed`),
    ];

    await prisma.applicationAnalysisReplayRun.update({
      where: { id: deterministicReplay.id },
      data: {
        metrics: deterministicMetrics as Prisma.InputJsonValue,
        summary: deterministicSummary as Prisma.InputJsonValue,
        failures: [...new Set(mergedFailures)] as Prisma.InputJsonValue,
      },
    });

    const blockingSuites =
      args.mode === 'nightly'
        ? suites
        : suites.filter((suite) =>
            [
              'deterministic-replay',
              'web-dom-parity',
              'mobile-rn-parity',
              'governance-evaluation-record',
            ].includes(suite.name)
          );

    if (blockingSuites.some((suite) => !suite.success)) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
