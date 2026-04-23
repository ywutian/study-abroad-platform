/**
 * Compare Diagnostic Reports
 *
 * 对比两份 diagnostic 报告的指标差（回归检测）。
 *
 * 用法:
 *   pnpm --filter api diag:compare                    # 最近两份
 *   pnpm --filter api diag:compare <prev.md> <curr.md>
 *   pnpm --filter api diag:compare --dir=path/to/reports
 *
 * 读取 markdown 报告顶部 ```json ... ``` 块（schema: diag-report/v1）。
 */

import * as fs from 'fs';
import * as path from 'path';

type Summary = {
  schema: string;
  timestamp: string;
  gitSha: string;
  gitDirty?: boolean;
  mode: { verified: boolean; selfReported: boolean; hindcast: boolean };
  sampleSize: { total: number; bySource: Record<string, number> };
  admitRate: number;
  global: {
    meanPred: number;
    meanActual: number;
    bias: number;
    brier: number;
    ece: number;
    logLoss: number;
  };
  engines: Record<string, { n: number; bias: number; ece: number } | null>;
  worstCases: Array<{
    id: string;
    school?: string;
    pred: number;
    actual: number;
    tier?: string | null;
    round?: string | null;
    source: string;
  }>;
  findings: string[];
};

function loadSummary(file: string): Summary {
  const content = fs.readFileSync(file, 'utf-8');
  const m = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) {
    throw new Error(`${file}: 没找到 summary JSON block`);
  }
  const parsed = JSON.parse(m[1]);
  if (!parsed.schema?.startsWith('diag-report/v1')) {
    throw new Error(`${file}: schema 不匹配 (${parsed.schema})`);
  }
  return parsed as Summary;
}

function listReports(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function fmt(n: number, digits = 4): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return '  —  ';
  const s = n >= 0 ? '+' : '';
  return (s + n.toFixed(digits)).padStart(digits + 5, ' ');
}

function deltaFlag(
  delta: number,
  threshold = 0.005,
  lowerIsBetter = true,
): string {
  if (Math.abs(delta) < threshold) return '~';
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? '✅' : '❌';
}

