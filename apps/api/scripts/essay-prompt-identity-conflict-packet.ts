#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PacketStatus =
  | 'ESSAY_PROMPT_IDENTITY_CONFLICT_PACKET_READY'
  | 'PASS_NO_IDENTITY_CONFLICTS';

type Severity = 'critical' | 'warning' | 'info';
type MatchConfidence = 'high' | 'medium';

interface Args {
  out: string;
  markdown: string;
  csv: string;
  applicationYear: number;
  includeNonCurrent: boolean;
  includeSourceBacked: boolean;
  limit: number;
}

interface SchoolIdentity {
  id: string;
  name: string;
  aliases: string[];
  usNewsRank: number | null;
  city: string | null;
  state: string | null;
  website: string | null;
}

interface TermEntry {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  city: string | null;
  state: string | null;
  website: string | null;
  term: string;
  normalizedTerm: string;
  source: 'name' | 'alias' | 'derived';
  confidence: MatchConfidence;
}

interface TermMatch {
  entry: TermEntry;
  start: number;
  end: number;
  snippet: string;
}

interface ConflictRow {
  essayPromptId: string;
  assignedSchoolId: string;
  assignedSchoolName: string;
  matchedSchoolId: string;
  matchedSchoolName: string;
  year: number;
  status: string;
  type: string;
  severity: Severity;
  closureState: 'conflict' | 'review';
  disposition: string;
  matchedTerm: string;
  matchedTermSource: TermEntry['source'];
  matchConfidence: MatchConfidence;
  evidenceSnippet: string;
  promptSnippet: string;
  hasSourceRows: boolean;
  sourceUrls: string[];
  ownSchoolMentioned: boolean;
  schoolIdentityRelation:
    | 'possible_duplicate_same_website_location'
    | 'possible_duplicate_same_website'
    | 'distinct_school_identity';
  schoolIdentityRelationSignals: string[];
  route: string;
  recommendedAction: string;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');

const GENERIC_TERMS = new Set([
  'admission',
  'admissions',
  'application',
  'campus',
  'college',
  'community',
  'engineering',
  'institute',
  'louis',
  'mary',
  'school',
  'state',
  'tech',
  'university',
  'william',
]);

const AMBIGUOUS_SINGLE_WORDS = new Set([
  'american',
  'boston',
  'brown',
  'case',
  'city',
  'college',
  'columbia',
  'common',
  'george',
  'hamilton',
  'john',
  'johns',
  'new',
  'north',
  'northeastern',
  'northwestern',
  'southern',
  'state',
  'texas',
  'washington',
  'western',
]);

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function resolveApplicationYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
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
      path.join(REPORT_ROOT, `essay-prompt-identity-conflicts-${stamp}.json`),
    )!,
  );
  return {
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
    includeNonCurrent: argv.includes('--include-non-current'),
    includeSourceBacked: argv.includes('--include-source-backed'),
    limit: Number(get('--limit', '500')),
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const [schools, prompts] = await Promise.all([
      prisma.school.findMany({
        select: {
          id: true,
          name: true,
          aliases: true,
          usNewsRank: true,
          city: true,
          state: true,
          website: true,
        },
      }),
      prisma.essayPrompt.findMany({
        where: {
          isActive: true,
          ...(args.includeNonCurrent ? {} : { year: args.applicationYear }),
          ...(args.includeSourceBacked
            ? {}
            : {
                sources: { none: {} },
              }),
        },
        orderBy: [
          { year: 'desc' },
          { school: { usNewsRank: { sort: 'asc', nulls: 'last' } } },
          { school: { name: 'asc' } },
          { sortOrder: 'asc' },
        ],
        select: {
          id: true,
          schoolId: true,
          type: true,
          status: true,
          year: true,
          prompt: true,
          school: {
            select: {
              name: true,
              aliases: true,
              usNewsRank: true,
              city: true,
              state: true,
              website: true,
            },
          },
          sources: {
            select: {
              sourceUrl: true,
            },
          },
        },
      }),
    ]);

    const schoolIdentities = schools.map((school) => ({
      id: school.id,
      name: school.name,
      aliases: school.aliases ?? [],
      usNewsRank: school.usNewsRank,
      city: school.city,
      state: school.state,
      website: school.website,
    }));
    const terms = buildLexicon(schoolIdentities);
    const termsBySchool = groupTermsBySchool(terms);
    const rows = prompts.flatMap((prompt) =>
      detectPromptConflicts(prompt, terms, termsBySchool),
    );
    const orderedRows = rows.sort(compareRows).slice(0, args.limit);
    const conflictRows = orderedRows.filter(
      (row) => row.closureState === 'conflict',
    ).length;
    const reviewRows = orderedRows.filter(
      (row) => row.closureState === 'review',
    ).length;
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-essay-prompt-identity-conflict',
      status: (orderedRows.length > 0
        ? 'ESSAY_PROMPT_IDENTITY_CONFLICT_PACKET_READY'
        : 'PASS_NO_IDENTITY_CONFLICTS') satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      applicationYear: args.applicationYear,
      limits: {
        includeNonCurrent: args.includeNonCurrent,
        includeSourceBacked: args.includeSourceBacked,
        requestedRows: args.limit,
        emittedRows: orderedRows.length,
      },
      summary: {
        scannedPrompts: prompts.length,
        scannedSchools: schoolIdentities.length,
        identityTerms: terms.length,
        emittedRows: orderedRows.length,
        conflictRows,
        reviewRows,
        criticalRows: orderedRows.filter((row) => row.severity === 'critical')
          .length,
        promptIdsWithFindings: new Set(
          orderedRows.map((row) => row.essayPromptId),
        ).size,
        assignedSchoolsWithFindings: new Set(
          orderedRows.map((row) => row.assignedSchoolId),
        ).size,
        byAssignedSchool: countBy(orderedRows, (row) => row.assignedSchoolName),
        byMatchedSchool: countBy(orderedRows, (row) => row.matchedSchoolName),
        bySchoolIdentityRelation: countBy(
          orderedRows,
          (row) => row.schoolIdentityRelation,
        ),
        byDisposition: countBy(orderedRows, (row) => row.disposition),
      },
      reviewContract: {
        candidateEvidenceStatus: 'identity_conflict_candidate',
        packetDoesNotRejectPrompts: true,
        acceptedResolutionRequires: [
          'official source confirms the prompt belongs to the assigned school',
          'or prompt is corrected/reassigned through an approved admin workflow',
          'or reviewer marks the school-name mention as benign with rationale',
        ],
        prohibitedActions: [
          'do not expose conflicted source-less prompts as trusted current-year prompt data',
          'do not rewrite prompt.schoolId from this packet alone',
          'do not treat a school-name text match as source evidence',
        ],
      },
      nextCampaign: buildNextCampaign(orderedRows),
      rows: orderedRows,
    };
    writeReport(args, report);
    printSummary(args, report);
  } finally {
    await prisma.$disconnect();
  }
}

