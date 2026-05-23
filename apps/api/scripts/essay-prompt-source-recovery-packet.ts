#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SOURCE_RECOVERY_PACKET_READY'
  | 'PASS_NO_SOURCE_GAPS'
  | 'BLOCKED_WORKLIST_MISSING';

interface Args {
  worklist: string | null;
  out: string;
  markdown: string;
  csv: string;
  limitSchools: number;
  maxPromptsPerSchool: number;
}

interface WorklistReport {
  generatedAt?: string;
  applicationYear?: number;
  summary?: Record<string, unknown>;
  rows?: WorklistRow[];
}

interface WorklistRow {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  year: number;
  type: string;
  status: string;
  gap: string;
  action: string;
  severity: string;
  route: string;
  details?: {
    promptSnippet?: string;
    wordLimit?: number | null;
    isRequired?: boolean | null;
    configuredSources?: Array<{
      sourceType?: string | null;
      url?: string | null;
      scrapeGroup?: string | null;
      lastStatus?: string | null;
      lastError?: string | null;
    }>;
    sourceCandidates?: Array<{
      sourceType?: string | null;
      url?: string | null;
      reason?: string | null;
    }>;
  };
}

interface CandidateSource {
  sourceType: string;
  sourceUrl: string;
  sourceQuality: 'official' | 'common_app' | 'configured' | 'unknown';
  evidenceStatus: 'candidate_only';
  priority: number;
  reason: string;
  reviewAction: string;
}

interface SchoolPacket {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  promptCount: number;
  criticalPromptCount: number;
  promptTypeCounts: Record<string, number>;
  promptSamples: Array<{
    essayPromptId: string;
    type: string;
    wordLimit: number | null;
    isRequired: boolean | null;
    promptSnippet: string | null;
    route: string;
  }>;
  candidateSources: CandidateSource[];
  recommendedAction: string;
  reviewDisposition: 'candidate-review' | 'manual-source-search';
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(REPORT_ROOT, `essay-prompt-source-recovery-${stamp}.json`),
    )!,
  );
  const worklist = get('--worklist');
  return {
    worklist: worklist
      ? path.resolve(API_ROOT, worklist)
      : findLatestWorklist(),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limitSchools: Number(get('--limit-schools', '250')),
    maxPromptsPerSchool: Number(get('--max-prompts-per-school', '12')),
  };
}

function main() {
  const args = parseArgs();
  if (!args.worklist || !fs.existsSync(args.worklist)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-source-recovery',
      status: 'BLOCKED_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      sourceWorklist: args.worklist,
      summary: {
        sourceGapRows: 0,
        schools: 0,
        candidateSources: 0,
        manualSearchSchools: 0,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const worklist = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  const sourceGapRows = (worklist.rows ?? []).filter(isSourceRecoveryRow);
  const schoolPackets = buildSchoolPackets(
    sourceGapRows,
    args.maxPromptsPerSchool,
  )
    .sort(compareSchoolPackets)
    .slice(0, args.limitSchools);
  const candidateSourceCount = schoolPackets.reduce(
    (sum, row) => sum + row.candidateSources.length,
    0,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-source-recovery',
    status: (sourceGapRows.length > 0
      ? 'SOURCE_RECOVERY_PACKET_READY'
      : 'PASS_NO_SOURCE_GAPS') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    sourceWorklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt ?? null,
    applicationYear: worklist.applicationYear ?? null,
    summary: {
      sourceGapRows: sourceGapRows.length,
      emittedSchools: schoolPackets.length,
      totalSchools: new Set(sourceGapRows.map((row) => row.schoolId)).size,
      criticalPromptRows: sourceGapRows.filter(
        (row) => row.severity === 'critical',
      ).length,
      candidateSources: candidateSourceCount,
      configuredSourceSchools: schoolPackets.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'configured',
        ),
      ).length,
      officialCandidateSchools: schoolPackets.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'official',
        ),
      ).length,
      commonAppCandidateSchools: schoolPackets.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'common_app',
        ),
      ).length,
      manualSearchSchools: schoolPackets.filter(
        (row) => row.reviewDisposition === 'manual-source-search',
      ).length,
      byRecommendedAction: countBy(
        schoolPackets,
        (row) => row.recommendedAction,
      ),
    },
    reviewContract: {
      candidateEvidenceStatus: 'candidate_only',
      acceptedEvidenceRequires: [
        'source URL resolves to official school, Common App, UC, or other approved source family',
        'raw source content or source snapshot contains the prompt text or a stable equivalent',
        'application year/cycle matches the prompt year, or reviewer records a refresh decision',
        'word limit/required status conflicts are routed to review rather than overwritten',
      ],
      prohibitedActions: [
        'do not create EssayPromptSource from candidate URL alone',
        'do not mark source-less prompts trusted usable',
        'do not expose source-less prompts through public/timeline consumers',
      ],
    },
    nextCampaign: buildNextCampaign(schoolPackets),
    rows: schoolPackets,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function isSourceRecoveryRow(row: WorklistRow) {
  return (
    row.gap === 'source.rows_missing' ||
    row.gap === 'source.url_missing' ||
    row.action === 'source-search' ||
    row.action === 'scrape-configured-source' ||
    row.action === 'source-evidence-review'
  );
}