function compare(prev: Summary, curr: Summary) {
  console.log('');
  console.log('═'.repeat(76));
  console.log(' Diagnostic Report Comparison');
  console.log('═'.repeat(76));
  console.log(
    `Previous: ${prev.timestamp}  git=${prev.gitSha}${prev.gitDirty ? '-dirty' : ''}  N=${prev.sampleSize.total}`,
  );
  console.log(
    `Current:  ${curr.timestamp}  git=${curr.gitSha}${curr.gitDirty ? '-dirty' : ''}  N=${curr.sampleSize.total}`,
  );

  if (prev.sampleSize.total !== curr.sampleSize.total) {
    console.log(
      `\n⚠️  样本量变化 ${prev.sampleSize.total} → ${curr.sampleSize.total}，` +
        `指标 delta 不完全归因于代码改动（可能是数据增加/减少）`,
    );
  }
  if (prev.gitSha === curr.gitSha && !prev.gitDirty && !curr.gitDirty) {
    console.log(
      `\n⚠️  两份报告 git SHA 相同且都不 dirty —— 代码没变，diff 主要来自数据/随机`,
    );
  }

  // Global metrics
  console.log(
    '\n-- Global metrics ----------------------------------------------------',
  );
  console.log(
    '  metric'.padEnd(22) +
      'prev'.padStart(12) +
      'curr'.padStart(12) +
      'delta'.padStart(12) +
      '  note',
  );
  console.log('  ' + '-'.repeat(72));

  const rows: Array<{
    label: string;
    prev: number;
    curr: number;
    lower: boolean;
    threshold: number;
  }> = [
    {
      label: 'ECE (10-bin)',
      prev: prev.global.ece,
      curr: curr.global.ece,
      lower: true,
      threshold: 0.005,
    },
    {
      label: 'Brier',
      prev: prev.global.brier,
      curr: curr.global.brier,
      lower: true,
      threshold: 0.005,
    },
    {
      label: 'LogLoss',
      prev: prev.global.logLoss,
      curr: curr.global.logLoss,
      lower: true,
      threshold: 0.01,
    },
    {
      label: '|global bias|',
      prev: Math.abs(prev.global.bias),
      curr: Math.abs(curr.global.bias),
      lower: true,
      threshold: 0.01,
    },
    {
      label: 'meanPred',
      prev: prev.global.meanPred,
      curr: curr.global.meanPred,
      lower: true,
      threshold: 0.01,
    },
    {
      label: 'meanActual',
      prev: prev.global.meanActual,
      curr: curr.global.meanActual,
      lower: false,
      threshold: 0.005,
    },
  ];

  for (const r of rows) {
    const delta = r.curr - r.prev;
    const flag = deltaFlag(delta, r.threshold, r.lower);
    const pctNote =
      Math.abs(r.prev) > 1e-6
        ? ` (${((delta / r.prev) * 100).toFixed(0)}%)`
        : '';
    console.log(
      '  ' +
        r.label.padEnd(20) +
        fmt(r.prev).padStart(12) +
        fmt(r.curr).padStart(12) +
        fmt(delta).padStart(12) +
        '  ' +
        flag +
        pctNote,
    );
  }

  // Engines
  console.log(
    '\n-- Engine bias -------------------------------------------------------',
  );
  console.log(
    '  engine'.padEnd(14) +
      'prev.bias'.padStart(12) +
      'curr.bias'.padStart(12) +
      'delta'.padStart(12) +
      '  note',
  );
  console.log('  ' + '-'.repeat(64));
  for (const key of ['stats', 'ai', 'historical', 'ml']) {
    const p = prev.engines[key];
    const c = curr.engines[key];
    if (!p && !c) continue;
    if (!p) {
      console.log(
        '  ' +
          key.padEnd(12) +
          ' '.padStart(12) +
          fmt(c!.bias).padStart(12) +
          '   new',
      );
      continue;
    }
    if (!c) {
      console.log(
        '  ' +
          key.padEnd(12) +
          fmt(p.bias).padStart(12) +
          ' '.padStart(12) +
          '   removed',
      );
      continue;
    }
    const dAbs = Math.abs(c.bias) - Math.abs(p.bias);
    const flag = deltaFlag(dAbs, 0.01, true);
    console.log(
      '  ' +
        key.padEnd(12) +
        fmt(p.bias).padStart(12) +
        fmt(c.bias).padStart(12) +
        fmt(c.bias - p.bias).padStart(12) +
        '  ' +
        flag +
        ` (|bias| ${p.bias.toFixed(3)}→${c.bias.toFixed(3)})`,
    );
  }

  // Worst cases overlap
  console.log(
    '\n-- Worst cases overlap -----------------------------------------------',
  );
  const prevIds = new Set(prev.worstCases.map((w) => w.id));
  const currIds = new Set(curr.worstCases.map((w) => w.id));
  const overlap = [...currIds].filter((id) => prevIds.has(id)).length;
  const newlyWorst = [...currIds].filter((id) => !prevIds.has(id));
  const fixed = [...prevIds].filter((id) => !currIds.has(id));
  console.log(`  overlap:        ${overlap}/${curr.worstCases.length}`);
  console.log(`  newly worst:    ${newlyWorst.length}`);
  console.log(`  no longer worst:${fixed.length}`);

  if (newlyWorst.length > 0) {
    console.log('\n  Newly worst (top 5):');
    const newOnes = curr.worstCases
      .filter((w) => newlyWorst.includes(w.id))
      .slice(0, 5);
    for (const w of newOnes) {
      console.log(
        `    ${(w.school ?? '(unknown)').slice(0, 30).padEnd(32)} pred=${w.pred.toFixed(2)} actual=${w.actual === 1 ? 'ADMIT' : 'REJECT'}`,
      );
    }
  }
  if (fixed.length > 0) {
    console.log('\n  No longer worst (top 5):');
    const fx = prev.worstCases.filter((w) => fixed.includes(w.id)).slice(0, 5);
    for (const w of fx) {
      console.log(
        `    ${(w.school ?? '(unknown)').slice(0, 30).padEnd(32)} pred=${w.pred.toFixed(2)} actual=${w.actual === 1 ? 'ADMIT' : 'REJECT'}`,
      );
    }
  }

  // Findings delta
  console.log(
    '\n-- Findings ----------------------------------------------------------',
  );
  const prevSet = new Set(prev.findings);
  const currSet = new Set(curr.findings);
  const resolved = prev.findings.filter((f) => !currSet.has(f));
  const newFindings = curr.findings.filter((f) => !prevSet.has(f));

  if (resolved.length > 0) {
    console.log(`\n  ✅ Resolved (${resolved.length}):`);
    for (const f of resolved) console.log('    - ' + f);
  }
  if (newFindings.length > 0) {
    console.log(`\n  ❌ New findings (${newFindings.length}):`);
    for (const f of newFindings) console.log('    - ' + f);
  }
  if (resolved.length === 0 && newFindings.length === 0) {
    console.log(`  (findings 无变化)`);
  }

  // Overall verdict
  console.log(
    '\n-- Overall -----------------------------------------------------------',
  );
  const mainDelta =
    curr.global.ece -
    prev.global.ece +
    (curr.global.brier - prev.global.brier) +
    Math.abs(curr.global.bias) -
    Math.abs(prev.global.bias);
  if (mainDelta < -0.01) {
    console.log(`  ✅ 整体改善 (综合 delta ${mainDelta.toFixed(4)})`);
  } else if (mainDelta > 0.01) {
    console.log(
      `  ❌ 整体变差 (综合 delta ${mainDelta.toFixed(4)}) —— 建议回滚或再检查`,
    );
  } else {
    console.log(`  ~ 无显著变化 (综合 delta ${mainDelta.toFixed(4)})`);
  }
  console.log('');
}

function main() {
  const argv = process.argv.slice(2);
  const dirArg = argv.find((a) => a.startsWith('--dir='))?.split('=')[1];
  const positional = argv.filter((a) => !a.startsWith('--'));

  const dir = dirArg
    ? path.resolve(dirArg)
    : path.join(__dirname, '..', 'diagnostic-reports');

  let prevPath: string;
  let currPath: string;
  if (positional.length >= 2) {
    prevPath = path.resolve(positional[0]);
    currPath = path.resolve(positional[1]);
  } else {
    const all = listReports(dir);
    if (all.length < 2) {
      console.error(
        `需要至少 2 份报告用于对比。当前 ${dir} 下只有 ${all.length} 份。`,
      );
      console.error(`先跑几次 \`pnpm --filter api diag:run\` 再来对比。`);
      process.exit(1);
    }
    prevPath = all[all.length - 2];
    currPath = all[all.length - 1];
  }

  const prev = loadSummary(prevPath);
  const curr = loadSummary(currPath);
  compare(prev, curr);
  console.log(`  prev file: ${path.relative(process.cwd(), prevPath)}`);
  console.log(`  curr file: ${path.relative(process.cwd(), currPath)}`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
