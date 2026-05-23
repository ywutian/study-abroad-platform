#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'SOURCE_RECOVERY_PACKET_READY'
  | 'PASS_NO_LINKED_SOURCE_CANDIDATES'
  | 'BLOCKED_INPUT_MISSING';

interface Args {
  sourceRecovery: string | null;
  validation: string | null;
  out: string;
  markdown: string;
  csv: string;
  minLinkScore: number;
  limitSchools: number;
  maxCandidatesPerSchool: number;
  includeCommonApp: boolean;
}

interface SourceRecoveryReport {
  generatedAt?: string;
  applicationYear?: number | null;
  rows?: SchoolPacket[];
}

interface ValidationReport {
  generatedAt?: string;
  status?: string;
  rows?: ValidationRow[];
}

interface SchoolPacket {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  promptCount: number;
  criticalPromptCount: number;
  promptTypeCounts?: Record<string, number>;
  promptSamples: PromptSample[];
  candidateSources: CandidateSource[];
  recommendedAction: string;
  reviewDisposition: string;
}

interface PromptSample {
  essayPromptId: string;
  type: string;
  wordLimit: number | null;
  isRequired: boolean | null;
  promptSnippet: string | null;
  route: string;
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

interface ValidationRow {
  candidateDepth: number;
  parentSourceUrl: string | null;
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  promptCount: number;
  criticalPromptCount: number;
  sourceQuality: string;
  sourceUrl: string;
  linkCandidates?: LinkCandidate[];
}

interface LinkCandidate {
  url: string;
  text: string;
  score: number;
  reasons: string[];
}

interface LinkedCandidate {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  applicationYear: number | null;
  parentSourceUrl: string;
  parentSourceQuality: string;
  url: string;
  text: string;
  score: number;
  reasons: string[];
  sourceQuality: CandidateSource['sourceQuality'];
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
      path.join(
        REPORT_ROOT,
        `essay-prompt-linked-source-expansion-${stamp}.json`,
      ),
    )!,
  );
  const sourceRecovery = get('--source-recovery');
  const validation = get('--validation');
  return {
    sourceRecovery: sourceRecovery
      ? path.resolve(API_ROOT, sourceRecovery)
      : findLatest(/^essay-prompt-source-recovery-.+\.json$/),
    validation: validation
      ? path.resolve(API_ROOT, validation)
      : findLatest(/^essay-prompt-source-validation.*\.json$/),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    minLinkScore: Number(get('--min-link-score', '80')),
    limitSchools: Number(get('--limit-schools', '250')),
    maxCandidatesPerSchool: Number(get('--max-candidates-per-school', '4')),
    includeCommonApp: !argv.includes('--exclude-common-app'),
  };
}

