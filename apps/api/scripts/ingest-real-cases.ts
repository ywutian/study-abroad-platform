/**
 * Ingest Real Admission Cases (CLI wrapper)
 *
 * 读取一个 CSV 文件，把真实录取 case 写入 AdmissionCase (isVerified=true)，
 * 供后续 `diag:run` 作为 ground truth 做 hindcast 评估。
 *
 * 实际逻辑在 DiagnosticIngestService (src/modules/prediction/diagnostic-ingest.service.ts)，
 * 该 service 同时被 admin UI (POST /admin/predictions/diag/ingest-cases) 使用。
 *
 * 用法:
 *   pnpm --filter api diag:ingest data/real-cases-20260421.csv
 *   pnpm --filter api diag:ingest data/real-cases-20260421.csv --dry-run
 *
 * CSV 格式见 docs/PREDICTION_IMPROVEMENT_WORKFLOW.md 和 apps/api/data/real-cases-template.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { DiagnosticIngestService } from '../src/modules/prediction/diagnostic-ingest.service';

const prisma = new PrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const csvPath = argv.find((a) => !a.startsWith('--'));
  if (!csvPath) {
    console.error('Usage: diag:ingest <path-to-csv> [--dry-run]');
    process.exit(1);
  }
  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(absPath, 'utf-8');

  // CLI 里手工构造 service（避免启动整个 NestJS 容器）
  const service = new DiagnosticIngestService(prisma as any);

  console.log(`\n读取 CSV: ${absPath}`);
  console.log(`  mode: ${dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`);

  const s = await service.ingestRealCases({ csvContent, dryRun });

  console.log(`  表头 (${s.header.length} 列): ${s.header.join(', ')}`);
  console.log(`  数据行: ${s.totalRows}`);
  console.log(`  importBatchId: ${s.batchId}`);

  console.log(
    '\n═══════════════════════════════════════════════════════════════════',
  );
  console.log(' Ingest 结果');
  console.log(
    '═══════════════════════════════════════════════════════════════════',
  );
  console.log(
    `✅ 写入:            ${s.ingested}${dryRun ? ' (dry-run, 未实际写库)' : ''}`,
  );
  console.log(`⏭  跳过 (已存在):   ${s.skippedDuplicate}`);
  console.log(`❌ 跳过 (无学校):   ${s.skippedNoSchool}`);
  console.log(`❌ 跳过 (歧义多校): ${s.skippedAmbiguous}`);
  console.log(`❌ 跳过 (格式问题): ${s.skippedBadRow}`);

  if (Object.keys(s.matchTypeCounts).length > 0) {
    console.log(`\nSchool match 方式:`);
    for (const [k, v] of Object.entries(s.matchTypeCounts)) {
      console.log(`  ${k.padEnd(14)} ${v}`);
    }
  }
  if (Object.keys(s.perResult).length > 0) {
    console.log(`\n结果分布:`);
    for (const [k, v] of Object.entries(s.perResult)) {
      console.log(`  ${k.padEnd(14)} ${v}`);
    }
  }
  if (Object.keys(s.perSchool).length > 0) {
    const top = Object.entries(s.perSchool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log(`\nTop 学校 (最多前 10):`);
    for (const [k, v] of top)
      console.log(`  ${k.slice(0, 40).padEnd(42)} ${v}`);
  }
  if (s.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    for (const w of s.warnings) console.log(`  - ${w}`);
  }
  if (s.ambiguousSchools.length > 0) {
    console.log(
      `\n❌ 歧义校名 (${s.ambiguousSchools.length} 行，请用更完整校名或 schoolId):`,
    );
    for (const a of s.ambiguousSchools.slice(0, 15)) {
      console.log(`  line ${a.line}: ${a.inputName}`);
      for (const c of a.candidates.slice(0, 5)) {
        console.log(`    → ${c.name} (${c.id})`);
      }
    }
  }
  if (s.unmatchedSchools.length > 0) {
    console.log(
      `\n❌ 未匹配到的 school names (${s.unmatchedSchools.length} 行，请修 CSV 后重跑):`,
    );
    for (const u of s.unmatchedSchools.slice(0, 20)) {
      console.log(`  line ${u.line}  ${u.name}`);
      if (u.suggestedSchools.length > 0) {
        console.log(
          `    建议: ${u.suggestedSchools.map((x) => x.name).join(' | ')}`,
        );
      }
    }
  }
  if (s.rowErrors.length > 0) {
    console.log(`\n❌ 格式错误详情 (最多 10 条):`);
    for (const e of s.rowErrors.slice(0, 10)) {
      console.log(`  line ${String(e.line).padStart(4)}: ${e.error}`);
    }
  }

  console.log(`\n下一步:`);
  console.log(`  pnpm --filter api diag:run          # 跑诊断并写报告`);
  if (!dryRun && s.rollbackSql) {
    console.log(`  # 回滚本次 ingest:`);
    console.log(`  ${s.rollbackSql}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