function buildLexicon(schools: SchoolIdentity[]): TermEntry[] {
  const entries: TermEntry[] = [];
  for (const school of schools) {
    const add = (
      term: string,
      source: TermEntry['source'],
      confidence: MatchConfidence,
    ) => {
      const normalizedTerm = normalizeText(term);
      if (!isUsableTerm(normalizedTerm, source)) return;
      entries.push({
        schoolId: school.id,
        schoolName: school.name,
        usNewsRank: school.usNewsRank,
        city: school.city,
        state: school.state,
        website: school.website,
        term: term.trim(),
        normalizedTerm,
        source,
        confidence,
      });
    };
    add(school.name, 'name', 'high');
    for (const alias of school.aliases ?? []) add(alias, 'alias', 'high');
    for (const derived of deriveTerms(school.name)) {
      add(derived, 'derived', 'medium');
    }
  }
  const byTermAndSchool = new Map<string, TermEntry>();
  for (const entry of entries) {
    const key = `${entry.schoolId}:${entry.normalizedTerm}`;
    const existing = byTermAndSchool.get(key);
    if (!existing || rankTerm(entry) > rankTerm(existing)) {
      byTermAndSchool.set(key, entry);
    }
  }
  return Array.from(byTermAndSchool.values()).sort(
    (a, b) =>
      b.normalizedTerm.length - a.normalizedTerm.length ||
      rankTerm(b) - rankTerm(a) ||
      a.schoolName.localeCompare(b.schoolName),
  );
}