function main() {
  const args = parseArgs();
  const missingInputs = [
    ...(!args.sourceRecovery || !fs.existsSync(args.sourceRecovery)
      ? ['sourceRecovery']
      : []),
    ...(!args.validation || !fs.existsSync(args.validation)
      ? ['validation']
      : []),
  ];
  if (missingInputs.length > 0) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-linked-source-expansion',
      status: 'BLOCKED_INPUT_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      sourceRecovery: args.sourceRecovery,
      validation: args.validation,
      missingInputs,
      summary: {
        linkedCandidates: 0,
        emittedSchools: 0,
        emittedCandidateSources: 0,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const sourceRecovery = JSON.parse(
    fs.readFileSync(args.sourceRecovery!, 'utf8'),
  ) as SourceRecoveryReport;
  const validation = JSON.parse(
    fs.readFileSync(args.validation!, 'utf8'),
  ) as ValidationReport;
  const sourceRecoveryBySchool = new Map(
    (sourceRecovery.rows ?? []).map((row) => [row.schoolId, row]),
  );
  const linkedCandidates = extractLinkedCandidates(args, validation);
  const rows = buildSchoolPackets(
    args,
    linkedCandidates,
    sourceRecoveryBySchool,
  )
    .sort(compareSchoolPackets)
    .slice(0, args.limitSchools);
  const candidateSources = rows.reduce(
    (sum, row) => sum + row.candidateSources.length,
    0,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-essay-prompt-linked-source-expansion',
    status: (candidateSources > 0
      ? 'SOURCE_RECOVERY_PACKET_READY'
      : 'PASS_NO_LINKED_SOURCE_CANDIDATES') satisfies PacketStatus,
    destructiveDbWriteAllowedByThisPlan: false,
    sourceRecovery: path.relative(API_ROOT, args.sourceRecovery!),
    sourceRecoveryGeneratedAt: sourceRecovery.generatedAt ?? null,
    validation: path.relative(API_ROOT, args.validation!),
    validationGeneratedAt: validation.generatedAt ?? null,
    validationStatus: validation.status ?? null,
    applicationYear: sourceRecovery.applicationYear ?? null,
    limits: {
      minLinkScore: args.minLinkScore,
      limitSchools: args.limitSchools,
      maxCandidatesPerSchool: args.maxCandidatesPerSchool,
      includeCommonApp: args.includeCommonApp,
    },
    summary: {
      linkedCandidates: linkedCandidates.length,
      emittedSchools: rows.length,
      emittedCandidateSources: candidateSources,
      sourceRecoverySchools: sourceRecoveryBySchool.size,
      officialLinkedSchools: rows.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'official',
        ),
      ).length,
      commonAppLinkedSchools: rows.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'common_app',
        ),
      ).length,
      unknownLinkedSchools: rows.filter((row) =>
        row.candidateSources.some(
          (source) => source.sourceQuality === 'unknown',
        ),
      ).length,
      bySourceQuality: countBy(
        rows.flatMap((row) => row.candidateSources),
        (source) => source.sourceQuality,
      ),
      topSchools: rows.slice(0, 12).map((row) => ({
        schoolName: row.schoolName,
        candidates: row.candidateSources.length,
        topCandidate: row.candidateSources[0]?.sourceUrl ?? null,
      })),
    },
    reviewContract: {
      candidateEvidenceStatus: 'candidate_only',
      expansionDoesNotApproveSources: true,
      acceptedEvidenceRequires: [
        'linked URL resolves to official school, Common App, UC, or other approved source family',
        'raw source content contains prompt text or a stable equivalent',
        'cycle year/current application year signal is present or explicitly reviewed',
        'word-limit and required/optional differences are routed to review',
      ],
      prohibitedActions: [
        'do not create EssayPromptSource from linked candidate URL alone',
        'do not mark source-less prompts trusted usable from this packet',
        'do not expose prompts publicly until source rows exist and consumer gates pass',
      ],
    },
    nextCampaign: buildNextCampaign(rows),
    rows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function extractLinkedCandidates(args: Args, validation: ValidationReport) {
  const seen = new Set<string>();
  const candidates: LinkedCandidate[] = [];
  for (const row of validation.rows ?? []) {
    for (const link of row.linkCandidates ?? []) {
      if (link.score < args.minLinkScore) continue;
      const sourceQuality = classifySourceQuality(row.sourceUrl, link.url);
      if (!args.includeCommonApp && sourceQuality === 'common_app') continue;
      const key = [row.schoolId, normalizeUrl(link.url)].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        schoolId: row.schoolId,
        schoolName: row.schoolName,
        usNewsRank: row.usNewsRank,
        applicationYear: row.applicationYear,
        parentSourceUrl: row.sourceUrl,
        parentSourceQuality: row.sourceQuality,
        url: link.url,
        text: link.text,
        score: link.score,
        reasons: link.reasons ?? [],
        sourceQuality,
      });
    }
  }
  return candidates.sort(compareLinkedCandidates);
}

function buildSchoolPackets(
  args: Args,
  candidates: LinkedCandidate[],
  sourceRecoveryBySchool: Map<string, SchoolPacket>,
) {
  const bySchool = new Map<string, LinkedCandidate[]>();
  for (const candidate of candidates) {
    const group = bySchool.get(candidate.schoolId) ?? [];
    group.push(candidate);
    bySchool.set(candidate.schoolId, group);
  }
  const rows: SchoolPacket[] = [];
  for (const [schoolId, schoolCandidates] of bySchool) {
    const original = sourceRecoveryBySchool.get(schoolId);
    if (!original) continue;
    const candidateSources = schoolCandidates
      .sort(compareLinkedCandidates)
      .slice(0, args.maxCandidatesPerSchool)
      .map(toCandidateSource);
    if (candidateSources.length === 0) continue;
    rows.push({
      ...original,
      candidateSources,
      recommendedAction: 'validate-linked-source-candidates',
      reviewDisposition: 'candidate-review',
    });
  }
  return rows;
}

function toCandidateSource(candidate: LinkedCandidate): CandidateSource {
  return {
    sourceType:
      candidate.sourceQuality === 'common_app'
        ? 'LINKED_COMMON_APP_CANDIDATE'
        : candidate.sourceQuality === 'official'
          ? 'LINKED_OFFICIAL_CANDIDATE'
          : 'LINKED_UNKNOWN_CANDIDATE',
    sourceUrl: candidate.url,
    sourceQuality: candidate.sourceQuality,
    evidenceStatus: 'candidate_only',
    priority: linkedPriority(candidate),
    reason: [
      `Linked from ${candidate.parentSourceUrl}`,
      `linkScore=${candidate.score}`,
      `text=${candidate.text || 'n/a'}`,
      `reasons=${candidate.reasons.join('|') || 'none'}`,
    ].join('; '),
    reviewAction:
      candidate.sourceQuality === 'unknown'
        ? 'review-linked-source-family'
        : 'validate-linked-prompt-source',
  };
}

