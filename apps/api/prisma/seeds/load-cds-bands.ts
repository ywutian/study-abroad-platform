#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

// Lives in apps/api/prisma/seeds/. In dev (tsx) we load the .ts from src/.
// In prod (compiled .js, no src/) we load the compiled .js from dist/. Both
// resolve from the script's directory at runtime — no build-time path
// rewriting required. The orchestrator step in seed-orchestrator.ts and the
// migrate.sh fail-soft step both invoke this same script.
type CdsBandInputRow = {
  schoolId?: string;
  schoolName?: string;
  schoolNameNorm?: string;
  gpaBand: string;
  testType: string;
  testBand?: string;
  admitRate: number;
  sampleCount?: number | null;
  cycleYear: number;
  source: string;
  sourceUrl?: string | null;
};

function loadCdsBandsIngestionService(): any {
  const srcPath = path.resolve(
    __dirname,
    '../../src/modules/prediction/distillation/cds-bands-ingestion.service',
  );
  const distPath = path.resolve(
    __dirname,
    '../../dist/modules/prediction/distillation/cds-bands-ingestion.service',
  );

  const req = require;
  try {
    return req(srcPath).CdsBandsIngestionService;
  } catch {
    return req(distPath).CdsBandsIngestionService;
  }
}
const CdsBandsIngestionService = loadCdsBandsIngestionService();

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main() {
  const file = readArg('file');
  if (!file) {
    throw new Error(
      'Usage: tsx prisma/seeds/load-cds-bands.ts --file rows.json [--apply]',
    );
  }

  const dryRun = !process.argv.includes('--apply');
  const rows = JSON.parse(readFileSync(file, 'utf8')) as CdsBandInputRow[];
  if (!Array.isArray(rows)) {
    throw new Error('CDS bands file must contain a JSON array');
  }

  const prisma = new PrismaClient();
  const service = new CdsBandsIngestionService(prisma as any);
  try {
    const result = await service.ingestRows(rows, { dryRun });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