function buildSchoolPackets(
  rows: WorklistRow[],
  maxPromptsPerSchool: number,
): SchoolPacket[] {
  const bySchool = new Map<string, WorklistRow[]>();
  for (const row of rows) {
    const group = bySchool.get(row.schoolId) ?? [];
    group.push(row);
    bySchool.set(row.schoolId, group);
  }

  return Array.from(bySchool.values()).map((schoolRows) => {
    const [first] = schoolRows;
    const candidateSources = buildCandidateSources(schoolRows);
    return {
      schoolId: first.schoolId,
      schoolName: first.schoolName,
      usNewsRank: first.usNewsRank,
      applicationYear: first.year ?? null,
      promptCount: schoolRows.length,
      criticalPromptCount: schoolRows.filter(
        (row) => row.severity === 'critical',
      ).length,
      promptTypeCounts: countBy(schoolRows, (row) => row.type),
      promptSamples: schoolRows.slice(0, maxPromptsPerSchool).map((row) => ({
        essayPromptId: row.essayPromptId,
        type: row.type,
        wordLimit: row.details?.wordLimit ?? null,
        isRequired: row.details?.isRequired ?? null,
        promptSnippet: row.details?.promptSnippet ?? null,
        route: row.route,
      })),
      candidateSources,
      recommendedAction: recommendedAction(candidateSources),
      reviewDisposition:
        candidateSources.length > 0
          ? 'candidate-review'
          : 'manual-source-search',
    };
  });
}

function buildCandidateSources(rows: WorklistRow[]): CandidateSource[] {
  const candidates: CandidateSource[] = [];
  for (const row of rows) {
    for (const source of row.details?.configuredSources ?? []) {
      if (!source.url) continue;
      candidates.push({
        sourceType: source.sourceType ?? 'CONFIGURED',
        sourceUrl: source.url,
        sourceQuality: 'configured',
        evidenceStatus: 'candidate_only',
        priority: source.lastStatus === 'SUCCESS' ? 100 : 94,
        reason: `Existing SchoolEssaySource config (${source.scrapeGroup ?? 'GENERIC'}; lastStatus=${source.lastStatus ?? 'unknown'})`,
        reviewAction: 'scrape-configured-source',
      });
    }
    for (const source of row.details?.sourceCandidates ?? []) {
      if (!source.url) continue;
      candidates.push({
        sourceType: source.sourceType ?? 'UNKNOWN',
        sourceUrl: source.url,
        sourceQuality: sourceQuality(source.sourceType ?? ''),
        evidenceStatus: 'candidate_only',
        priority: candidatePriority(source),
        reason: source.reason ?? 'Source candidate from worklist',
        reviewAction: candidateReviewAction(source.sourceType ?? ''),
      });
    }
  }
  return dedupeByUrl(candidates).sort((a, b) => b.priority - a.priority);
}

function sourceQuality(sourceType: string): CandidateSource['sourceQuality'] {
  const normalized = sourceType.toUpperCase();
  if (normalized.includes('COMMON_APP')) return 'common_app';
  if (normalized.includes('OFFICIAL')) return 'official';
  return 'unknown';
}

function candidatePriority(source: {
  sourceType?: string | null;
  url?: string | null;
}) {
  const sourceType = source.sourceType?.toUpperCase() ?? '';
  const url = source.url ?? '';
  if (sourceType.includes('COMMON_APP')) return 86;
  if (
    sourceType === 'OFFICIAL_CANDIDATE' &&
    /essay|writing|supplement/i.test(url)
  ) {
    return 92;
  }
  if (
    sourceType === 'OFFICIAL_CANDIDATE' &&
    /admission|apply|first-year/i.test(url)
  ) {
    return 88;
  }
  if (sourceType.includes('OFFICIAL')) return 76;
  return 40;
}

function candidateReviewAction(sourceType: string) {
  const normalized = sourceType.toUpperCase();
  if (normalized.includes('COMMON_APP')) return 'review-common-app-search';
  if (normalized.includes('OFFICIAL')) return 'review-official-source';
  return 'manual-source-review';
}

function recommendedAction(candidateSources: CandidateSource[]) {
  if (
    candidateSources.some(
      (source) => source.reviewAction === 'scrape-configured-source',
    )
  ) {
    return 'scrape-configured-source';
  }
  if (
    candidateSources.some(
      (source) => source.reviewAction === 'review-official-source',
    )
  ) {
    return 'review-official-source';
  }
  if (
    candidateSources.some(
      (source) => source.reviewAction === 'review-common-app-search',
    )
  ) {
    return 'review-common-app-search';
  }
  return 'manual-source-search';
}

