#!/usr/bin/env tsx
/**
 * AI Agent 离线评测脚本
 *
 * Usage:
 *   npx tsx scripts/eval/run-eval.ts --mode=fixtures          # MVP1: 纯规则检查
 *   npx tsx scripts/eval/run-eval.ts --mode=live --sample=5   # MVP3: 真模型小样本
 *
 * 结果输出到 scripts/eval/results/
 */

import * as fs from 'fs';
import * as path from 'path';
import { EvalCase, EvalResult, EvalSummary, EvalCategory, Severity, BadCaseType } from './types';

// ==================== CLI 参数解析 ====================

const args = process.argv.slice(2);
const mode =
  (args.find((a) => a.startsWith('--mode='))?.split('=')[1] as 'fixtures' | 'live') || 'fixtures';
const sampleSize = parseInt(args.find((a) => a.startsWith('--sample='))?.split('=')[1] || '0', 10);
const verbose = args.includes('--verbose');

// ==================== 数据集加载 ====================

const datasetPath = path.join(__dirname, 'dataset.json');
const dataset: EvalCase[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

console.log(`\n📊 AI Agent Eval — mode: ${mode}, cases: ${dataset.length}\n`);

// ==================== MVP1: Fixtures 模式 ====================

function runFixturesEval(cases: EvalCase[]): EvalResult[] {
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result: EvalResult = {
      caseId: evalCase.id,
      mode: 'fixtures',
      verdict: 'pass',
      timestamp: new Date().toISOString(),
    };

    // Skip subjective cases in fixtures mode
    if (evalCase.subjective) {
      result.verdict = 'skip';
      result.details = 'Subjective case — skipped in fixtures mode';
      results.push(result);
      continue;
    }

    // Check 1: If mockToolCalls provided, verify expected tools are covered
    if (evalCase.mockToolCalls && evalCase.expectedToolCalls) {
      const actualTools = evalCase.mockToolCalls.map((tc) => tc.name);
      const missingTools = evalCase.expectedToolCalls.filter((t) => !actualTools.includes(t));
      if (missingTools.length > 0) {
        result.verdict = 'fail';
        result.badCaseType = 'MISSING_TOOL';
        result.details = `Expected tools missing from mock: ${missingTools.join(', ')}`;
        result.actualToolCalls = actualTools;
        results.push(result);
        continue;
      }

      // Check forbidden tools
      if (evalCase.forbiddenToolCalls) {
        const forbidden = evalCase.forbiddenToolCalls.filter((t) => actualTools.includes(t));
        if (forbidden.length > 0) {
          result.verdict = 'fail';
          result.badCaseType = 'REDUNDANT_TOOL';
          result.details = `Forbidden tools called: ${forbidden.join(', ')}`;
          result.actualToolCalls = actualTools;
          results.push(result);
          continue;
        }
      }
    }

    // Check 2: If mockToolResults provided, verify JSON fields
    if (evalCase.mockToolResults && evalCase.expectedJsonFields) {
      const allResults = Object.values(evalCase.mockToolResults).join(' ');
      const missingFields = evalCase.expectedJsonFields.filter(
        (field) => !allResults.includes(`"${field}"`)
      );
      if (missingFields.length > 0) {
        result.verdict = 'fail';
        result.badCaseType = 'MISSING_FIELD';
        result.details = `Expected JSON fields missing: ${missingFields.join(', ')}`;
        results.push(result);
        continue;
      }
    }

    // Check 3: Verify mockToolResults are valid JSON
    if (evalCase.mockToolResults) {
      for (const [toolName, resultStr] of Object.entries(evalCase.mockToolResults)) {
        try {
          JSON.parse(resultStr);
        } catch {
          result.verdict = 'fail';
          result.badCaseType = 'JSON_PARSE_FAIL';
          result.details = `Tool ${toolName} result is not valid JSON`;
          results.push(result);
          continue;
        }
      }
    }

    results.push(result);
  }

  return results;
}

// ==================== MVP3: Live 模式（占位） ====================