function deriveTerms(name: string) {
  const normalized = normalizeText(name);
  const withoutSuffix = normalized
    .replace(/^the\s+/, '')
    .replace(/\b(university|college|institute|school)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const terms = new Set<string>();
  if (withoutSuffix && withoutSuffix !== normalized) terms.add(withoutSuffix);
  const firstDistinctive = withoutSuffix
    .split(' ')
    .find(
      (word) =>
        word.length >= 4 &&
        !GENERIC_TERMS.has(word) &&
        !AMBIGUOUS_SINGLE_WORDS.has(word),
    );
  if (firstDistinctive) terms.add(firstDistinctive);
  return Array.from(terms);
}

function isUsableTerm(normalizedTerm: string, source: TermEntry['source']) {
  if (!normalizedTerm) return false;
  if (GENERIC_TERMS.has(normalizedTerm)) return false;
  const words = normalizedTerm.split(' ').filter(Boolean);
  if (words.length >= 2) return true;
  if (source === 'alias') {
    return (
      normalizedTerm.length >= 3 && !AMBIGUOUS_SINGLE_WORDS.has(normalizedTerm)
    );
  }
  return (
    normalizedTerm.length >= 5 && !AMBIGUOUS_SINGLE_WORDS.has(normalizedTerm)
  );
}

function rankTerm(entry: TermEntry) {
  const sourceRank =
    entry.source === 'name' ? 3 : entry.source === 'alias' ? 2 : 1;
  const confidenceRank = entry.confidence === 'high' ? 2 : 1;
  return sourceRank * 10 + confidenceRank;
}

function groupTermsBySchool(terms: TermEntry[]) {
  const bySchool = new Map<string, TermEntry[]>();
  for (const term of terms) {
    bySchool.set(term.schoolId, [...(bySchool.get(term.schoolId) ?? []), term]);
  }
  return bySchool;
}

function detectPromptConflicts(
  prompt: {
    id: string;
    schoolId: string;
    type: string;
    status: string;
    year: number;
    prompt: string;
    school: {
      name: string;
      aliases: string[];
      usNewsRank: number | null;
      city: string | null;
      state: string | null;
      website: string | null;
    };
    sources: Array<{ sourceUrl: string | null }>;
  },
  terms: TermEntry[],
  termsBySchool: Map<string, TermEntry[]>,
): ConflictRow[] {
  const normalizedPrompt = normalizeText(prompt.prompt);
  if (!normalizedPrompt) return [];

  const ownTerms = termsBySchool.get(prompt.schoolId) ?? [];
  const ownMatches = ownTerms.flatMap((term) =>
    findTermMatches(normalizedPrompt, term).map((match) => ({
      start: match.start,
      end: match.end,
    })),
  );
  const foreignMatches = dedupeMatches(
    removeCoveredForeignMatches(
      terms
        .filter((term) => term.schoolId !== prompt.schoolId)
        .flatMap((term) => findTermMatches(normalizedPrompt, term))
        .filter((match) => !isCoveredByOwnMatch(match, ownMatches)),
    ),
  );

  return foreignMatches.map((match) => {
    const closureState = shouldTreatAsConflict(prompt, match)
      ? 'conflict'
      : 'review';
    const identityRelation = classifySchoolIdentityRelation(
      prompt.school,
      match.entry,
    );
    return {
      essayPromptId: prompt.id,
      assignedSchoolId: prompt.schoolId,
      assignedSchoolName: prompt.school.name,
      matchedSchoolId: match.entry.schoolId,
      matchedSchoolName: match.entry.schoolName,
      year: prompt.year,
      status: prompt.status,
      type: prompt.type,
      severity:
        prompt.status === 'VERIFIED' && prompt.sources.length === 0
          ? 'critical'
          : 'warning',
      closureState,
      disposition:
        closureState === 'conflict'
          ? 'conflict_foreign_school_mention_on_source_less_verified_prompt'
          : 'review_foreign_school_mention',
      matchedTerm: match.entry.term,
      matchedTermSource: match.entry.source,
      matchConfidence: match.entry.confidence,
      evidenceSnippet: match.snippet,
      promptSnippet: snippet(prompt.prompt, 220),
      hasSourceRows: prompt.sources.length > 0,
      sourceUrls: prompt.sources
        .map((source) => source.sourceUrl)
        .filter((url): url is string => Boolean(url)),
      ownSchoolMentioned: ownMatches.length > 0,
      schoolIdentityRelation: identityRelation.relation,
      schoolIdentityRelationSignals: identityRelation.signals,
      route: `/admin/essay-prompts/${prompt.id}`,
      recommendedAction:
        closureState === 'conflict'
          ? 'review-or-reassign-prompt-before-source-approval'
          : 'review-school-name-mention-before-closing',
    };
  });
}

function classifySchoolIdentityRelation(
  assignedSchool: {
    name: string;
    city: string | null;
    state: string | null;
    website: string | null;
  },
  matchedSchool: {
    schoolName: string;
    city: string | null;
    state: string | null;
    website: string | null;
  },
) {
  const signals: string[] = [];
  const assignedWebsite = normalizeWebsite(assignedSchool.website);
  const matchedWebsite = normalizeWebsite(matchedSchool.website);
  const sameWebsite =
    Boolean(assignedWebsite) && assignedWebsite === matchedWebsite;
  const sameLocation =
    normalizePlace(assignedSchool.city) ===
      normalizePlace(matchedSchool.city) &&
    normalizePlace(assignedSchool.state) ===
      normalizePlace(matchedSchool.state) &&
    Boolean(
      normalizePlace(assignedSchool.city) ||
      normalizePlace(assignedSchool.state),
    );

  if (sameWebsite) signals.push(`same website domain: ${assignedWebsite}`);
  if (sameLocation) {
    signals.push(
      `same location: ${assignedSchool.city ?? 'unknown'}, ${
        assignedSchool.state ?? 'unknown'
      }`,
    );
  }

  if (sameWebsite && sameLocation) {
    return {
      relation: 'possible_duplicate_same_website_location' as const,
      signals,
    };
  }
  if (sameWebsite) {
    return {
      relation: 'possible_duplicate_same_website' as const,
      signals,
    };
  }
  return {
    relation: 'distinct_school_identity' as const,
    signals,
  };
}

function normalizeWebsite(value: string | null | undefined) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  try {
    const withProtocol = /^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return raw
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();
  }
}