function buildNextCampaign(rows: SchoolPacket[]) {
  const [top] = rows;
  if (!top) {
    return {
      id: 'essay_prompt_source_recovery',
      reason: 'No source-search rows remain in the essay prompt worklist.',
    };
  }
  return {
    id: 'essay_prompt_source_recovery',
    reason: `${top.schoolName} has ${top.promptCount} source-less prompts; start with ${top.recommendedAction}.`,
    schoolId: top.schoolId,
    schoolName: top.schoolName,
    promptCount: top.promptCount,
    recommendedAction: top.recommendedAction,
  };
}

function compareSchoolPackets(a: SchoolPacket, b: SchoolPacket) {
  return (
    b.criticalPromptCount - a.criticalPromptCount ||
    b.promptCount - a.promptCount ||
    (a.usNewsRank ?? Number.MAX_SAFE_INTEGER) -
      (b.usNewsRank ?? Number.MAX_SAFE_INTEGER) ||
    a.schoolName.localeCompare(b.schoolName)
  );
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function dedupeByUrl(candidates: CandidateSource[]) {
  const seen = new Map<string, CandidateSource>();
  for (const candidate of candidates) {
    const key = normalizeCandidateUrl(candidate.sourceUrl);
    const existing = seen.get(key);
    if (!existing || candidate.priority > existing.priority) {
      seen.set(key, candidate);
    }
  }
  return Array.from(seen.values());
}

function normalizeCandidateUrl(url: string) {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

function findLatestWorklist() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => /^essay-prompt-worklist-.+\.json$/.test(file))
    .map((file) => ({
      file,
      mtimeMs: fs.statSync(path.join(REPORT_ROOT, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows)
    ? (report.rows as SchoolPacket[])
    : [];
  const lines = [
    '# Essay Prompt Source Recovery Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Source worklist: ${report.sourceWorklist ?? 'none'}`,
    `Application year: ${report.applicationYear ?? 'unknown'}`,
    '',
    '## Summary',
    '',
    `- Source gap rows: ${report.summary?.sourceGapRows ?? 0}`,
    `- Schools emitted: ${report.summary?.emittedSchools ?? 0}/${report.summary?.totalSchools ?? 0}`,
    `- Candidate sources: ${report.summary?.candidateSources ?? 0}`,
    `- Manual-search schools: ${report.summary?.manualSearchSchools ?? 0}`,
    '',
    '## Review Contract',
    '',
    '- Candidate URLs are not evidence until a reviewer or extraction job confirms prompt text, cycle year, and source family.',
    '- Do not create `EssayPromptSource` rows from URL candidates alone.',
    '- Keep source-less prompts hidden from public/timeline consumers.',
    '',
    '## Top School Queues',
    '',
    '| School | Prompts | Action | Top Candidate |',
    '| --- | ---: | --- | --- |',
    ...rows.slice(0, 40).map((row) => {
      const topCandidate = row.candidateSources[0];
      return `| ${escapeMarkdown(row.schoolName)} | ${row.promptCount} | ${row.recommendedAction} | ${topCandidate ? escapeMarkdown(topCandidate.sourceUrl) : 'manual search'} |`;
    }),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderCsv(rows: SchoolPacket[]) {
  const header = [
    'schoolId',
    'schoolName',
    'usNewsRank',
    'applicationYear',
    'promptCount',
    'criticalPromptCount',
    'recommendedAction',
    'reviewDisposition',
    'topCandidateType',
    'topCandidateUrl',
    'promptIds',
  ];
  const lines = rows.map((row) => {
    const topCandidate = row.candidateSources[0];
    return [
      row.schoolId,
      row.schoolName,
      row.usNewsRank ?? '',
      row.applicationYear ?? '',
      row.promptCount,
      row.criticalPromptCount,
      row.recommendedAction,
      row.reviewDisposition,
      topCandidate?.sourceType ?? '',
      topCandidate?.sourceUrl ?? '',
      row.promptSamples.map((prompt) => prompt.essayPromptId).join('|'),
    ]
      .map(csvCell)
      .join(',');
  });
  return `${[header.join(','), ...lines].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(`Essay prompt source recovery status: ${report.status}`);
  console.log(`Source gap rows: ${report.summary?.sourceGapRows ?? 0}`);
  console.log(`Schools emitted: ${report.summary?.emittedSchools ?? 0}`);
  console.log(`Candidate sources: ${report.summary?.candidateSources ?? 0}`);
  console.log(`JSON: ${args.out}`);
  console.log(`Markdown: ${args.markdown}`);
  console.log(`CSV: ${args.csv}`);
}

main();