function classifySourceQuality(parentUrl: string, linkedUrl: string) {
  const linkedHost = safeHost(linkedUrl);
  if (linkedHost.endsWith('commonapp.org')) return 'common_app';
  const parentBase = baseDomain(parentUrl);
  const linkedBase = baseDomain(linkedUrl);
  if (parentBase && linkedBase && parentBase === linkedBase) return 'official';
  return linkedHost.endsWith('.edu') ? 'official' : 'unknown';
}

function linkedPriority(candidate: LinkedCandidate) {
  const sourceBonus =
    candidate.sourceQuality === 'official'
      ? 30
      : candidate.sourceQuality === 'common_app'
        ? 20
        : 0;
  const reasonBonus = candidate.reasons.some((reason) =>
    /supplement|essay|prompt|question/i.test(reason),
  )
    ? 20
    : 0;
  return candidate.score + sourceBonus + reasonBonus;
}

function buildNextCampaign(rows: SchoolPacket[]) {
  const top = rows[0];
  if (!top) {
    return {
      id: 'essay_prompt_source_manual_search',
      reason:
        'No linked source candidates met the expansion threshold; continue manual source search or lower threshold with review.',
    };
  }
  return {
    id: 'essay_prompt_linked_source_validation',
    reason: `${top.schoolName} has ${top.candidateSources.length} linked source candidates ready for bounded validation.`,
    schoolId: top.schoolId,
    schoolName: top.schoolName,
    topCandidate: top.candidateSources[0]?.sourceUrl ?? null,
  };
}

function compareSchoolPackets(a: SchoolPacket, b: SchoolPacket) {
  const rankA = a.usNewsRank ?? Number.POSITIVE_INFINITY;
  const rankB = b.usNewsRank ?? Number.POSITIVE_INFINITY;
  return (
    b.criticalPromptCount - a.criticalPromptCount ||
    a.candidateSources[0].sourceQuality.localeCompare(
      b.candidateSources[0].sourceQuality,
    ) ||
    b.candidateSources[0].priority - a.candidateSources[0].priority ||
    rankA - rankB ||
    a.schoolName.localeCompare(b.schoolName)
  );
}

function compareLinkedCandidates(a: LinkedCandidate, b: LinkedCandidate) {
  return (
    linkedPriority(b) - linkedPriority(a) ||
    b.score - a.score ||
    a.schoolName.localeCompare(b.schoolName) ||
    a.url.localeCompare(b.url)
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function baseDomain(url: string) {
  const host = safeHost(url);
  const parts = host.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(url ?? '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function findLatest(pattern: RegExp) {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  const latest = fs
    .readdirSync(REPORT_ROOT)
    .filter((file) => pattern.test(file))
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
  return [
    '# Essay Prompt Linked Source Expansion Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Source recovery: ${report.sourceRecovery ?? 'none'}`,
    `Validation: ${report.validation ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- Linked candidates: ${report.summary?.linkedCandidates ?? 0}`,
    `- Emitted schools: ${report.summary?.emittedSchools ?? 0}`,
    `- Emitted candidate sources: ${report.summary?.emittedCandidateSources ?? 0}`,
    `- Official linked schools: ${report.summary?.officialLinkedSchools ?? 0}`,
    `- Common App linked schools: ${report.summary?.commonAppLinkedSchools ?? 0}`,
    '',
    '## Review Contract',
    '',
    '- Linked candidates are source-search inputs only, not trusted evidence.',
    '- Run bounded validation before staging or approving any source rows.',
    '- Public/timeline consumers remain source-gated until source rows exist.',
    '',
    '## Candidate Schools',
    '',
    '| School | Candidates | Top Candidate |',
    '| --- | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${escapeMarkdown(row.schoolName)} | ${row.candidateSources.length} | ${escapeMarkdown(row.candidateSources[0]?.sourceUrl ?? '')} |`,
    ),
    '',
  ].join('\n');
}

function renderCsv(rows: SchoolPacket[]) {
  const header = [
    'schoolId',
    'schoolName',
    'applicationYear',
    'promptCount',
    'criticalPromptCount',
    'sourceUrl',
    'sourceType',
    'sourceQuality',
    'priority',
    'reason',
    'reviewAction',
  ];
  const lines = rows.flatMap((row) =>
    row.candidateSources.map((source) =>
      [
        row.schoolId,
        row.schoolName,
        row.applicationYear ?? '',
        row.promptCount,
        row.criticalPromptCount,
        source.sourceUrl,
        source.sourceType,
        source.sourceQuality,
        source.priority,
        source.reason,
        source.reviewAction,
      ]
        .map(csvCell)
        .join(','),
    ),
  );
  return `${[header.join(','), ...lines].join('\n')}\n`;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeMarkdown(value: string) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function printSummary(args: Args, report: Record<string, any>) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        linkedCandidates: report.summary.linkedCandidates,
        emittedSchools: report.summary.emittedSchools,
        emittedCandidateSources: report.summary.emittedCandidateSources,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