function normalizePlace(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function shouldTreatAsConflict(
  prompt: { status: string; sources: unknown[] },
  match: TermMatch,
) {
  return (
    prompt.status === 'VERIFIED' &&
    prompt.sources.length === 0 &&
    match.entry.confidence === 'high'
  );
}

function findTermMatches(
  normalizedText: string,
  entry: TermEntry,
): TermMatch[] {
  const matches: TermMatch[] = [];
  let searchFrom = 0;
  while (searchFrom < normalizedText.length) {
    const start = normalizedText.indexOf(entry.normalizedTerm, searchFrom);
    if (start < 0) break;
    const end = start + entry.normalizedTerm.length;
    if (hasBoundary(normalizedText, start, end)) {
      matches.push({
        entry,
        start,
        end,
        snippet: snippetAround(normalizedText, start, end),
      });
    }
    searchFrom = end;
  }
  return matches;
}

function hasBoundary(value: string, start: number, end: number) {
  return !isWordChar(value[start - 1]) && !isWordChar(value[end]);
}

function isWordChar(value: string | undefined) {
  return Boolean(value && /[a-z0-9]/i.test(value));
}

function isCoveredByOwnMatch(
  match: TermMatch,
  ownMatches: Array<{ start: number; end: number }>,
) {
  return ownMatches.some(
    (ownMatch) => ownMatch.start <= match.start && ownMatch.end >= match.end,
  );
}

function dedupeMatches(matches: TermMatch[]) {
  const bestByKey = new Map<string, TermMatch>();
  for (const match of matches) {
    const key = `${match.entry.schoolId}`;
    const existing = bestByKey.get(key);
    if (
      !existing ||
      match.entry.normalizedTerm.length >
        existing.entry.normalizedTerm.length ||
      rankTerm(match.entry) > rankTerm(existing.entry)
    ) {
      bestByKey.set(key, match);
    }
  }
  return Array.from(bestByKey.values());
}

function removeCoveredForeignMatches(matches: TermMatch[]) {
  const kept: TermMatch[] = [];
  for (const match of matches.sort(compareMatchesBySpecificity)) {
    const coveredByBetterMatch = kept.some(
      (keptMatch) =>
        keptMatch.start <= match.start &&
        keptMatch.end >= match.end &&
        (keptMatch.entry.normalizedTerm.length >
          match.entry.normalizedTerm.length ||
          rankTerm(keptMatch.entry) >= rankTerm(match.entry)),
    );
    if (!coveredByBetterMatch) kept.push(match);
  }
  return kept.sort((a, b) => a.start - b.start);
}

function compareMatchesBySpecificity(a: TermMatch, b: TermMatch) {
  return (
    b.entry.normalizedTerm.length - a.entry.normalizedTerm.length ||
    rankTerm(b.entry) - rankTerm(a.entry) ||
    a.start - b.start
  );
}

function compareRows(a: ConflictRow, b: ConflictRow) {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    closureWeight(b.closureState) - closureWeight(a.closureState) ||
    a.assignedSchoolName.localeCompare(b.assignedSchoolName) ||
    a.matchedSchoolName.localeCompare(b.matchedSchoolName)
  );
}

