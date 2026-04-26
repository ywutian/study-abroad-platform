#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import {
  CdsBandsIngestionService,
  type CdsBandInputRow,
} from '../src/modules/prediction/distillation/cds-bands-ingestion.service';

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
      'Usage: tsx scripts/load-cds-bands.ts --file rows.json [--apply]',
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
