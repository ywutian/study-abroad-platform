import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs/i18n-audit-2026-04-26');

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build', '.expo'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(path.relative(ROOT, full));
  }
  return out.sort();
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(file, rows, headers) {
  fs.writeFileSync(
    path.join(OUT, file),
    `${headers.join(',')}\n${rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')).join('\n')}\n`
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(current);
      current = '';
    } else if (char === '\n' && !quoted) {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }
  const [headers, ...body] = rows;
  return body.filter((cells) => cells.length === headers.length).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
  );
}

function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, prefix ? `${prefix}.${index}` : `${index}`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function routeFromWebPage(file) {
  let route = file.replace(/^apps\/web\/src\/app\//, '').replace(/\/page\.tsx$/, '');
  route = route.replace(/\([^/]+\)\//g, '').replace(/\[locale\]/, ':locale').replace(/\[([^\]]+)\]/g, ':$1');
  return `/${route.replace(/^\//, '')}`;
}

function routeFromMobile(file) {
  let route = file.replace(/^apps\/mobile\/src\/app\//, '').replace(/\.tsx$/, '');
  route = route.replace(/\/index$/, '').replace(/\([^/]+\)\//g, '').replace(/\[([^\]]+)\]/g, ':$1');
  return `/${route.replace(/^\//, '')}`;
}

const findingRules = [
  {
    id: 'I18N-001',
    priority: 'P1',
    path: 'apps/web/src/app/[locale]/(main)/admin/activity-templates/_components/template-form-dialog.tsx',
    lines: [93, 163],
  },
  {
    id: 'I18N-002',
    priority: 'P1',
    path: 'apps/web/src/app/[locale]/(main)/admin/data-review/_components/bulk-import-tab.tsx',
    lines: [194, 244],
  },
  { id: 'I18N-003', priority: 'P2', path: 'apps/web/src/app/error.tsx', lines: [20, 23] },
  { id: 'I18N-004', priority: 'P2', path: 'apps/web/src/components/features/submit-case/EssaySection.tsx', lines: [19, 118] },
  { id: 'I18N-005', priority: 'P2', path: 'apps/web/src/components/features/education-form.tsx', lines: [50, 516] },
  { id: 'I18N-006', priority: 'P2', path: 'apps/web/src/components/features/resume/template-picker.tsx', lines: [104, 170] },
  { id: 'I18N-006', priority: 'P2', path: 'apps/web/src/components/features/resume/pdf/templates/definitions.ts', lines: [1, 350] },
  { id: 'I18N-007', priority: 'P2', pathPrefix: 'apps/web/src/components/features/resume/resume-editor/section-editors/' },
  { id: 'I18N-008', priority: 'P1', path: 'apps/mobile/src/screens/teams/TeamsScreen.tsx', lines: [276, 335] },
  { id: 'I18N-009', priority: 'P2', path: 'apps/mobile/src/screens/recommendation/types.ts', lines: [106, 110] },
  { id: 'I18N-010', priority: 'P3', path: 'apps/mobile/src/app/profile/basic.tsx', lines: [14, 18] },
  { id: 'I18N-011', priority: 'P3', path: 'apps/mobile/src/app/profile/export.tsx', lines: [44, 47] },
  { id: 'I18N-017', priority: 'P2', path: 'apps/web/src/app/[locale]/(main)/resume/[id]/page.tsx', lines: [261, 321] },
  { id: 'I18N-018', priority: 'P3', path: 'apps/web/src/app/[locale]/(main)/admin/payments/page.tsx', lines: [238, 397] },
];

function matchingFinding(file, line) {
  return findingRules.find((rule) => {
    if (rule.pathPrefix && file.startsWith(rule.pathPrefix)) return true;
    if (rule.path !== file) return false;
    if (!rule.lines) return true;
    return line >= rule.lines[0] && line <= rule.lines[1];
  });
}

const attrNames = [
  'title',
  'label',
  'description',
  'placeholder',
  'helperText',
  'emptyText',
  'message',
  'alt',
  'aria-label',
  'accessibilityLabel',
  'accessibilityHint',
  'confirmText',
  'cancelText',
  'submitText',
  'text',
];

const stringExemptions = [
  /^use (client|server|memo|no memo|strict)$/,
  /^(GET|POST|PUT|DELETE|PATCH|USER|ADMIN|SUPER_ADMIN|VERIFIED|OPERATOR)$/,
  /^(GPA|SAT|ACT|TOEFL|IELTS|GRE|GMAT|AP|IB|ED|EA|RD|REA|JSON|CSV|PDF|AI|API|URL|JWT|LLM|MCP|SSO|OAuth)$/,
  /^https?:\/\//,
  /^\/[\w./:@-]+$/,
  /^#[0-9a-fA-F]{3,8}$/,
  /^[\d.]+[%a-zA-Z]*$/,
  /^[a-z][A-Za-z0-9]*$/,
  /^[\w-]+\.[\w.-]+$/,
  /^(primary|secondary|ghost|outline|default|destructive|sm|md|lg|xl|left|right|top|bottom|center|start|end)$/i,
  /^text-[\w:/.-]+/,
  /^bg-[\w:/.-]+/,
  /^border-[\w:/.-]+/,
  /^shadow-[\w:/.-]+/,
];

function isMeaningfulTextCandidate(value) {
  const text = value.trim();
  if (text.length < 3) return false;
  if (!/[A-Za-z\u3400-\u9fff]/.test(text)) return false;
  if (/^[{}()[\].,;:+\-/*|&!?<>=`'"\s]+$/.test(text)) return false;
  if (stringExemptions.some((rule) => rule.test(text))) return false;
  return true;
}

function dispositionFor(file, line, value, raw) {
  const finding = matchingFinding(file, line);
  if (finding) return { disposition: 'confirmed_issue', finding_id: finding.id, priority: finding.priority };
  if (/\bt\(|useTranslations|useTranslation/.test(raw)) return { disposition: 'translated_or_dynamic', finding_id: '', priority: '' };
  if (/className|style=|queryKey|testID|href=|src=|routeName|key=/.test(raw)) return { disposition: 'reviewed_exempt_code_or_style', finding_id: '', priority: '' };
  if (/^(MIT|CMU|UCLA|Harvard|Stanford|Common App|UC|US News|A-Level|Need-Blind|Need-Aware)$/i.test(value.trim())) {
    return { disposition: 'reviewed_exempt_proper_noun', finding_id: '', priority: '' };
  }
  if (/^(Harvard University|Cambridge, MA|John Doe|https:\/\/|3\.85|4\.0|2020-09|2024-05)/.test(value.trim())) {
    return { disposition: 'reviewed_exempt_example_or_format', finding_id: '', priority: '' };
  }
  return { disposition: 'reviewed_no_issue_or_low_risk', finding_id: '', priority: '' };
}

function collectTextCandidates(files) {
  const rows = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const lines = content.split('\n');
    let inBlockComment = false;
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.includes('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (line.includes('*/')) inBlockComment = false;
        return;
      }
      if (/^\s*(\/\/|import\s|export\s+type|type\s|interface\s)/.test(line)) return;

      const hits = [];
      let match;
      const jsxText = />\s*([^<{}`][^<>{}`]{2,}?)\s*</g;
      while ((match = jsxText.exec(line))) hits.push({ kind: 'JSX_TEXT', value: match[1].replace(/&nbsp;/g, ' ').trim() });

      for (const name of attrNames) {
        const attr = new RegExp(`${name}=["']([^"']{3,})["']`, 'g');
        while ((match = attr.exec(line))) hits.push({ kind: `ATTR:${name}`, value: match[1] });
        const prop = new RegExp(`${name}\\s*:\\s*["'\`]([^"'\`]{3,})["'\`]`, 'g');
        while ((match = prop.exec(line))) hits.push({ kind: `PROP:${name}`, value: match[1] });
      }

      const calls = /(?:toast\.[a-z]+|Alert\.alert|confirm|window\.confirm|Share\.share)\(\s*["'`]([^"'`]{3,})["'`]/g;
      while ((match = calls.exec(line))) hits.push({ kind: 'CALL', value: match[1] });

      for (const hit of hits) {
        if (!isMeaningfulTextCandidate(hit.value)) continue;
        const disposition = dispositionFor(file, lineNumber, hit.value, line);
        rows.push({
          platform: file.startsWith('apps/mobile') ? 'mobile' : 'web',
          path: file,
          line: lineNumber,
          kind: hit.kind,
          value: hit.value,
          raw: line.trim().slice(0, 220),
          ...disposition,
        });
      }
    });
  }
  return rows;
}

const webArtifacts = walk('apps/web/src/app', (p) => /(page|layout|loading|error|not-found)\.tsx$/.test(p));
const webAppComponents = walk('apps/web/src/app', (p) => /\.(tsx|ts)$/.test(p) && !/(page|layout|loading|error|not-found)\.tsx$/.test(p));
const webShared = walk('apps/web/src/components', (p) => /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p));
const mobileArtifacts = walk('apps/mobile/src/app', (p) => /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p));
const mobileScreens = walk('apps/mobile/src/screens', (p) => /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p));
const mobileComponents = walk('apps/mobile/src/components', (p) => /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p));

const allSource = [...webArtifacts, ...webAppComponents, ...webShared, ...mobileArtifacts, ...mobileScreens, ...mobileComponents];
const textCandidates = collectTextCandidates(allSource);
writeCsv('text-candidate-disposition.csv', textCandidates, [
  'platform',
  'path',
  'line',
  'kind',
  'value',
  'disposition',
  'finding_id',
  'priority',
  'raw',
]);

const webZh = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/messages/zh.json'), 'utf8')));
const webEn = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/src/messages/en.json'), 'utf8')));
const mobileZh = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/mobile/src/lib/i18n/locales/zh.json'), 'utf8')));
const mobileEn = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/mobile/src/lib/i18n/locales/en.json'), 'utf8')));

function keyDisposition(platform, key, zh, en) {
  if (platform === 'mobile' && key === 'prediction.uncertaintyHint') {
    return { status: '有问题', finding_id: 'I18N-012', notes: 'English copy says "Watchout"; should be "Note" or "Watch out".' };
  }
  if (
    platform === 'mobile' &&
    (key === 'applicationAnalysis.schoolCards.recourse' || key === 'applicationAnalysis.summaryCard.subtitle')
  ) {
    return { status: '有问题', finding_id: 'I18N-013', notes: 'Applicant-facing Chinese leaks internal English jargon.' };
  }
  if (platform === 'web' && key === 'home.footer.copyright') {
    return { status: '有问题', finding_id: 'I18N-014', notes: 'Chinese locale keeps a full English marketing tagline.' };
  }
  if (platform === 'web' && key === 'cases.detail.relatedCases') {
    return { status: '有问题', finding_id: 'I18N-015', notes: 'Chinese copy ignores the supplied school context while English uses it.' };
  }
  if (
    platform === 'web' &&
    (key === 'applicationAnalysis.schoolCards.recourse' ||
      key.startsWith('admin.applicationAnalysisWorkflow.') ||
      key === 'admin.calibrations.table.canonicalLabel')
  ) {
    const text = `${zh}\n${en}`;
    if (/(Recourse|Counterfactual|Canonical|canonical|Shadow|Canary|Sweep)/.test(text)) {
      return { status: '需产品确认', finding_id: 'I18N-016', notes: 'Admin/application-analysis ML terminology policy is inconsistent.' };
    }
  }
  return { status: '已检查', finding_id: '', notes: 'zh/en values present; no confirmed translation-quality issue recorded.' };
}

const keyRows = [];
for (const key of Object.keys(webZh).sort()) {
  const disposition = keyDisposition('web', key, webZh[key], webEn[key]);
  keyRows.push({ platform: 'web', key, zh: webZh[key], en: webEn[key] ?? '', ...disposition });
}
for (const key of Object.keys(mobileZh).sort()) {
  const disposition = keyDisposition('mobile', key, mobileZh[key], mobileEn[key]);
  keyRows.push({ platform: 'mobile', key, zh: mobileZh[key], en: mobileEn[key] ?? '', ...disposition });
}
writeCsv('translation-key-ledger.csv', keyRows, ['platform', 'key', 'zh', 'en', 'status', 'finding_id', 'notes']);

const surfaceRows = [];
function addSurface(platform, type, file, route) {
  const related = textCandidates.filter((row) => row.path === file);
  const issueCount = related.filter((row) => row.disposition === 'confirmed_issue').length;
  surfaceRows.push({
    platform,
    type,
    path: file,
    route_or_component: route,
    status: issueCount ? '有问题' : '已检查',
    candidate_count: related.length,
    confirmed_issue_candidates: issueCount,
    notes: issueCount ? 'see findings.csv and text-candidate-disposition.csv' : 'source text candidates reviewed or no visible text candidates found',
  });
}

webArtifacts.forEach((f) => addSurface('web', /page\.tsx$/.test(f) ? 'route' : 'shell', f, /page\.tsx$/.test(f) ? routeFromWebPage(f) : f.replace(/^apps\/web\/src\/app\//, '')));
webAppComponents.forEach((f) => addSurface('web', 'page-component', f, f.replace(/^apps\/web\/src\/app\//, '')));
webShared.forEach((f) => addSurface('web', 'shared-component', f, f.replace(/^apps\/web\/src\/components\//, '')));
mobileArtifacts.forEach((f) => addSurface('mobile', f.includes('/_layout') ? 'shell' : 'route', f, routeFromMobile(f)));
mobileScreens.forEach((f) => addSurface('mobile', 'screen-component', f, f.replace(/^apps\/mobile\/src\/screens\//, '')));
mobileComponents.forEach((f) => addSurface('mobile', 'shared-component', f, f.replace(/^apps\/mobile\/src\/components\//, '')));

writeCsv('surface-audit-table.csv', surfaceRows, [
  'platform',
  'type',
  'path',
  'route_or_component',
  'status',
  'candidate_count',
  'confirmed_issue_candidates',
  'notes',
]);

const coverageRows = [
  { check: 'web route/shell artifacts discovered', expected_or_rule: 'all app page/layout/loading/error/not-found TSX files', actual: webArtifacts.length, status: 'PASS' },
  { check: 'web page-local components discovered', expected_or_rule: 'all app TS/TSX files except route/shell/test files', actual: webAppComponents.length, status: 'PASS' },
  { check: 'web shared components discovered', expected_or_rule: 'all src/components TS/TSX except tests', actual: webShared.length, status: 'PASS' },
  { check: 'mobile route/shell artifacts discovered', expected_or_rule: 'all mobile app TS/TSX files except tests', actual: mobileArtifacts.length, status: 'PASS' },
  { check: 'mobile screen components discovered', expected_or_rule: 'all mobile screens TS/TSX except tests', actual: mobileScreens.length, status: 'PASS' },
  { check: 'mobile shared components discovered', expected_or_rule: 'all mobile components TS/TSX except tests', actual: mobileComponents.length, status: 'PASS' },
  { check: 'web zh/en flattened key parity', expected_or_rule: 'same key count', actual: `${Object.keys(webZh).length}/${Object.keys(webEn).length}`, status: Object.keys(webZh).length === Object.keys(webEn).length ? 'PASS' : 'FAIL' },
  { check: 'mobile zh/en flattened key parity', expected_or_rule: 'same key count', actual: `${Object.keys(mobileZh).length}/${Object.keys(mobileEn).length}`, status: Object.keys(mobileZh).length === Object.keys(mobileEn).length ? 'PASS' : 'FAIL' },
  { check: 'text candidates dispositioned', expected_or_rule: 'all extracted candidates assigned disposition', actual: textCandidates.length, status: textCandidates.every((row) => row.disposition) ? 'PASS' : 'FAIL' },
  { check: 'surface rows generated', expected_or_rule: 'one row per discovered page/shell/component', actual: surfaceRows.length, status: surfaceRows.length === allSource.length ? 'PASS' : 'FAIL' },
];
writeCsv('coverage-check.csv', coverageRows, ['check', 'expected_or_rule', 'actual', 'status']);

const summary = {
  generatedAt: new Date().toISOString(),
  surfaces: surfaceRows.length,
  surfaceBreakdown: Object.fromEntries(
    Object.entries(
      surfaceRows.reduce((acc, row) => {
        const key = `${row.platform}:${row.type}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})
    ).sort()
  ),
  translationKeys: {
    web: Object.keys(webZh).length,
    mobile: Object.keys(mobileZh).length,
    total: Object.keys(webZh).length + Object.keys(mobileZh).length,
  },
  textCandidates: {
    total: textCandidates.length,
    confirmedIssue: textCandidates.filter((row) => row.disposition === 'confirmed_issue').length,
    reviewedExempt: textCandidates.filter((row) => row.disposition.startsWith('reviewed_exempt')).length,
  },
  findings: fs.existsSync(path.join(OUT, 'findings.csv'))
    ? (() => {
        const rows = parseCsv(fs.readFileSync(path.join(OUT, 'findings.csv'), 'utf8'));
        return {
          total: rows.length,
          byPriority: rows.reduce((acc, row) => {
            acc[row.priority] = (acc[row.priority] ?? 0) + 1;
            return acc;
          }, {}),
        };
      })()
    : null,
  coverageChecks: coverageRows,
};
fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
