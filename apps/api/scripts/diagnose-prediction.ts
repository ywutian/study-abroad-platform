/**
 * Prediction System Diagnostic
 *
 * 诊断脚本。回答：
 *   1. 有多少条 verified outcome 可用？数据够不够做统计诊断？
 *   2. 整体是高估还是低估？
 *   3. 哪段概率校准最差？
 *   4. 各引擎（stats / ai / historical）单独的偏移是什么？
 *   5. Top N worst cases 是什么样子？
 *
 * 数据源（默认全部叠加，可用 flag 关掉）:
 *   verified outcome PredictionResult  —— 默认开
 *   SELF_REPORTED outcome PredictionResult —— 默认开 (--no-self-reported 关闭)
 *   hindcast on verified AdmissionCase —— 默认开 (--no-hindcast 关闭)
 *
 * 输出:
 *   - stdout 人类可读
 *   - apps/api/diagnostic-reports/<timestamp>_<git_sha>.md 机器/git 可读
 *   - 报告顶部的 ```json summary``` 块供 diag:compare 解析
 *
 * 用法:
 *   pnpm --filter api diag:run
 *   pnpm --filter api diag:run --no-hindcast
 *   pnpm --filter api diag:run --worst=30
 *
 * 不对外、不改库、不训练，只读 + 打印 + 写报告。
 */

import { PrismaClient } from '@prisma/client';
import {
  resolveCanonicalPredictionOutcome,
  VERIFIED_OUTCOME_STATUSES,
} from '@study-abroad/shared/scoring';
import {
  calculateOverallScore,
  calculateProbability,
  calculateTier,
} from '@study-abroad/shared/scoring';
import type {
  ProfileMetrics,
  SchoolMetrics,
} from '@study-abroad/shared/scoring';
import { parseCaseTestScores } from '../src/common/constants/data-formats';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type Args = {
  includeSelfReported: boolean;
  hindcast: boolean;
  worstN: number;
  reportDir: string;
  writeReport: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  return {
    // 默认开，用 --no-* flag 关闭（兼容旧 --include-self-reported / --hindcast）
    includeSelfReported:
      !argv.includes('--no-self-reported') && !argv.includes('--verified-only'),
    hindcast: !argv.includes('--no-hindcast'),
    worstN: Number(
      argv.find((a) => a.startsWith('--worst='))?.split('=')[1] ?? 20,
    ),
    reportDir:
      argv.find((a) => a.startsWith('--report-dir='))?.split('=')[1] ??
      path.join(__dirname, '..', 'diagnostic-reports'),
    writeReport: !argv.includes('--no-report'),
  };
}

// ============================================================
// TEE logger: 同时 console.log 并写入 markdown 报告缓冲
// ============================================================

const reportBuffer: string[] = [];
const origLog = console.log.bind(console);
console.log = ((...args: any[]) => {
  origLog(...args);
  reportBuffer.push(
    args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
  );
}) as any;

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'nogit';
  }
}

function gitDirty(): boolean {
  try {
    return (
      execSync('git status --porcelain', { encoding: 'utf-8' }).trim().length >
      0
    );
  } catch {
    return false;
  }
}

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '  —  ';
  return n.toFixed(digits).padStart(digits + 4, ' ');
}