function severityWeight(severity: Severity) {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function closureWeight(state: ConflictRow['closureState']) {
  return state === 'conflict' ? 2 : 1;
}

function normalizeText(value: string) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function snippet(value: string, maxLength = 180) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function snippetAround(value: string, start: number, end: number) {
  const radius = 90;
  const left = Math.max(0, start - radius);
  const right = Math.min(value.length, end + radius);
  return `${left > 0 ? '...' : ''}${value.slice(left, right)}${
    right < value.length ? '...' : ''
  }`;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildNextCampaign(rows: ConflictRow[]) {
  const top = rows[0];
  if (!top) {
    return {
      id: 'essay_prompt_source_validation_continue',
      reason:
        'No prompt-school identity conflicts were detected; continue source validation and review.',
    };
  }
  return {
    id: 'essay_prompt_identity_conflict_review',
    reason: `${top.assignedSchoolName} prompt mentions ${top.matchedSchoolName}; review before source approval or public/timeline exposure.`,
    essayPromptId: top.essayPromptId,
    assignedSchoolId: top.assignedSchoolId,
    assignedSchoolName: top.assignedSchoolName,
    matchedSchoolId: top.matchedSchoolId,
    matchedSchoolName: top.matchedSchoolName,
    recommendedAction: top.recommendedAction,
  };
}

function writeReport(args: Args, report: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report as any));
  fs.writeFileSync(args.csv, renderCsv((report as any).rows ?? []));

  if (args.out.startsWith(REPORT_ROOT)) {
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBase = path.join(
    REPORT_ROOT,
    `essay-prompt-identity-conflicts-${stamp}`,
  );
  fs.mkdirSync(REPORT_ROOT, { recursive: true });
  fs.writeFileSync(
    `${reportBase}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(`${reportBase}.md`, renderMarkdown(report as any));
  fs.writeFileSync(`${reportBase}.csv`, renderCsv((report as any).rows ?? []));
}

function renderMarkdown(report: {
  generatedAt: string;
  status: string;
  applicationYear: number;
  summary: Record<string, unknown>;
  nextCampaign: Record<string, unknown>;
  rows: ConflictRow[];
}) {
  const topRows = report.rows.slice(0, 30);
  return [
    '# Essay Prompt Identity Conflict Packet',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Application year: ${report.applicationYear}`,
    '',
    '## Summary',
    '',
    `- Scanned prompts: ${report.summary.scannedPrompts}`,
    `- Findings: ${report.summary.emittedRows}`,
    `- Conflict rows: ${report.summary.conflictRows}`,
    `- Review rows: ${report.summary.reviewRows}`,
    `- Critical rows: ${report.summary.criticalRows}`,
    '',
    '## Next Campaign',
    '',
    `- ${report.nextCampaign.reason ?? 'Continue essay prompt closure.'}`,
    '',
    '## Top Findings',
    '',
    topRows.length === 0
      ? '- None'
      : topRows
          .map(
            (row) =>
              `- ${row.severity.toUpperCase()} ${row.assignedSchoolName} prompt mentions ${row.matchedSchoolName} via "${row.matchedTerm}" (${row.disposition})`,
          )
          .join('\n'),
    '',
    '## Review Contract',
    '',
    '- This packet is read-only and does not reject, reassign, or approve prompts.',
    '- Treat high-confidence foreign-school mentions on source-less verified prompts as conflict candidates.',
    '- Resolve through official source evidence, admin correction, or reviewer rationale before public/timeline exposure.',
    '',
  ].join('\n');
}

function renderCsv(rows: ConflictRow[]) {
  const headers = [
    'essayPromptId',
    'assignedSchoolName',
    'matchedSchoolName',
    'year',
    'status',
    'type',
    'severity',
    'closureState',
    'disposition',
    'matchedTerm',
    'matchedTermSource',
    'matchConfidence',
    'ownSchoolMentioned',
    'hasSourceRows',
    'route',
    'evidenceSnippet',
  ];
  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => csvCell((row as any)[header])).join(','),
    ),
  ].join('\n');
}

function csvCell(value: unknown) {
  const text = Array.isArray(value)
    ? value.join('|')
    : value === null || value === undefined
      ? ''
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function printSummary(
  args: Args,
  report: {
    status: string;
    summary: Record<string, unknown>;
    nextCampaign: Record<string, unknown>;
  },
) {
  console.log(
    JSON.stringify(
      {
        status: report.status,
        out: args.out,
        markdown: args.markdown,
        csv: args.csv,
        scannedPrompts: report.summary.scannedPrompts,
        findings: report.summary.emittedRows,
        conflictRows: report.summary.conflictRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
