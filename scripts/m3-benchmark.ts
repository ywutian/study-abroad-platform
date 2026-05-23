/**
 * M3 Benchmark — 在 99 AdmissionCase + 4 v3 overlap 上跑 M3 Bayesian 引擎
 * 计算 Brier / ECE / Accuracy / 分布对比 / v3 对比
 *
 * 用法：
 *   pnpm exec tsx scripts/m3-benchmark.ts
 *   pnpm exec tsx scripts/m3-benchmark.ts --json > report.json
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { predict, type PredictionOutput } from './m3-bayesian-engine';

const prisma = new PrismaClient();

interface BenchmarkSample {
  source: 'AdmissionCase' | 'v3-overlap';
  caseId: string;
  schoolName: string;
  schoolId: string;
  round: string | null;
  major: string | null;
  year: number;
  actual: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  actualBinary: 0 | 1 | null; // 1=admit, 0=reject, null=non-binary
  v3Prediction: number | null; // 0-1, only for overlap
  m3Prediction: number;
  m3Tier: string;
  m3Confidence: string;
}

// ─── Range parsing utilities ────────────────────────────────────────────────

function parseRangeMidpoint(range: string | null | undefined): number | null {
  if (!range) return null;
  const m = range.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const single = range.match(/(\d+(?:\.\d+)?)/);
  return single ? Number(single[1]) : null;
}

/**
 * Convert AdmissionCase snapshot → synthetic Profile-like object that M3
 * predict() can consume. The case has gpaRange/satRange/tags rather than
 * structured Profile fields.
 */
function caseToProfile(c: any) {
  const gpa =
    c.gpa12 ?? c.gpa11 ?? c.ucCappedGpa ?? c.ucUncappedGpa ?? parseRangeMidpoint(c.gpaRange);

  const sat = parseRangeMidpoint(c.satRange);
  const act = parseRangeMidpoint(c.actRange);
  const toefl = parseRangeMidpoint(c.toeflRange);

  const testScores: Array<{ type: string; score: number }> = [];
  if (sat !== null) testScores.push({ type: 'SAT', score: sat });
  if (act !== null) testScores.push({ type: 'ACT', score: act });
  if (toefl !== null) testScores.push({ type: 'TOEFL', score: toefl });

  // AP count placeholder (case doesn't structure individual AP scores well)
  if (c.apCount && c.apCount > 0) {
    for (let i = 0; i < c.apCount; i += 1) {
      testScores.push({ type: 'AP', score: 4 }); // proxy score
    }
  }

  const tags: string[] = [...(c.tags ?? []), ...(c.demographicTags ?? [])];
  const activities = Array.isArray(c.activities)
    ? c.activities.map((a: any) => ({
        name: a.description || a.name,
        category: a.category,
        role: a.role || 'participant',
        hoursPerWeek: a.hoursPerWeek,
        weeksPerYear: a.weeksPerYear,
      }))
    : tags.map((tag) => ({
        name: tag,
        category: 'other',
        role: tag.includes('captain') || tag.includes('president') ? 'captain' : 'participant',
        hoursPerWeek: 5,
        weeksPerYear: 36,
      }));

  const awards = Array.isArray(c.awards)
    ? c.awards.map((a: any) => ({
        name: a.name,
        level: a.level,
        year: a.year,
      }))
    : [];

  return {
    gpa,
    gpaScale: c.gpaScale ?? 4.0,
    gpa9: c.gpa9,
    gpa10: c.gpa10,
    gpa11: c.gpa11,
    gpa12: c.gpa12,
    targetMajor: c.major,
    applicationRound: c.round,
    nationality: c.nationality,
    legacy: tags.includes('legacy') ? [c.school?.name] : [],
    firstGeneration: tags.includes('first_gen'),
    recruitedAthlete: tags.includes('athlete'),
    recruitedCoachStatus: tags.includes('athlete') ? 'UNVERIFIED' : null,
    applyingTestOptional: testScores.length === 0,
    testScores,
    activities,
    awards,
  };
}

// ─── Metrics ────────────────────────────────────────────────────────────────

function brierScore(samples: BenchmarkSample[]): number {
  const binary = samples.filter((s) => s.actualBinary !== null);
  if (binary.length === 0) return NaN;
  const sum = binary.reduce((acc, s) => acc + (s.m3Prediction - s.actualBinary!) ** 2, 0);
  return sum / binary.length;
}