async function runLiveEval(cases: EvalCase[], _sample: number): Promise<EvalResult[]> {
  const sampled = _sample > 0 ? cases.slice(0, _sample) : cases;
  const results: EvalResult[] = [];

  for (const evalCase of sampled) {
    // TODO: 接入真实 LLM 调用
    results.push({
      caseId: evalCase.id,
      mode: 'live',
      verdict: 'skip',
      details: 'Live mode not yet implemented — requires LLM API connection',
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}

// ==================== 结果汇总 ====================

function summarize(results: EvalResult[]): EvalSummary {
  const passed = results.filter((r) => r.verdict === 'pass').length;
  const failed = results.filter((r) => r.verdict === 'fail').length;
  const skipped = results.filter((r) => r.verdict === 'skip').length;

  const byCategory = {} as Record<EvalCategory, { total: number; passed: number }>;
  const bySeverity = {} as Record<Severity, { total: number; passed: number }>;
  const badCaseBreakdown: Partial<Record<BadCaseType, number>> = {};

  for (const result of results) {
    const evalCase = dataset.find((c) => c.id === result.caseId);
    if (!evalCase) continue;

    // By category
    if (!byCategory[evalCase.category]) {
      byCategory[evalCase.category] = { total: 0, passed: 0 };
    }
    byCategory[evalCase.category].total++;
    if (result.verdict === 'pass') byCategory[evalCase.category].passed++;

    // By severity
    if (!bySeverity[evalCase.severity]) {
      bySeverity[evalCase.severity] = { total: 0, passed: 0 };
    }
    bySeverity[evalCase.severity].total++;
    if (result.verdict === 'pass') bySeverity[evalCase.severity].passed++;

    // Bad case breakdown
    if (result.badCaseType) {
      badCaseBreakdown[result.badCaseType] = (badCaseBreakdown[result.badCaseType] || 0) + 1;
    }
  }

  return {
    mode: results[0]?.mode || 'fixtures',
    totalCases: results.length,
    passed,
    failed,
    skipped,
    passRate: results.length > 0 ? passed / (passed + failed) : 0,
    byCategory,
    bySeverity,
    badCaseBreakdown,
    timestamp: new Date().toISOString(),
  };
}

// ==================== 输出 ====================

function printSummary(summary: EvalSummary): void {
  console.log('='.repeat(60));
  console.log(`Mode: ${summary.mode}`);
  console.log(
    `Results: ${summary.passed} passed / ${summary.failed} failed / ${summary.skipped} skipped`
  );
  console.log(`Pass rate: ${(summary.passRate * 100).toFixed(1)}% (excluding skipped)`);
  console.log('');

  console.log('By Category:');
  for (const [cat, stats] of Object.entries(summary.byCategory)) {
    console.log(`  ${cat}: ${stats.passed}/${stats.total}`);
  }

  console.log('');
  console.log('By Severity:');
  for (const [sev, stats] of Object.entries(summary.bySeverity)) {
    console.log(`  ${sev}: ${stats.passed}/${stats.total}`);
  }

  if (Object.keys(summary.badCaseBreakdown).length > 0) {
    console.log('');
    console.log('Bad Cases:');
    for (const [type, count] of Object.entries(summary.badCaseBreakdown)) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log('='.repeat(60));
}

function saveResults(results: EvalResult[], summary: EvalSummary): void {
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `eval-${mode}-${timestamp}.json`;

  fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify({ summary, results }, null, 2));
  console.log(`\nResults saved to: scripts/eval/results/${filename}`);
}

// ==================== Main ====================

async function main(): Promise<void> {
  let results: EvalResult[];

  if (mode === 'fixtures') {
    results = runFixturesEval(dataset);
  } else {
    results = await runLiveEval(dataset, sampleSize);
  }

  if (verbose) {
    for (const r of results) {
      const icon = r.verdict === 'pass' ? '✓' : r.verdict === 'fail' ? '✗' : '○';
      console.log(`  ${icon} ${r.caseId}: ${r.verdict}${r.details ? ` — ${r.details}` : ''}`);
    }
    console.log('');
  }

  const summary = summarize(results);
  printSummary(summary);
  saveResults(results, summary);

  // Exit with failure if any critical cases failed
  const criticalFails = results.filter((r) => {
    const c = dataset.find((d) => d.id === r.caseId);
    return r.verdict === 'fail' && c?.severity === 'critical';
  });

  if (criticalFails.length > 0) {
    console.log(`\n❌ ${criticalFails.length} critical case(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
