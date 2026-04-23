import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HistoricalBacktestService } from '../src/modules/prediction/benchmark/historical-backtest.service';

type Args = {
  years?: number[];
  schoolIds?: string[];
  limit?: number;
  out?: string;
  results?: ('ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED')[];
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string) =>
    argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1];
  return {
    years: get('--years')
      ?.split(',')
      .map((s) => Number(s.trim()))
      .filter(Number.isFinite),
    schoolIds: get('--schools')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    limit: get('--limit') ? Number(get('--limit')) : undefined,
    out: get('--out'),
    results:
      (get('--results')
        ?.split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean) as any) ?? undefined,
  };
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
  return `${keys.join(',')}\n${rows
    .map((r) => keys.map((k) => esc(r[k])).join(','))
    .join('\n')}\n`;
}

async function main() {
  const args = parseArgs();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.get(HistoricalBacktestService);
    const output = await service.run({
      years: args.years,
      schoolIds: args.schoolIds,
      limit: args.limit,
      results: args.results,
    });

    const s = output.summary;
    console.log('\nBacktest summary:');
    console.log(`  cases            ${s.totalCases}`);
    if (s.totalCases === 0) {
      console.log(
        '  No matching cases. Relax --years / --schools / --limit or confirm AdmissionCase has isVerified + reviewStatus=APPROVED rows.',
      );
      return;
    }
    console.log(
      `  Brier score      ${s.brierScore.toFixed(4)} (lower = better)`,
    );
    console.log(`  Log-loss         ${s.logLoss.toFixed(4)} (lower = better)`);
    console.log(`  Accuracy @0.5    ${(s.accuracy * 100).toFixed(1)}%`);
    console.log(`  ROC-AUC          ${s.auc.toFixed(3)}`);
    console.log(`  ECE (10 bins)    ${s.ece10.toFixed(4)}`);
    console.log('\nReliability bins (predicted vs actual admit rate):');
    for (const b of s.reliabilityBins) {
      if (b.count === 0) continue;
      console.log(
        `  [${b.lower.toFixed(1)}, ${b.upper.toFixed(1)})  n=${String(b.count).padStart(4)}  pred=${b.meanPredicted.toFixed(3)}  actual=${b.meanActual.toFixed(3)}  |Δ|=${Math.abs(b.meanPredicted - b.meanActual).toFixed(3)}`,
      );
    }
    console.log('\nBy predicted tier:');
    for (const [tier, v] of Object.entries(s.byTier)) {
      console.log(
        `  ${tier.padEnd(8)}  n=${String(v.count).padStart(4)}  pred=${v.meanPredicted.toFixed(3)}  actual=${v.meanActual.toFixed(3)}`,
      );
    }

    const outPath =
      args.out ??
      path.resolve(
        process.cwd(),
        `apps/api/diagnostic-reports/backtest-${Date.now()}.csv`,
      );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, toCsv(output.rows as any), 'utf8');
    fs.writeFileSync(
      outPath.replace(/\.csv$/, '.summary.json'),
      JSON.stringify(output.summary, null, 2),
      'utf8',
    );
    console.log(`\nCSV written: ${outPath}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
