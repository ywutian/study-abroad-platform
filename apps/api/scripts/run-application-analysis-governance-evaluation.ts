import { PrismaClient } from '@prisma/client';

import { ApplicationAnalysisWorkflowService } from '../src/modules/profile/application-analysis-workflow.service';

interface ParsedArgs {
  actorId: string;
  analysisVersion?: string;
  allowFixtureEvidence: boolean;
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

  return {
    actorId: readFlag('actor-id') ?? 'governance-runner',
    analysisVersion: readFlag('analysis-version'),
    allowFixtureEvidence:
      readFlag('allow-fixture-evidence') === 'true' ||
      readFlag('allow-fixture-evidence') === '1',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.analysisVersion?.trim()) {
    throw new Error('Missing required --analysis-version flag.');
  }

  const prisma = new PrismaClient();
  try {
    const workflowService = new ApplicationAnalysisWorkflowService(
      prisma as never,
      {
        delByPrefix: async () => undefined,
      } as never,
      {
        log: async () => undefined,
      } as never,
      {} as never,
    );

    const evaluation =
      await workflowService.runGovernanceEvaluationForAnalysisVersion(
        args.actorId,
        args.analysisVersion,
        {
          mode: 'GOLD_SET',
          allowFixtureEvidence: args.allowFixtureEvidence,
        },
      );

    console.log(
      JSON.stringify(
        {
          evaluationId: evaluation.id,
          analysisVersion: args.analysisVersion,
          actorId: args.actorId,
          allowFixtureEvidence: args.allowFixtureEvidence,
          status: evaluation.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