function accuracyAtHalf(samples: BenchmarkSample[]): number {
  const binary = samples.filter((s) => s.actualBinary !== null);
  if (binary.length === 0) return NaN;
  const correct = binary.filter((s) => (s.m3Prediction >= 0.5 ? 1 : 0) === s.actualBinary).length;
  return correct / binary.length;
}

function ece(samples: BenchmarkSample[], bins = 10): number {
  const binary = samples.filter((s) => s.actualBinary !== null);
  if (binary.length === 0) return NaN;
  const buckets: Array<{ sumP: number; admits: number; n: number }> = Array.from(
    { length: bins },
    () => ({ sumP: 0, admits: 0, n: 0 })
  );
  for (const s of binary) {
    const idx = Math.min(bins - 1, Math.floor(s.m3Prediction * bins));
    buckets[idx].sumP += s.m3Prediction;
    buckets[idx].admits += s.actualBinary!;
    buckets[idx].n += 1;
  }
  let total = 0;
  const N = binary.length;
  for (const b of buckets) {
    if (b.n === 0) continue;
    const meanP = b.sumP / b.n;
    const meanActual = b.admits / b.n;
    total += (b.n / N) * Math.abs(meanP - meanActual);
  }
  return total;
}

function calibrationBins(samples: BenchmarkSample[], bins = 10) {
  const binary = samples.filter((s) => s.actualBinary !== null);
  const out: Array<{ bin: string; n: number; meanPredicted: number; meanActual: number }> = [];
  for (let i = 0; i < bins; i += 1) {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    const inBin = binary.filter(
      (s) => s.m3Prediction >= lo && (i === bins - 1 ? s.m3Prediction <= hi : s.m3Prediction < hi)
    );
    if (inBin.length === 0) continue;
    out.push({
      bin: `${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`,
      n: inBin.length,
      meanPredicted: inBin.reduce((a, s) => a + s.m3Prediction, 0) / inBin.length,
      meanActual: inBin.reduce((a, s) => a + s.actualBinary!, 0) / inBin.length,
    });
  }
  return out;
}