function bar(pct: number, width = 20): string {
  const filled = Math.round(pct * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

function section(title: string) {
  console.log('\n' + '═'.repeat(76));
  console.log(' ' + title);
  console.log('═'.repeat(76));
}

function parseRangeMidpoint(range?: string | null): number | undefined {
  if (!range) return undefined;
  const m = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
  const s = parseFloat(range);
  return Number.isNaN(s) ? undefined : s;
}

// 同 training-data.service 里的逻辑
function schoolToMetrics(school: any): SchoolMetrics {
  return {
    acceptanceRate: school.acceptanceRate
      ? Number(school.acceptanceRate)
      : undefined,
    satAvg: school.satAvg ?? undefined,
    sat25: school.sat25 ?? undefined,
    sat75: school.sat75 ?? undefined,
    actAvg: school.actAvg ?? undefined,
    act25: school.act25 ?? undefined,
    act75: school.act75 ?? undefined,
    usNewsRank: school.usNewsRank ?? undefined,
    graduationRate: school.graduationRate
      ? Number(school.graduationRate)
      : undefined,
  };
}

function caseToProfileMetrics(c: any): ProfileMetrics {
  const testScores = parseCaseTestScores(c.testScores);
  const sat = testScores.find((t: any) => t.type === 'SAT')?.score;
  const act = testScores.find((t: any) => t.type === 'ACT')?.score;
  const toefl = testScores.find((t: any) => t.type === 'TOEFL')?.score;

  return {
    gpa: parseRangeMidpoint(c.gpaRange),
    gpaScale: 4.0,
    satScore: sat ?? parseRangeMidpoint(c.satRange),
    actScore: act ?? parseRangeMidpoint(c.actRange),
    toeflScore: toefl ?? parseRangeMidpoint(c.toeflRange),
    activityCount: Array.isArray(c.activities) ? c.activities.length : 4,
    awardCount: Array.isArray(c.awards) ? c.awards.length : 0,
    nationalAwardCount: 0,
    internationalAwardCount: 0,
    awardTierScores: [],
  };
}

// ================================================================

type Sample = {
  id: string;
  profileId: string;
  schoolId: string;
  schoolName?: string;
  probability: number;
  actual: 0 | 1;
  source: 'prediction_verified' | 'prediction_self_reported' | 'hindcast_case';
  modelVersion: string;
  tier: string | null;
  confidence: string | null;
  engineScores: any;
  round: string | null;
  selectivityBand: string | null;
  cohortKey: string | null;
};

async function main() {
  const args = parseArgs();

  section('0. 数据规模探测');

  const [predTotal, withAnyLabel, withVerified, caseTotal, caseVerified] =
    await Promise.all([
      prisma.predictionResult.count(),
      prisma.predictionResult.count({
        where: { outcomeLabelRecords: { some: {} } },
      }),
      prisma.predictionResult.count({
        where: {
          outcomeLabelRecords: {
            some: {
              status: { in: VERIFIED_OUTCOME_STATUSES },
              result: { in: ['ADMITTED', 'REJECTED'] },
            },
          },
        },
      }),
      prisma.admissionCase.count(),
      prisma.admissionCase.count({
        where: {
          isVerified: true,
          result: { in: ['ADMITTED', 'REJECTED'] },
        },
      }),
    ]);

  console.log(`PredictionResult 总数:                ${predTotal}`);
  console.log(`  └─ 带任何 outcome label:            ${withAnyLabel}`);
  console.log(`  └─ 带 VERIFIED outcome (可校准):    ${withVerified}`);
  console.log(`AdmissionCase 总数:                   ${caseTotal}`);
  console.log(`  └─ isVerified + ADMIT/REJECT:       ${caseVerified}`);

  console.log(`\n本次诊断 mode:`);
  console.log(`  - verified outcomes:        default (always on)`);
  console.log(
    `  - self-reported outcomes:   ${args.includeSelfReported ? 'ON' : 'off'}`,
  );
  console.log(`  - hindcast on AdmissionCase: ${args.hindcast ? 'ON' : 'off'}`);

  // ================================================================
  // 1. Outcome Label 分布
  // ================================================================
  section('1. Outcome Label 分布 (所有 PredictionResult)');

  const labelBreakdown = await prisma.predictionOutcomeLabelRecord.groupBy({
    by: ['status', 'result'],
    _count: { _all: true },
    orderBy: [{ status: 'asc' }, { result: 'asc' }],
  });

  if (labelBreakdown.length === 0) {
    console.log('  (无任何 outcome label 记录)');
  } else {
    console.log('  ' + 'status'.padEnd(22) + 'result'.padEnd(14) + 'count');
    console.log('  ' + '-'.repeat(48));
    for (const row of labelBreakdown) {
      console.log(
        '  ' +
          row.status.padEnd(22) +
          row.result.padEnd(14) +
          String(row._count._all).padStart(5),
      );
    }
  }

  // ================================================================
  // 2. 按 modelVersion 分布
  // ================================================================
  section('2. 按 modelVersion 分布 (所有 PredictionResult)');

  const byModel = await prisma.predictionResult.groupBy({
    by: ['modelVersion'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('  ' + 'modelVersion'.padEnd(28) + 'count'.padStart(8));
  console.log('  ' + '-'.repeat(38));
  for (const row of byModel) {
    console.log(
      '  ' + row.modelVersion.padEnd(28) + String(row._count._all).padStart(8),
    );
  }

  // ================================================================
  // 3. 拉取诊断样本
  // ================================================================
  section('3. 拉取诊断样本');

  const samples: Sample[] = [];

  // --- Source A: PredictionResult with outcomes ---
  const predWhere = args.includeSelfReported
    ? {
        outcomeLabelRecords: {
          some: { result: { in: ['ADMITTED', 'REJECTED'] } },
        },
      }
    : {
        outcomeLabelRecords: {
          some: {
            status: { in: VERIFIED_OUTCOME_STATUSES },
            result: { in: ['ADMITTED', 'REJECTED'] },
          },
        },
      };

  const rawPredictions = await prisma.predictionResult.findMany({
    where: predWhere,
    select: {
      id: true,
      profileId: true,
      schoolId: true,
      probability: true,
      modelVersion: true,
      tier: true,
      confidence: true,
      engineScores: true,
      applicationRound: true,
      selectivityBand: true,
      cohortKey: true,
      outcomeLabelRecords: {
        select: {
          result: true,
          status: true,
          isFinal: true,
          createdAt: true,
          resolvedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  });

  const predSchoolIds = [...new Set(rawPredictions.map((r) => r.schoolId))];
  const predSchools = await prisma.school.findMany({
    where: { id: { in: predSchoolIds } },
    select: { id: true, name: true },
  });
  const predSchoolMap = new Map(predSchools.map((s) => [s.id, s.name]));

  for (const r of rawPredictions) {
    // strict path (verified): use canonical resolver
    if (!args.includeSelfReported) {
      const canonical = resolveCanonicalPredictionOutcome(
        r.outcomeLabelRecords,
      );
      if (!canonical.eligibleForCalibration || !canonical.canonicalRecord)
        continue;
      samples.push({
        id: r.id,
        profileId: r.profileId,
        schoolId: r.schoolId,
        schoolName: predSchoolMap.get(r.schoolId),
        probability: Number(r.probability),
        actual: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
        source: 'prediction_verified',
        modelVersion: r.modelVersion,
        tier: r.tier,
        confidence: r.confidence,
        engineScores: r.engineScores,
        round: r.applicationRound,
        selectivityBand: r.selectivityBand,
        cohortKey: r.cohortKey,
      });
      continue;
    }

    // lenient path: take the highest-priority ADMITTED/REJECTED record regardless of status
    const candidate = [...r.outcomeLabelRecords]
      .filter((x) => x.result === 'ADMITTED' || x.result === 'REJECTED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!candidate) continue;
    samples.push({
      id: r.id,
      profileId: r.profileId,
      schoolId: r.schoolId,
      schoolName: predSchoolMap.get(r.schoolId),
      probability: Number(r.probability),
      actual: candidate.result === 'ADMITTED' ? 1 : 0,
      source: VERIFIED_OUTCOME_STATUSES.includes(candidate.status as any)
        ? 'prediction_verified'
        : 'prediction_self_reported',
      modelVersion: r.modelVersion,
      tier: r.tier,
      confidence: r.confidence,
      engineScores: r.engineScores,
      round: r.applicationRound,
      selectivityBand: r.selectivityBand,
      cohortKey: r.cohortKey,
    });
  }

  // --- Source B: Hindcast on verified AdmissionCase ---
  if (args.hindcast) {
    const cases = await prisma.admissionCase.findMany({
      where: {
        isVerified: true,
        result: { in: ['ADMITTED', 'REJECTED'] },
      },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        result: true,
        gpaRange: true,
        satRange: true,
        actRange: true,
        toeflRange: true,
        testScores: true,
        activities: true,
        awards: true,
        round: true,
        year: true,
        major: true,
        school: {
          select: {
            id: true,
            name: true,
            acceptanceRate: true,
            satAvg: true,
            sat25: true,
            sat75: true,
            actAvg: true,
            act25: true,
            act75: true,
            usNewsRank: true,
            graduationRate: true,
          },
        },
      },
    });

    console.log(`Hindcast: 载入 ${cases.length} 条 verified cases`);

    let skipped = 0;
    for (const c of cases) {
      if (!c.school) {
        skipped++;
        continue;
      }
      try {
        const profileMetrics = caseToProfileMetrics(c);
        const schoolMetrics = schoolToMetrics(c.school);
        // 必须有 gpa 或 sat/act 其中之一才能算
        if (
          !profileMetrics.gpa &&
          !profileMetrics.satScore &&
          !profileMetrics.actScore
        ) {
          skipped++;
          continue;
        }
        const overallScore = calculateOverallScore(
          profileMetrics,
          schoolMetrics,
        );
        const probability = calculateProbability(overallScore, schoolMetrics);
        const tier = calculateTier(probability, schoolMetrics);
        samples.push({
          id: `hindcast:${c.id}`,
          profileId: c.userId ?? 'anon',
          schoolId: c.schoolId,
          schoolName: c.school.name,
          probability,
          actual: c.result === 'ADMITTED' ? 1 : 0,
          source: 'hindcast_case',
          modelVersion: 'hindcast:stats_only',
          tier,
          confidence: null,
          engineScores: { stats: probability },
          round: c.round,
          selectivityBand: null,
          cohortKey: null,
        });
      } catch {
        skipped++;
      }
    }
    if (skipped > 0) {
      console.log(`Hindcast: ${skipped} 条因缺数据或异常跳过`);
    }
  }

  console.log(`\n总样本数: ${samples.length}`);
  const bySource = samples.reduce<Record<string, number>>((acc, s) => {
    acc[s.source] = (acc[s.source] ?? 0) + 1;
    return acc;
  }, {});
  for (const [k, v] of Object.entries(bySource)) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  if (samples.length === 0) {
    console.log(
      '\n无可评估样本。建议启用 --hindcast 或 --include-self-reported。',
    );
    await prisma.$disconnect();
    return;
  }

  // ================================================================
  // 指标计算工具
  // ================================================================
  function computeMetrics(preds: number[], lbls: number[]) {
    if (preds.length === 0) return null;
    const n = preds.length;
    const meanPred = preds.reduce((a, b) => a + b, 0) / n;
    const meanActual = lbls.reduce((a, b) => a + b, 0) / n;
    const brier = preds.reduce((acc, p, i) => acc + (p - lbls[i]) ** 2, 0) / n;
    const eps = 1e-7;
    const logLoss =
      preds.reduce((acc, p, i) => {
        const pp = Math.max(eps, Math.min(1 - eps, p));
        return (
          acc - (lbls[i] * Math.log(pp) + (1 - lbls[i]) * Math.log(1 - pp))
        );
      }, 0) / n;

    // ECE
    const bins = 10;
    let ece = 0;
    for (let b = 0; b < bins; b++) {
      const lo = b / bins;
      const hi = (b + 1) / bins;
      const idx = preds
        .map((p, i) =>
          p >= lo && (p < hi || (b === bins - 1 && p <= hi)) ? i : -1,
        )
        .filter((i) => i >= 0);
      if (idx.length === 0) continue;
      const binAcc = idx.reduce((a, i) => a + lbls[i], 0) / idx.length;
      const binConf = idx.reduce((a, i) => a + preds[i], 0) / idx.length;
      ece += (idx.length / n) * Math.abs(binAcc - binConf);
    }

    return {
      n,
      meanPred,
      meanActual,
      bias: meanPred - meanActual,
      brier,
      logLoss,
      ece,
    };
  }

  const predictions = samples.map((s) => s.probability);
  const labels = samples.map((s) => s.actual);
  const global = computeMetrics(predictions, labels)!;

  // ================================================================
  // 4. 全局诊断
  // ================================================================
  section('4. 全局诊断');

  console.log(`样本数 N          : ${global.n}`);
  console.log(
    `admit / reject    : ${labels.reduce((a, b) => a + b, 0)} / ${labels.length - labels.reduce((a, b) => a + b, 0)}`,
  );
  console.log(`预测均值          : ${fmt(global.meanPred)}`);
  console.log(`实际 admit 率     : ${fmt(global.meanActual)}`);

  const biasFlag =
    Math.abs(global.bias) < 0.03
      ? '(✅ 无系统性偏移)'
      : global.bias > 0
        ? '(⚠️ 系统性高估)'
        : '(⚠️ 系统性低估)';
  console.log(`全局偏移          : ${fmt(global.bias)} ${biasFlag}`);

  const brierFlag =
    global.brier <= 0.2 ? '(✅)' : global.brier <= 0.25 ? '(⚠️)' : '(❌)';
  console.log(`Brier Score       : ${fmt(global.brier)} ${brierFlag}`);

  const eceFlag =
    global.ece <= 0.05 ? '(✅)' : global.ece <= 0.1 ? '(⚠️)' : '(❌)';
  console.log(`ECE (10-bin)      : ${fmt(global.ece)} ${eceFlag}`);

  console.log(`Log Loss          : ${fmt(global.logLoss)}`);

  if (labels.every((l) => l === 1) || labels.every((l) => l === 0)) {
    console.log(
      `\n⚠️  样本全是 ${labels[0] === 1 ? 'admit' : 'reject'}，Brier/ECE 会极度失真；AUC 无法计算。`,
    );
  }

  // ================================================================
  // 5. Reliability Diagram
  // ================================================================
  section('5. Reliability Diagram (10-bin)');

  console.log(
    '  ' +
      'bin'.padEnd(13) +
      'n'.padStart(5) +
      '  predicted'.padStart(12) +
      '  actual'.padStart(10) +
      '  bias'.padStart(8) +
      '  visual',
  );
  console.log('  ' + '-'.repeat(74));

  for (let b = 0; b < 10; b++) {
    const lo = b / 10;
    const hi = (b + 1) / 10;
    const idx = predictions
      .map((p, i) => (p >= lo && (p < hi || (b === 9 && p <= hi)) ? i : -1))
      .filter((i) => i >= 0);
    if (idx.length === 0) {
      console.log(
        '  ' +
          `[${(lo * 100).toFixed(0).padStart(3)}-${(hi * 100).toFixed(0).padStart(3)}%]`.padEnd(
            13,
          ) +
          '0'.padStart(5) +
          '        —         —        —',
      );
      continue;
    }
    const pmean = idx.reduce((a, i) => a + predictions[i], 0) / idx.length;
    const amean = idx.reduce((a, i) => a + labels[i], 0) / idx.length;
    const bias = pmean - amean;
    const barLine =
      'P' + bar(pmean, 10).slice(0, 10) + ' A' + bar(amean, 10).slice(0, 10);
    console.log(
      '  ' +
        `[${(lo * 100).toFixed(0).padStart(3)}-${(hi * 100).toFixed(0).padStart(3)}%]`.padEnd(
          13,
        ) +
        String(idx.length).padStart(5) +
        '    ' +
        fmt(pmean).padStart(8) +
        '  ' +
        fmt(amean).padStart(8) +
        '  ' +
        (bias >= 0 ? '+' : '') +
        fmt(bias).padStart(6) +
        '  ' +
        barLine,
    );
  }

  // ================================================================
  // 6. 按 source 切分
  // ================================================================
  section('6. 按 source 切分');

  console.log(
    '  ' +
      'source'.padEnd(28) +
      'n'.padStart(5) +
      'meanPred'.padStart(10) +
      'meanAct'.padStart(10) +
      'bias'.padStart(8) +
      'ece'.padStart(8),
  );
  console.log('  ' + '-'.repeat(72));
  const sources = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = sources.get(s.source) ?? [];
    arr.push(s);
    sources.set(s.source, arr);
  }
  for (const [src, arr] of sources) {
    const m = computeMetrics(
      arr.map((s) => s.probability),
      arr.map((s) => s.actual),
    );
    if (!m) continue;
    console.log(
      '  ' +
        src.padEnd(28) +
        String(m.n).padStart(5) +
        fmt(m.meanPred).padStart(10) +
        fmt(m.meanActual).padStart(10) +
        fmt(m.bias).padStart(8) +
        fmt(m.ece).padStart(8),
    );
  }

  // ================================================================
  // 7. 按 modelVersion 切分
  // ================================================================
  section('7. 按 modelVersion 切分');

  const byModelVersion = new Map<string, Sample[]>();
  for (const s of samples) {
    const arr = byModelVersion.get(s.modelVersion) ?? [];
    arr.push(s);
    byModelVersion.set(s.modelVersion, arr);
  }

  console.log(
    '  ' +
      'modelVersion'.padEnd(28) +
      'n'.padStart(5) +
      'meanPred'.padStart(10) +
      'meanAct'.padStart(10) +
      'bias'.padStart(8) +
      'ece'.padStart(8),
  );
  console.log('  ' + '-'.repeat(72));
  for (const [v, arr] of byModelVersion) {
    const m = computeMetrics(
      arr.map((s) => s.probability),
      arr.map((s) => s.actual),
    );
    if (!m) continue;
    console.log(
      '  ' +
        v.padEnd(28) +
        String(m.n).padStart(5) +
        fmt(m.meanPred).padStart(10) +
        fmt(m.meanActual).padStart(10) +
        fmt(m.bias).padStart(8) +
        fmt(m.ece).padStart(8),
    );
  }

  // ================================================================
  // 8. 引擎归因
  // ================================================================
  section('8. 引擎归因 (engineScores 里各引擎单独 vs 实际)');

  const engineData = {
    stats: { p: [] as number[], l: [] as number[] },
    ai: { p: [] as number[], l: [] as number[] },
    historical: { p: [] as number[], l: [] as number[] },
    ml: { p: [] as number[], l: [] as number[] },
  };

  for (const s of samples) {
    const es = s.engineScores as any;
    if (!es || typeof es !== 'object') continue;
    for (const key of ['stats', 'ai', 'historical', 'ml'] as const) {
      const v = es[key];
      if (typeof v === 'number' && !Number.isNaN(v)) {
        engineData[key].p.push(v);
        engineData[key].l.push(s.actual);
      }
    }
  }

  console.log(
    '  ' +
      'engine'.padEnd(14) +
      'n'.padStart(5) +
      'meanPred'.padStart(10) +
      'meanAct'.padStart(10) +
      'bias'.padStart(8) +
      'ece'.padStart(8) +
      'brier'.padStart(8),
  );
  console.log('  ' + '-'.repeat(72));
  for (const key of ['stats', 'ai', 'historical', 'ml'] as const) {
    const { p, l } = engineData[key];
    if (p.length === 0) {
      console.log('  ' + key.padEnd(14) + '0'.padStart(5) + '   无数据');
      continue;
    }
    const m = computeMetrics(p, l);
    if (!m) continue;
    console.log(
      '  ' +
        key.padEnd(14) +
        String(m.n).padStart(5) +
        fmt(m.meanPred).padStart(10) +
        fmt(m.meanActual).padStart(10) +
        fmt(m.bias).padStart(8) +
        fmt(m.ece).padStart(8) +
        fmt(m.brier).padStart(8),
    );
  }

  // ================================================================
  // 9. 切片诊断
  // ================================================================
  section('9. 切片诊断 (n ≥ 15 才展示)');

  function sliceReport(
    sliceKey: string,
    getter: (s: Sample) => string | null | undefined,
  ) {
    const groups = new Map<string, Sample[]>();
    for (const s of samples) {
      const k = getter(s) ?? '<null>';
      const arr = groups.get(k) ?? [];
      arr.push(s);
      groups.set(k, arr);
    }
    const rows = Array.from(groups.entries())
      .filter(([, arr]) => arr.length >= 15)
      .map(([k, arr]) => {
        const m = computeMetrics(
          arr.map((s) => s.probability),
          arr.map((s) => s.actual),
        )!;
        return { k, ...m };
      })
      .sort((a, b) => b.ece - a.ece);
    if (rows.length === 0) {
      console.log(`  ${sliceKey}: 没有 n ≥ 15 的子群`);
      return;
    }
    console.log(`\n  ${sliceKey}:`);
    console.log(
      '    ' +
        'value'.padEnd(22) +
        'n'.padStart(5) +
        'meanPred'.padStart(10) +
        'meanAct'.padStart(10) +
        'bias'.padStart(8) +
        'ece'.padStart(8),
    );
    for (const r of rows) {
      console.log(
        '    ' +
          r.k.slice(0, 22).padEnd(22) +
          String(r.n).padStart(5) +
          fmt(r.meanPred).padStart(10) +
          fmt(r.meanActual).padStart(10) +
          fmt(r.bias).padStart(8) +
          fmt(r.ece).padStart(8),
      );
    }
  }

  sliceReport('by tier', (s) => s.tier);
  sliceReport('by confidence', (s) => s.confidence);
  sliceReport('by round', (s) => s.round);
  sliceReport('by selectivityBand', (s) => s.selectivityBand);

  // ================================================================
  // 10. Worst Cases
  // ================================================================
  section(`10. Top ${args.worstN} Worst Cases (按 |predicted - actual|)`);

  const worst = [...samples]
    .map((s) => ({ ...s, err: Math.abs(s.probability - s.actual) }))
    .sort((a, b) => b.err - a.err)
    .slice(0, args.worstN);

  console.log(
    '  ' +
      '#'.padStart(3) +
      '  ' +
      'school'.padEnd(26) +
      '  pred'.padStart(7) +
      '  actual'.padStart(8) +
      '  tier'.padStart(7) +
      '  round'.padStart(7) +
      '  source'.padStart(24),
  );
  console.log('  ' + '-'.repeat(90));

  worst.forEach((w, i) => {
    const schoolName = (w.schoolName ?? '(unknown)').slice(0, 25);
    console.log(
      '  ' +
        String(i + 1).padStart(3) +
        '  ' +
        schoolName.padEnd(26) +
        '  ' +
        fmt(w.probability, 2).padStart(5) +
        '  ' +
        (w.actual === 1 ? 'ADMIT' : 'REJECT').padStart(6) +
        '  ' +
        (w.tier ?? '—').padStart(5) +
        '  ' +
        (w.round ?? '—').padStart(5) +
        '  ' +
        w.source.padStart(22),
    );
  });

  // ================================================================
  // 11. 结论
  // ================================================================
  section('11. 初步诊断结论');

  const findings: string[] = [];

  if (global.n < 30) {
    findings.push(
      `[DATA] 样本数 N=${global.n} < 30，所有统计指标信心区间很宽；` +
        `worst cases 人工分析优先于数字结论`,
    );
  }
  const admitRate = labels.reduce((a, b) => a + b, 0) / labels.length;
  if (admitRate > 0.8 || admitRate < 0.2) {
    findings.push(
      `[DATA] 样本 admit 率 ${(admitRate * 100).toFixed(0)}% 严重不平衡 → ` +
        `全局 bias 和 ECE 数字不可信；上报机制存在选择偏差（只有 admit 才上报）`,
    );
  }
  if (global.n >= 30 && Math.abs(global.bias) > 0.05) {
    findings.push(
      `[HIGH] 全局 ${global.bias > 0 ? '高估' : '低估'} ${(Math.abs(global.bias) * 100).toFixed(1)}pp → ` +
        `在 fusion 输出前加一层 Beta/Isotonic 校准能直接吃掉大部分`,
    );
  }
  if (global.n >= 30 && global.ece > 0.1) {
    findings.push(
      `[HIGH] ECE = ${global.ece.toFixed(3)} 超过 0.1 → 分布形状也不对，需要分段校准`,
    );
  }

  for (const key of ['stats', 'ai', 'historical', 'ml'] as const) {
    const { p, l } = engineData[key];
    if (p.length < 30) continue;
    const m = computeMetrics(p, l);
    if (!m) continue;
    if (Math.abs(m.bias) > 0.08) {
      findings.push(
        `[HIGH] ${key} engine 单独偏移 ${(m.bias * 100).toFixed(1)}pp (n=${m.n}) → ` +
          (m.bias > 0
            ? '建议调低该引擎 fusion 权重，或独立校准'
            : '该引擎太保守，可调高权重或放松 clamp'),
      );
    }
  }

  if (findings.length === 0) {
    findings.push(
      '暂无 high-severity 结论。建议人工检查 worst cases 找 pattern。',
    );
  }

  findings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

  section('完成');
  console.log('建议下一步:');
  console.log(
    '  - 把 worst cases 和产品反馈的 case 对照，确认是否命中相同问题',
  );
  console.log('  - 如果样本不足，先做 outcome 催收 + AdmissionCase 回填再重跑');
  console.log('  - 修完一个 finding 后重跑此脚本，对比指标变化');
  console.log('  - pnpm --filter api diag:compare  # 对比前后两份报告');

  // ================================================================
  // 写报告文件
  // ================================================================
  if (args.writeReport) {
    const sha = gitSha();
    const dirty = gitDirty();
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '-')
      .slice(0, 18); // YYYYMMDD-HHMMSSmmm
    const fileName = `${ts}_${sha}${dirty ? '-dirty' : ''}.md`;
    if (!fs.existsSync(args.reportDir)) {
      fs.mkdirSync(args.reportDir, { recursive: true });
    }
    const filePath = path.join(args.reportDir, fileName);

    const engineBiasByKey: Record<
      string,
      { n: number; bias: number; ece: number } | null
    > = {};
    for (const key of ['stats', 'ai', 'historical', 'ml'] as const) {
      const { p, l } = engineData[key];
      if (p.length === 0) {
        engineBiasByKey[key] = null;
      } else {
        const m = computeMetrics(p, l)!;
        engineBiasByKey[key] = { n: m.n, bias: m.bias, ece: m.ece };
      }
    }

    const summary = {
      schema: 'diag-report/v1',
      timestamp: new Date().toISOString(),
      gitSha: sha,
      gitDirty: dirty,
      mode: {
        verified: true,
        selfReported: args.includeSelfReported,
        hindcast: args.hindcast,
      },
      sampleSize: {
        total: global.n,
        bySource,
      },
      admitRate,
      global: {
        meanPred: global.meanPred,
        meanActual: global.meanActual,
        bias: global.bias,
        brier: global.brier,
        ece: global.ece,
        logLoss: global.logLoss,
      },
      engines: engineBiasByKey,
      worstCases: worst.map((w) => ({
        id: w.id,
        school: w.schoolName,
        pred: w.probability,
        actual: w.actual,
        tier: w.tier,
        round: w.round,
        source: w.source,
      })),
      findings,
    };

    const md: string[] = [];
    md.push(`# Prediction Diagnostic Report`);
    md.push('');
    md.push(`- Timestamp: ${summary.timestamp}`);
    md.push(`- Git: \`${sha}\`${dirty ? ' **(dirty working tree)**' : ''}`);
    md.push(
      `- Mode: verified=on, self-reported=${args.includeSelfReported ? 'on' : 'off'}, hindcast=${args.hindcast ? 'on' : 'off'}`,
    );
    md.push(`- Samples: ${global.n}`);
    md.push('');
    md.push('## Summary (machine-readable)');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(summary, null, 2));
    md.push('```');
    md.push('');
    md.push('## Detailed output');
    md.push('');
    md.push('```');
    md.push(...reportBuffer);
    md.push('```');

    fs.writeFileSync(filePath, md.join('\n'), 'utf-8');
    origLog(`\n📄 报告已写入: ${path.relative(process.cwd(), filePath)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
