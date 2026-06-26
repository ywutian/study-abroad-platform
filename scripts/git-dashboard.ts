/**
 * Self-contained git-history dashboard. Runs git, inlines the data into one
 * static HTML file (Chart.js from CDN), opens in a browser. Re-run to sync.
 *
 * Usage: pnpm git:dashboard            # last 90 days
 *        pnpm git:dashboard -- --days=180
 *
 * ponytail: one script + one HTML file, no app route / no build / no new dep.
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as path from 'path';

const sh = (cmd: string) => execSync(cmd, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const DAYS = process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? '90';
const NOISE = /pnpm-lock\.yaml|messages\/.*\.json|locales\/.*\.json|\.snap$|dist\//;

// ── parse every commit into structured fields ────────────────────────────────
interface C {
  date: string;
  type: string;
  scope: string;
  subj: string;
  pr: string;
}
const commits: C[] = [];
for (const line of sh(`git log --since="${DAYS} days ago" --date=short --pretty='%ad|%s'`)
  .trim()
  .split('\n')
  .filter(Boolean)) {
  const [date, ...rest] = line.split('|');
  const full = rest.join('|');
  const m = full.match(/^([a-z]+)(?:\(([a-z0-9-]+)\))?!?:\s*(.*)$/);
  const pr = full.match(/\(#(\d+)\)\s*$/)?.[1] ?? '';
  commits.push({
    date,
    type: m ? m[1] : 'other',
    scope: m && m[2] ? m[2] : '(misc)',
    subj: (m ? m[3] : full).replace(/\s*\(#\d+\)\s*$/, ''),
    pr,
  });
}

const tally = (key: (c: C) => string) => {
  const o: Record<string, number> = {};
  for (const c of commits) o[key(c)] = (o[key(c)] || 0) + 1;
  return o;
};
const top = (o: Record<string, number>, n: number) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

const perDay = tally((c) => c.date);
const byType = tally((c) => c.type);
const byScope = tally((c) => c.scope);

// ── churn per file + lines +/- per week ──────────────────────────────────────
const weekStart = (day: string) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const fileChurn: Record<string, number> = {};
const weekAdd: Record<string, number> = {};
const weekDel: Record<string, number> = {};
let week = '';
for (const line of sh(
  `git log --since="${DAYS} days ago" --numstat --date=short --pretty=format:C%ad`
).split('\n')) {
  if (line.startsWith('C')) {
    week = weekStart(line.slice(1));
    continue;
  }
  const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
  if (!m || m[1] === '-' || NOISE.test(m[3])) continue;
  fileChurn[m[3]] = (fileChurn[m[3]] || 0) + +m[1] + +m[2];
  weekAdd[week] = (weekAdd[week] || 0) + +m[1];
  weekDel[week] = (weekDel[week] || 0) + +m[2];
}

const days = Object.keys(perDay).sort();
const weeks = Object.keys(weekAdd).sort();
// feed: scopes sorted by count, each with its commits newest-first
const feed = top(byScope, 99).map(([scope, n]) => ({
  scope,
  n,
  items: commits.filter((c) => c.scope === scope).sort((a, b) => b.date.localeCompare(a.date)),
}));

const D = {
  total: commits.length,
  days,
  dayCounts: days.map((d) => perDay[d]),
  types: Object.entries(byType).sort((a, b) => b[1] - a[1]),
  scopes: top(byScope, 14),
  files: top(fileChurn, 15).map(([f, c]) => [f.replace(/^(apps|packages)\//, ''), c]),
  weeks,
  weekAdd: weeks.map((w) => weekAdd[w]),
  weekDel: weeks.map((w) => -weekDel[w]),
  feed,
};
if (D.total === 0) throw new Error('no commits found — is this a git repo with recent history?');

const TYPE_COLOR: Record<string, string> = {
  feat: '#3fb950',
  fix: '#f85149',
  refactor: '#bc8cff',
  perf: '#d29922',
  chore: '#6e7681',
  docs: '#58a6ff',
  test: '#39c5cf',
  ci: '#db61a2',
  style: '#8b949e',
  other: '#484f58',
};

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const feedHtml = D.feed
  .map(
    (g) =>
      `<details${g.n >= 8 ? ' open' : ''}><summary>${esc(g.scope)} <b>${g.n}</b></summary>${g.items
        .map(
          (c) =>
            `<div class=row data-t="${esc(c.subj.toLowerCase())} ${c.type} ${esc(g.scope)}"><span class=dt>${c.date.slice(5)}</span><span class=tag style="background:${TYPE_COLOR[c.type] || '#484f58'}22;color:${TYPE_COLOR[c.type] || '#8b949e'}">${c.type}</span><span class=msg>${esc(c.subj)}</span>${c.pr ? `<span class=pr>#${c.pr}</span>` : ''}</div>`
        )
        .join('')}</details>`
  )
  .join('');

const html = `<!doctype html><meta charset=utf8><title>git dashboard</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#e6edf3;font:14px/1.5 system-ui,sans-serif}
header{padding:18px 24px;border-bottom:1px solid #21262d}h1{margin:0;font-size:18px;font-weight:500}.sub{color:#8b949e;font-size:13px;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;padding:20px 24px}
.card{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:16px}
.card h2{margin:0 0 12px;font-size:12px;font-weight:500;color:#8b949e;text-transform:uppercase;letter-spacing:.05em}
.wrap{position:relative;height:260px}.tall .wrap{height:380px}
.feed{padding:0 24px 40px}.feed h2{font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.05em}
#q{width:100%;padding:9px 12px;margin:0 0 14px;background:#161b22;border:1px solid #30363d;border-radius:8px;color:#e6edf3;font-size:14px}
details{background:#161b22;border:1px solid #21262d;border-radius:8px;margin-bottom:8px}
summary{padding:10px 14px;cursor:pointer;font-weight:500;user-select:none}summary b{color:#58a6ff;font-weight:500}
.row{display:flex;gap:10px;align-items:baseline;padding:5px 14px 5px 28px;border-top:1px solid #1c2129;font-size:13px}
.dt{color:#6e7681;font-variant-numeric:tabular-nums;flex:none;width:38px}
.tag{flex:none;padding:1px 7px;border-radius:5px;font-size:11px;font-weight:500}
.msg{flex:1;min-width:0}.pr{color:#6e7681;flex:none}
.hide{display:none}
</style>
<header><h1>Code-change history · last ${DAYS} days</h1><div class=sub>${D.total} commits · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · re-run <code>pnpm git:dashboard</code> to sync</div></header>
<div class=grid>
<div class=card><h2>Commits per day</h2><div class=wrap><canvas id=day></canvas></div></div>
<div class=card><h2>By type</h2><div class=wrap><canvas id=type></canvas></div></div>
<div class=card><h2>Top modules</h2><div class=wrap><canvas id=scope></canvas></div></div>
<div class=card tall><h2>Most-churned files</h2><div class=wrap><canvas id=file></canvas></div></div>
<div class="card tall" style=grid-column:1/-1><h2>Lines added / removed per week</h2><div class=wrap><canvas id=week></canvas></div></div>
</div>
<div class=feed><h2>What you did — every commit, grouped by module</h2>
<input id=q placeholder="filter… (try: fix, prediction, overflow, #408)">
${feedHtml}</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
const D=${JSON.stringify({
  days: D.days,
  dayCounts: D.dayCounts,
  types: D.types,
  scopes: D.scopes,
  files: D.files,
  weeks: D.weeks,
  weekAdd: D.weekAdd,
  weekDel: D.weekDel,
})};
const TC=${JSON.stringify(TYPE_COLOR)};
Chart.defaults.color='#8b949e';Chart.defaults.borderColor='#21262d';
const G='#3fb950',R='#f85149',B='#58a6ff',P='#bc8cff',A='#d29922';
new Chart(day,{type:'bar',data:{labels:D.days,datasets:[{data:D.dayCounts,backgroundColor:B}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:12}}},maintainAspectRatio:false}});
new Chart(type,{type:'doughnut',data:{labels:D.types.map(t=>t[0]+' · '+t[1]),datasets:[{data:D.types.map(t=>t[1]),backgroundColor:D.types.map(t=>TC[t[0]]||'#484f58')}]},options:{plugins:{legend:{position:'right'}},maintainAspectRatio:false}});
new Chart(scope,{type:'bar',data:{labels:D.scopes.map(s=>s[0]+' · '+s[1]),datasets:[{data:D.scopes.map(s=>s[1]),backgroundColor:P}]},options:{indexAxis:'y',plugins:{legend:{display:false}},maintainAspectRatio:false}});
new Chart(file,{type:'bar',data:{labels:D.files.map(f=>f[0].length>42?'…'+f[0].slice(-42):f[0]),datasets:[{data:D.files.map(f=>f[1]),backgroundColor:A}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>D.files[i[0].dataIndex][0]}}},maintainAspectRatio:false}});
new Chart(week,{type:'bar',data:{labels:D.weeks,datasets:[{label:'added',data:D.weekAdd,backgroundColor:G},{label:'removed',data:D.weekDel,backgroundColor:R}]},options:{scales:{x:{stacked:true},y:{stacked:true}},maintainAspectRatio:false}});
const q=document.getElementById('q');
q.oninput=()=>{const v=q.value.toLowerCase().trim();document.querySelectorAll('details').forEach(d=>{let any=false;d.querySelectorAll('.row').forEach(r=>{const ok=!v||r.dataset.t.includes(v)||(r.querySelector('.pr')?.textContent||'').includes(v);r.classList.toggle('hide',!ok);any=any||ok;});d.classList.toggle('hide',!any);if(v)d.open=true;});};
</script>`;

const out = path.resolve(process.cwd(), 'git-dashboard.html');
writeFileSync(out, html);
console.log(`✅ ${D.total} commits → ${out}`);
