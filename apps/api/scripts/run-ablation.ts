import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AblationRunnerService } from '../src/modules/prediction/benchmark/ablation-runner.service';
import {
  ALL_VARIANT_KEYS,
  type AblationVariantKey,
} from '../src/modules/prediction/benchmark/ablation-variants';
import { PrismaService } from '../src/prisma/prisma.service';

type Args = {
  profileId: string;
  schoolIds: string[];
  topN?: number;
  variants: AblationVariantKey[];
  out?: string;
  locale: string;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) =>
    argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1];
  const profileId = get('--profile') ?? '';
  const schoolsRaw = get('--schools') ?? '';
  const topN = get('--top');
  const variantsRaw = get('--variants') ?? 'all';
  const out = get('--out');
  const locale = get('--locale') ?? 'zh';

  const schoolIds = schoolsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const variants: AblationVariantKey[] =
    variantsRaw === 'all'
      ? [...ALL_VARIANT_KEYS]
      : (variantsRaw.split(',').map((s) => s.trim()) as AblationVariantKey[]);

  return {
    profileId,
    schoolIds,
    topN: topN ? Number(topN) : undefined,
    variants,
    out,
    locale,
  };
}

function usage() {
  console.error(
    [
      'Usage:',
      '  pnpm --filter api exec tsx scripts/run-ablation.ts \\',
      '    --profile=<Profile.id> \\',
      '    (--schools=<id1,id2,...> | --top=<N>) \\',
      '    [--variants=all|baseline,no-essay,...] \\',
      '    [--out=<path.csv>] [--locale=zh|en]',
      '',
      `Variants: ${ALL_VARIANT_KEYS.join(' | ')}`,
    ].join('\n'),
  );
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const keys = Array.from(
    rows.reduce<Set<string>>((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.join(',');
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

async function resolveSchoolIds(
  prisma: PrismaService,
  args: Args,
): Promise<string[]> {
  if (args.schoolIds.length > 0) return args.schoolIds;
  if (args.topN && args.topN > 0) {
    const schools = await prisma.school.findMany({
      where: { usNewsRank: { not: null } },
      orderBy: { usNewsRank: 'asc' },
      take: args.topN,
      select: { id: true },
    });
    return schools.map((s) => s.id);
  }
  return [];
}

async function main() {
  const args = parseArgs();
  if (!args.profileId) {
    usage();
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const runner = app.get(AblationRunnerService);
    const prisma = app.get(PrismaService);

    const schoolIds = await resolveSchoolIds(prisma, args);
    if (schoolIds.length === 0) {
      console.error(
        'No schools resolved. Provide --schools=<csv> or --top=<N>.',
      );
      process.exit(1);
    }

    console.log(
      `Running ablation: profile=${args.profileId} schools=${schoolIds.length} variants=${args.variants.length}`,
    );
    const output = await runner.runForProfileId(
      args.profileId,
      schoolIds,
      args.variants,
      args.locale,
    );

    // Summary table
    console.log('\nVariant summary (delta vs baseline):');
    console.log(
      'variant                | N  | mean Δpp | |Δ|pp mean | max |Δ|pp | tier flip',
    );
    console.log(
      '-----------------------|----|----------|------------|-----------|----------',
    );
    for (const s of output.summary) {
      console.log(
        [
          s.variant.padEnd(22),
          String(s.schoolsEvaluated).padStart(2),
          s.meanDeltaPp.toFixed(2).padStart(8),
          s.meanAbsDeltaPp.toFixed(2).padStart(10),
          s.maxAbsDeltaPp.toFixed(2).padStart(9),
          (s.tierFlipRate * 100).toFixed(1).padStart(7) + '%',
        ].join(' | '),
      );
    }

    const outPath =
      args.out ??
      path.resolve(
        process.cwd(),
        `apps/api/diagnostic-reports/ablation-${args.profileId}-${Date.now()}.csv`,
      );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, toCsv(output.rows as any), 'utf8');
    console.log(`\nCSV written: ${outPath}`);

    const summaryPath = outPath.replace(/\.csv$/, '.summary.json');
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          profileId: output.profileId,
          variantCount: output.variantCount,
          schoolCount: output.schoolCount,
          summary: output.summary,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Summary written: ${summaryPath}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