function slice<T extends string | number | null>(
  samples: BenchmarkSample[],
  keyFn: (s: BenchmarkSample) => T
) {
  const groups = new Map<string, BenchmarkSample[]>();
  for (const s of samples) {
    const k = String(keyFn(s) ?? '(null)');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  return Array.from(groups.entries()).map(([k, arr]) => {
    const binary = arr.filter((s) => s.actualBinary !== null);
    const admitRate = binary.length
      ? binary.reduce((a, s) => a + s.actualBinary!, 0) / binary.length
      : NaN;
    const meanPred = arr.reduce((a, s) => a + s.m3Prediction, 0) / arr.length;
    return {
      slice: k,
      n: arr.length,
      admitRate,
      meanPredicted: meanPred,
      brier: brierScore(arr),
    };
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const reportPath = args.includes('--save-report');

  console.log('Loading AdmissionCase + School + v3 overlap...');

  const cases = await prisma.admissionCase.findMany({
    where: { result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] } },
    include: {
      school: { select: { name: true } },
    },
  });
  console.log(`  Loaded ${cases.length} AdmissionCase rows`);

  // Find v3 overlap predictions (for cross-engine comparison)
  const v3Overlap = await prisma.$queryRaw<
    Array<{
      caseId: string;
      v3Probability: number;
    }>
  >`
    SELECT ac.id AS "caseId", pr.probability::float AS "v3Probability"
    FROM "AdmissionCase" ac
    INNER JOIN "Profile" prof ON prof."userId" = ac."userId"
    INNER JOIN "PredictionResult" pr ON pr."profileId" = prof.id AND pr."schoolId" = ac."schoolId"
    WHERE pr.source = 'prediction'
  `;
  const v3Map = new Map(v3Overlap.map((r) => [r.caseId, Number(r.v3Probability)]));
  console.log(`  Found ${v3Map.size} v3 overlap pairs (real prediction × real outcome)`);

  // Pre-fetch all schools with programs
  const schoolIds = [...new Set(cases.map((c) => c.schoolId))];
  const schoolsFull = await prisma.school.findMany({
    where: { id: { in: schoolIds } },
    include: { programs: true },
  });
  const schoolMap = new Map(schoolsFull.map((s) => [s.id, s]));

  // Run M3 predict on each
  console.log('Running M3 Bayesian predict on each case...');
  const samples: BenchmarkSample[] = [];
  let failed = 0;

  for (const c of cases) {
    const school = schoolMap.get(c.schoolId);
    if (!school) {
      failed += 1;
      continue;
    }
    try {
      const profile = caseToProfile({ ...c, school });
      const output: PredictionOutput = predict(profile, school);
      const actualBinary: 0 | 1 | null =
        c.result === 'ADMITTED' ? 1 : c.result === 'REJECTED' ? 0 : null;

      samples.push({
        source: v3Map.has(c.id) ? 'v3-overlap' : 'AdmissionCase',
        caseId: c.id,
        schoolName: c.school?.name ?? '?',
        schoolId: c.schoolId,
        round: c.round,
        major: c.major,
        year: c.year,
        actual: c.result as any,
        actualBinary,
        v3Prediction: v3Map.get(c.id) ?? null,
        m3Prediction: output.probability,
        m3Tier: output.tier,
        m3Confidence: output.confidence,
      });
    } catch (err) {
      failed += 1;
      console.error(`Failed for case ${c.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`  ${samples.length} samples, ${failed} failed\n`);

  // ─── Build report ─────────────────────────────────────────────────────────

  const binary = samples.filter((s) => s.actualBinary !== null);
  const v3Samples = samples.filter((s) => s.v3Prediction !== null);

  const report = {
    meta: {
      runAt: new Date().toISOString(),
      totalSamples: samples.length,
      binarySamples: binary.length,
      v3OverlapSamples: v3Samples.length,
      admitRate: binary.length
        ? binary.reduce((a, s) => a + s.actualBinary!, 0) / binary.length
        : NaN,
    },
    m3Metrics: {
      brier: brierScore(samples),
      accuracyAtHalf: accuracyAtHalf(samples),
      ece10bin: ece(samples, 10),
      ece5bin: ece(samples, 5),
      meanPredicted: samples.reduce((a, s) => a + s.m3Prediction, 0) / samples.length,
    },
    v3VsM3OnOverlap: v3Samples.map((s) => ({
      school: s.schoolName,
      round: s.round,
      actual: s.actual,
      v3: s.v3Prediction,
      m3: s.m3Prediction,
      delta: s.m3Prediction - (s.v3Prediction ?? 0),
    })),
    v3MetricsOnOverlap: {
      n: v3Samples.length,
      brier: (() => {
        const binV3 = v3Samples.filter((s) => s.actualBinary !== null);
        if (binV3.length === 0) return NaN;
        return (
          binV3.reduce((acc, s) => acc + (s.v3Prediction! - s.actualBinary!) ** 2, 0) / binV3.length
        );
      })(),
      meanPredicted: v3Samples.reduce((a, s) => a + (s.v3Prediction ?? 0), 0) / v3Samples.length,
    },
    m3MetricsOnOverlap: {
      n: v3Samples.length,
      brier: brierScore(v3Samples),
      meanPredicted: v3Samples.reduce((a, s) => a + s.m3Prediction, 0) / v3Samples.length,
    },
    calibrationBins: calibrationBins(samples, 10),
    slices: {
      byRound: slice(samples, (s) => s.round),
      byResult: slice(samples, (s) => s.actual),
      byTier: slice(samples, (s) => s.m3Tier),
      byYear: slice(samples, (s) => s.year),
      bySchool: slice(samples, (s) => s.schoolName)
        .filter((sl) => sl.n >= 2)
        .sort((a, b) => b.n - a.n)
        .slice(0, 10),
    },
    extremes: {
      mostUnderPredicted: samples
        .filter((s) => s.actual === 'ADMITTED')
        .sort((a, b) => a.m3Prediction - b.m3Prediction)
        .slice(0, 5)
        .map((s) => ({
          school: s.schoolName,
          round: s.round,
          m3: s.m3Prediction,
          v3: s.v3Prediction,
        })),
      mostOverPredicted: samples
        .filter((s) => s.actual === 'REJECTED')
        .sort((a, b) => b.m3Prediction - a.m3Prediction)
        .slice(0, 5)
        .map((s) => ({
          school: s.schoolName,
          round: s.round,
          m3: s.m3Prediction,
          v3: s.v3Prediction,
        })),
    },
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    await prisma.$disconnect();
    return;
  }

  // Pretty print
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : 'n/a');
  const pct = (n: number) => (Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : 'n/a');

  console.log('═══ Overall Metrics ═══');
  console.log(
    `  Samples:              ${report.meta.totalSamples} (${report.meta.binarySamples} binary)`
  );
  console.log(`  Actual admit rate:    ${pct(report.meta.admitRate)} (selection-biased ↑)`);
  console.log(`  M3 mean predicted:    ${pct(report.m3Metrics.meanPredicted)}`);
  console.log(`  M3 Brier:             ${fmt(report.m3Metrics.brier)}     (target ≤ 0.20)`);
  console.log(`  M3 Accuracy@0.5:      ${pct(report.m3Metrics.accuracyAtHalf)}`);
  console.log(`  M3 ECE (10-bin):      ${fmt(report.m3Metrics.ece10bin)}     (target ≤ 0.05)`);
  console.log(`  M3 ECE (5-bin):       ${fmt(report.m3Metrics.ece5bin)}`);

  console.log('\n═══ v3 vs M3 on Overlap (4 real (predict, outcome) pairs) ═══');
  console.table(
    report.v3VsM3OnOverlap.map((r) => ({
      school: r.school,
      round: r.round,
      actual: r.actual,
      v3: pct(r.v3 ?? 0),
      m3: pct(r.m3),
      delta: `${r.delta >= 0 ? '+' : ''}${(r.delta * 100).toFixed(1)}pp`,
    }))
  );
  console.log(
    `  v3 Brier on overlap:  ${fmt(report.v3MetricsOnOverlap.brier)} (mean ${pct(report.v3MetricsOnOverlap.meanPredicted)})`
  );
  console.log(
    `  M3 Brier on overlap:  ${fmt(report.m3MetricsOnOverlap.brier)} (mean ${pct(report.m3MetricsOnOverlap.meanPredicted)})`
  );

  console.log('\n═══ Calibration Bins ═══');
  console.table(
    report.calibrationBins.map((b) => ({
      bin: b.bin,
      n: b.n,
      meanPred: pct(b.meanPredicted),
      meanActual: pct(b.meanActual),
      gap: pct(b.meanPredicted - b.meanActual),
    }))
  );

  console.log('\n═══ Slice by outcome ═══');
  console.table(
    report.slices.byResult.map((s) => ({
      outcome: s.slice,
      n: s.n,
      m3Mean: pct(s.meanPredicted),
      actualAdmit: pct(s.admitRate),
    }))
  );

  console.log('\n═══ Slice by round ═══');
  console.table(
    report.slices.byRound.map((s) => ({
      round: s.slice,
      n: s.n,
      m3Mean: pct(s.meanPredicted),
      admitRate: pct(s.admitRate),
      brier: fmt(s.brier),
    }))
  );

  console.log('\n═══ Slice by school (top 10) ═══');
  console.table(
    report.slices.bySchool.map((s) => ({
      school: s.slice,
      n: s.n,
      m3Mean: pct(s.meanPredicted),
      admitRate: pct(s.admitRate),
    }))
  );

  console.log('\n═══ Most under-predicted ADMITs (M3 said low, actually admitted) ═══');
  console.table(
    report.extremes.mostUnderPredicted.map((e) => ({
      school: e.school,
      round: e.round,
      m3: pct(e.m3),
      v3: e.v3 !== null && e.v3 !== undefined ? pct(e.v3) : '-',
    }))
  );

  console.log('\n═══ Most over-predicted REJECTs (M3 said high, actually rejected) ═══');
  console.table(
    report.extremes.mostOverPredicted.map((e) => ({
      school: e.school,
      round: e.round,
      m3: pct(e.m3),
      v3: e.v3 !== null && e.v3 !== undefined ? pct(e.v3) : '-',
    }))
  );

  // Selection bias warning
  console.log('\n═══ ⚠️  Selection Bias Warning ═══');
  console.log(
    `  AdmissionCase pool admit rate: ${pct(report.meta.admitRate)} (heavy positive bias)`
  );
  console.log(`  Real admissions at these schools: typically 4-15%`);
  console.log(
    `  → Brier here is INFLATED because most samples ADMIT, M3 outputs avg ${pct(report.m3Metrics.meanPredicted)}`
  );
  console.log(`  → ECE is more meaningful; calibration bins show where systematic offset is`);
  console.log(`  → Real validation requires verified outcomes (M6 流程, 3-6 month horizon)`);

  if (reportPath) {
    const outFile = join(
      process.cwd(),
      `scripts/m3-benchmark-report-${new Date().toISOString().slice(0, 10)}.json`
    );
    writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to ${outFile}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
