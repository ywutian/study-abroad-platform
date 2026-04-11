import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  buildFullSurfaceRegistry,
  FULL_SURFACE_REGISTRY_VERSION,
  type AgentBundleId,
} from './release-gate/full-surface-registry';

interface CliArgs {
  auditDate: string;
  evidenceRoot?: string;
  surfaceIdsCsv?: string;
  batchCsv?: string;
  platformCsv?: string;
  personaCsv?: string;
  chunkSize: number;
  forceRerun: boolean;
  printConfig: boolean;
  webBase?: string;
  apiBase?: string;
}

const ROOT = process.cwd();
const RUNTIME_SCRIPT = path.join(ROOT, 'scripts', 'runtime-full-surface-audit.ts');

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

  const today = new Date().toISOString().slice(0, 10);
  return {
    auditDate: values.get('audit-date') ?? values.get('date') ?? today,
    evidenceRoot: values.get('evidence-root') ?? undefined,
    surfaceIdsCsv: values.get('surface-ids') ?? undefined,
    batchCsv: values.get('batch') ?? undefined,
    platformCsv: values.get('platform') ?? undefined,
    personaCsv: values.get('persona') ?? undefined,
    chunkSize: Math.max(1, Number(values.get('chunk-size') ?? '6')),
    forceRerun: values.get('force-rerun') === 'true' || values.get('force-rerun') === '1',
    printConfig: values.get('print-config') === 'true',
    webBase: values.get('web-base') ?? undefined,
    apiBase: values.get('api-base') ?? undefined,
  };
}

function normalizeBatchFilter(value: string) {
  const trimmed = value.trim();
  const aliasMap: Record<string, AgentBundleId> = {
    '0': 'batch-0-inventory-triage',
    batch0: 'batch-0-inventory-triage',
    'batch-0': 'batch-0-inventory-triage',
    '1': 'batch-1-applicant-web-auth',
    batch1: 'batch-1-applicant-web-auth',
    'batch-1': 'batch-1-applicant-web-auth',
    '2': 'batch-2-applicant-ai-business',
    batch2: 'batch-2-applicant-ai-business',
    'batch-2': 'batch-2-applicant-ai-business',
    '3': 'batch-3-mobile',
    batch3: 'batch-3-mobile',
    'batch-3': 'batch-3-mobile',
    '4': 'batch-4-admin-data-security-mcp',
    batch4: 'batch-4-admin-data-security-mcp',
    'batch-4': 'batch-4-admin-data-security-mcp',
    '5': 'batch-5-forced-closure',
    batch5: 'batch-5-forced-closure',
    'batch-5': 'batch-5-forced-closure',
  };
  return aliasMap[trimmed] ?? (trimmed as AgentBundleId);
}

function splitCsv(value?: string) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function runRuntime(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', RUNTIME_SCRIPT, ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }
      reject(new Error(`runtime-full-surface-audit exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const registry = buildFullSurfaceRegistry();
  const surfaceIdFilter = splitCsv(cli.surfaceIdsCsv);
  const batchFilter = new Set([...splitCsv(cli.batchCsv)].map(normalizeBatchFilter));
  const platformFilter = splitCsv(cli.platformCsv);
  const personaFilter = splitCsv(cli.personaCsv);

  const allSurfaces = [
    ...registry.routeInventory.web,
    ...registry.routeInventory.mobile,
    ...registry.capabilityInventory,
    ...registry.journeyOverlay,
  ];

  const selected = allSurfaces.filter((surface) => {
    if (surfaceIdFilter.size > 0 && !surfaceIdFilter.has(surface.surfaceId)) return false;
    if (batchFilter.size > 0 && !batchFilter.has(surface.agentBundle)) return false;
    if (platformFilter.size > 0 && !platformFilter.has(surface.platform)) return false;
    if (personaFilter.size > 0 && !personaFilter.has(surface.persona)) return false;
    return true;
  });

  if (selected.length === 0) {
    throw new Error('No full-surface entries matched the provided filters.');
  }

  const selectedIds = selected.map((surface) => surface.surfaceId);
  const chunks = chunk(selectedIds, cli.chunkSize);
  const evidenceRoot = cli.evidenceRoot ?? path.join('e2e-report', `full-surface-${cli.auditDate}`);

  if (cli.printConfig) {
    console.log(
      JSON.stringify(
        {
          auditDate: cli.auditDate,
          registryVersion: registry.version,
          fullSurfaceRegistryVersion: FULL_SURFACE_REGISTRY_VERSION,
          evidenceRoot,
          selectedSurfaceCount: selectedIds.length,
          chunkSize: cli.chunkSize,
          chunkCount: chunks.length,
          selectedSurfaceIds: selectedIds,
        },
        null,
        2
      )
    );
    return;
  }

  const commonArgs = [
    '--audit-date',
    cli.auditDate,
    '--evidence-root',
    evidenceRoot,
    ...(cli.webBase ? ['--web-base', cli.webBase] : []),
    ...(cli.apiBase ? ['--api-base', cli.apiBase] : []),
  ];

  for (let index = 0; index < chunks.length; index += 1) {
    const ids = chunks[index];
    console.log(
      `[full-surface-batch] chunk ${index + 1}/${chunks.length} (${ids.length} surfaces): ${ids.join(', ')}`
    );
    await runRuntime([
      ...commonArgs,
      '--surface-ids',
      ids.join(','),
      ...(cli.forceRerun ? ['--force-rerun'] : []),
    ]);
  }

  const summaryScopeArgs =
    surfaceIdFilter.size > 0
      ? ['--surface-ids', selectedIds.join(',')]
      : [
          ...(batchFilter.size > 0 ? ['--batch', [...batchFilter].join(',')] : []),
          ...(platformFilter.size > 0 ? ['--platform', [...platformFilter].join(',')] : []),
          ...(personaFilter.size > 0 ? ['--persona', [...personaFilter].join(',')] : []),
        ];

  await runRuntime([...commonArgs, ...summaryScopeArgs, '--summary-only']);
  console.log(`[full-surface-batch] completed: ${selectedIds.length} surfaces -> ${evidenceRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
