#!/usr/bin/env tsx
import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type PacketStatus =
  | 'AI_MEMORY_DISPOSITION_READY'
  | 'BLOCKED_UNMAPPED_AI_MEMORY_ROWS'
  | 'BLOCKED_DB_QUERY_FAILED';
type ClosureState = 'trusted' | 'review' | 'terminal' | 'conflict';
type SensitivityTier = 'low' | 'medium' | 'high' | 'unknown';
type ConsentState =
  | 'explicit_enabled'
  | 'explicit_disabled'
  | 'missing_preference_row';
type ProvenanceState =
  | 'source_linked'
  | 'conversation_linked'
  | 'tool_or_action_linked'
  | 'weak_metadata_only'
  | 'missing';
type RetentionState =
  | 'expires'
  | 'long_lived_allowed_by_type'
  | 'missing_expiry_review'
  | 'archived';

interface Args {
  out: string;
  markdown: string;
  csv: string;
  limitMemories: number;
  salt: string | null;
}

interface DispositionRow {
  memoryKey: string;
  userKey: string;
  type: string;
  category: string | null;
  importance: number;
  accessCount: number;
  hasExpiry: boolean;
  hasMetadata: boolean;
  hasSourceSignal: boolean;
  hasConversationLink: boolean;
  hasConflictFlag: boolean;
  hasArchivedFlag: boolean;
  consentState: ConsentState;
  sensitivityTier: SensitivityTier;
  provenanceState: ProvenanceState;
  retentionState: RetentionState;
  disposition: string;
  closureState: ClosureState;
  nextAction: string;
  consumerPolicy: string;
  evidence: string[];
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const HIGH_SENSITIVITY_CATEGORIES = new Set([
  'activity',
  'award',
  'essay',
  'essay_polish',
  'essay_review',
  'profile',
  'profile_analysis',
  'profile_update',
  'prediction_feedback',
  'school_prediction',
  'test_score',
]);
const MEDIUM_SENSITIVITY_CATEGORIES = new Set([
  'academic',
  'case_research',
  'education',
  'improvement',
  'school_recommendation',
  'swipe_prediction',
  'target_school',
  'target_school_list',
  'timeline',
]);
const LOW_SENSITIVITY_CATEGORIES = new Set(['forum_interest', 'school']);

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
      path.join(REPORT_ROOT, `ai-memory-disposition-${stamp}.json`),
    )!,
  );
  return {
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limitMemories: Number(get('--limit-memories', '5000')),
    salt: get('--salt') ?? null,
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const report = await buildReport(prisma, args);
    writeReport(args, report);
    printSummary(args, report);
  } catch (error) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-ai-memory-disposition',
      status: 'BLOCKED_DB_QUERY_FAILED' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      error: error instanceof Error ? error.message : String(error),
      summary: {
        allRowsHaveDisposition: false,
        unmappedRows: 0,
        blockedRows: 1,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function buildReport(prisma: PrismaClient, args: Args) {
  const [
    totalMemories,
    conversations,
    messages,
    preferences,
    routeEmbeddings,
    entities,
    graphEntities,
    relationships,
    memories,
  ] = await Promise.all([
    prisma.memory.count(),
    prisma.agentConversation.count(),
    prisma.agentMessage.count(),
    prisma.userAIPreference.count(),
    prisma.agentRouteEmbedding.count(),
    prisma.entity.count(),
    prisma.graphEntity.count(),
    prisma.entityRelationship.count(),
    prisma.memory.findMany({
      take: args.limitMemories,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        type: true,
        category: true,
        importance: true,
        accessCount: true,
        lastAccessedAt: true,
        metadata: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const preferenceRows = await prisma.userAIPreference.findMany({
    where: { userId: { in: [...new Set(memories.map((row) => row.userId))] } },
    select: { userId: true, enableMemory: true },
  });
  const preferenceByUser = new Map(
    preferenceRows.map((row) => [row.userId, row.enableMemory]),
  );
  const salt = args.salt ?? `ai-memory-disposition:${new Date().toISOString()}`;
  const rows = memories.map((row) =>
    dispositionRow(row, preferenceByUser.get(row.userId), salt),
  );
  const unmappedRows = rows.filter((row) => row.disposition === 'unmapped');
  const truncatedRows = Math.max(0, totalMemories - rows.length);
  const blockedRows = unmappedRows.length + truncatedRows;
  const status: PacketStatus =
    blockedRows > 0
      ? 'BLOCKED_UNMAPPED_AI_MEMORY_ROWS'
      : 'AI_MEMORY_DISPOSITION_READY';

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-ai-memory-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    privacy: {
      includesUserIds: false,
      includesMemoryContent: false,
      memoryKeyStrategy: 'sha256(report-salted-memory-id)',
      userKeyStrategy: 'sha256(report-salted-user-id)',
    },
    limits: {
      memories: args.limitMemories,
      truncatedRows,
    },
    summary: {
      totalMemories,
      emittedRows: rows.length,
      allRowsHaveDisposition: unmappedRows.length === 0 && truncatedRows === 0,
      unmappedRows: unmappedRows.length,
      blockedRows,
      truncatedRows,
      conversations,
      messages,
      preferences,
      routeEmbeddings,
      entities,
      graphEntities,
      relationships,
      memoriesNoExpiry: countWhere(rows, (row) => !row.hasExpiry),
      missingConsentRows: countWhere(
        rows,
        (row) => row.consentState === 'missing_preference_row',
      ),
      disabledConsentRows: countWhere(
        rows,
        (row) => row.consentState === 'explicit_disabled',
      ),
      missingProvenanceRows: countWhere(
        rows,
        (row) => row.provenanceState === 'missing',
      ),
      weakProvenanceRows: countWhere(
        rows,
        (row) => row.provenanceState === 'weak_metadata_only',
      ),
      highSensitivityRows: countWhere(
        rows,
        (row) => row.sensitivityTier === 'high',
      ),
      conflictRows: countWhere(rows, (row) => row.closureState === 'conflict'),
      terminalRows: countWhere(rows, (row) => row.closureState === 'terminal'),
      reviewRows: countWhere(rows, (row) => row.closureState === 'review'),
      trustedRows: countWhere(rows, (row) => row.closureState === 'trusted'),
      byType: countBy(rows, (row) => row.type),
      byCategory: countBy(rows, (row) => row.category ?? 'uncategorized'),
      bySensitivityTier: countBy(rows, (row) => row.sensitivityTier),
      byConsentState: countBy(rows, (row) => row.consentState),
      byProvenanceState: countBy(rows, (row) => row.provenanceState),
      byRetentionState: countBy(rows, (row) => row.retentionState),
      byClosureState: countBy(rows, (row) => row.closureState),
      byDisposition: countBy(rows, (row) => row.disposition),
      topReviewGroups: topGroups(
        rows.filter((row) => ['review', 'conflict'].includes(row.closureState)),
      ),
    },
    closureContract: {
      noRawMemoryExport:
        'This packet exports metadata-derived dispositions only; memory content and raw user IDs stay out of closure reports.',
      chatConsumption:
        'Chat/application-analysis consumers may use memories only with sensitivity, source, retention, and consent weak-state awareness.',
      prohibitedActions: [
        'do not treat LLM-extracted memories as verified external facts',
        'do not store high-sensitivity memories indefinitely without an explicit retention decision',
        'do not recall memories for users whose memory preference is explicitly disabled',
        'do not use memory-derived school/deadline/prediction facts to override sourced domain data',
      ],
    },
    nextCampaign: buildNextCampaign(rows, blockedRows),
    rows,
  };
}

function dispositionRow(
  row: {
    id: string;
    userId: string;
    type: string;
    category: string | null;
    importance: number;
    accessCount: number;
    metadata: unknown;
    expiresAt: Date | null;
  },
  enableMemory: boolean | undefined,
  salt: string,
): DispositionRow {
  const metadata = objectRecord(row.metadata);
  const hasSourceSignal = hasAny(metadata, [
    'source',
    'sourceType',
    'toolName',
    'action',
    'rawMatch',
    'dedupeKey',
  ]);
  const hasConversationLink = hasAny(metadata, ['conversationId', 'messageId']);
  const hasConflictFlag = Boolean(
    metadata.pendingConflict || metadata.conflictWith,
  );
  const hasArchivedFlag = Boolean(metadata.archived || metadata.archivedAt);
  const consentState: ConsentState =
    enableMemory === true
      ? 'explicit_enabled'
      : enableMemory === false
        ? 'explicit_disabled'
        : 'missing_preference_row';
  const sensitivityTier = sensitivityFor(row.type, row.category);
  const provenanceState = provenanceFor(
    metadata,
    hasSourceSignal,
    hasConversationLink,
  );
  const retentionState = retentionFor(row.type, row.expiresAt, hasArchivedFlag);
  const disposition = classifyDisposition({
    consentState,
    sensitivityTier,
    provenanceState,
    retentionState,
    hasConflictFlag,
    hasArchivedFlag,
  });
  const closureState = closureStateFor(disposition);
  return {
    memoryKey: hashKey(`memory:${row.id}`, salt),
    userKey: hashKey(`user:${row.userId}`, salt),
    type: row.type,
    category: row.category,
    importance: row.importance,
    accessCount: row.accessCount,
    hasExpiry: Boolean(row.expiresAt),
    hasMetadata: Object.keys(metadata).length > 0,
    hasSourceSignal,
    hasConversationLink,
    hasConflictFlag,
    hasArchivedFlag,
    consentState,
    sensitivityTier,
    provenanceState,
    retentionState,
    disposition,
    closureState,
    nextAction: nextActionFor(disposition),
    consumerPolicy: consumerPolicyFor(disposition, sensitivityTier),
    evidence: evidenceFor(row, {
      consentState,
      sensitivityTier,
      provenanceState,
      retentionState,
      hasSourceSignal,
      hasConversationLink,
      hasConflictFlag,
      hasArchivedFlag,
    }),
  };
}

function classifyDisposition(input: {
  consentState: ConsentState;
  sensitivityTier: SensitivityTier;
  provenanceState: ProvenanceState;
  retentionState: RetentionState;
  hasConflictFlag: boolean;
  hasArchivedFlag: boolean;
}) {
  if (input.hasArchivedFlag) return 'terminal_archived_memory';
  if (input.consentState === 'explicit_disabled') {
    return 'terminal_memory_disabled_by_user_preference';
  }
  if (input.hasConflictFlag) return 'conflict_memory_review_required';
  if (input.consentState === 'missing_preference_row') {
    return 'review_missing_memory_consent_preference';
  }
  if (input.provenanceState === 'missing') {
    return 'review_missing_memory_source';
  }
  if (
    input.sensitivityTier === 'high' &&
    input.retentionState === 'missing_expiry_review'
  ) {
    return 'review_sensitive_memory_missing_expiry';
  }
  if (input.provenanceState === 'weak_metadata_only') {
    return 'review_weak_memory_provenance';
  }
  return 'trusted_memory_with_contract';
}

function closureStateFor(disposition: string): ClosureState {
  if (disposition.startsWith('trusted_')) return 'trusted';
  if (disposition.startsWith('terminal_')) return 'terminal';
  if (disposition.startsWith('conflict_')) return 'conflict';
  return 'review';
}

function nextActionFor(disposition: string) {
  switch (disposition) {
    case 'trusted_memory_with_contract':
      return 'accept';
    case 'terminal_archived_memory':
    case 'terminal_memory_disabled_by_user_preference':
      return 'mark-terminal';
    case 'conflict_memory_review_required':
      return 'resolve-conflict';
    case 'review_missing_memory_consent_preference':
      return 'create-or-confirm-memory-preference';
    case 'review_missing_memory_source':
    case 'review_weak_memory_provenance':
      return 'backfill-source-metadata-or-review';
    case 'review_sensitive_memory_missing_expiry':
      return 'set-retention-policy-or-review';
    default:
      return 'review';
  }
}

function consumerPolicyFor(
  disposition: string,
  sensitivityTier: SensitivityTier,
) {
  if (disposition === 'trusted_memory_with_contract') {
    return 'chat_context_allowed_with_source_and_sensitivity_weak_state';
  }
  if (disposition.startsWith('terminal_')) {
    return 'do_not_recall_for_chat_context';
  }
  if (disposition.startsWith('conflict_')) {
    return 'do_not_use_until_conflict_resolved';
  }
  if (sensitivityTier === 'high') {
    return 'review_before_chat_recall_or_application_analysis_context';
  }
  return 'weak_state_only_until_source_consent_retention_review';
}

function sensitivityFor(
  type: string,
  category: string | null,
): SensitivityTier {
  const normalized = (category ?? '').trim();
  if (HIGH_SENSITIVITY_CATEGORIES.has(normalized)) return 'high';
  if (MEDIUM_SENSITIVITY_CATEGORIES.has(normalized)) return 'medium';
  if (LOW_SENSITIVITY_CATEGORIES.has(normalized)) return 'low';
  if (['FACT', 'DECISION', 'FEEDBACK'].includes(type)) return 'medium';
  if (type === 'PREFERENCE') return 'medium';
  return 'unknown';
}

function provenanceFor(
  metadata: Record<string, unknown>,
  hasSourceSignal: boolean,
  hasConversationLink: boolean,
): ProvenanceState {
  if (typeof metadata.source === 'string' && metadata.source.trim()) {
    return 'source_linked';
  }
  if (hasConversationLink) return 'conversation_linked';
  if (hasAny(metadata, ['toolName', 'action', 'rawMatch', 'dedupeKey'])) {
    return 'tool_or_action_linked';
  }
  if (hasSourceSignal || Object.keys(metadata).length > 0) {
    return 'weak_metadata_only';
  }
  return 'missing';
}

function retentionFor(
  type: string,
  expiresAt: Date | null,
  archived: boolean,
): RetentionState {
  if (archived) return 'archived';
  if (expiresAt) return 'expires';
  if (['DECISION', 'PREFERENCE'].includes(type))
    return 'long_lived_allowed_by_type';
  return 'missing_expiry_review';
}

function evidenceFor(
  row: { type: string; category: string | null },
  input: {
    consentState: ConsentState;
    sensitivityTier: SensitivityTier;
    provenanceState: ProvenanceState;
    retentionState: RetentionState;
    hasSourceSignal: boolean;
    hasConversationLink: boolean;
    hasConflictFlag: boolean;
    hasArchivedFlag: boolean;
  },
) {
  return [
    'Memory',
    `type:${row.type}`,
    `category:${row.category ?? 'uncategorized'}`,
    `consent:${input.consentState}`,
    `sensitivity:${input.sensitivityTier}`,
    `provenance:${input.provenanceState}`,
    `retention:${input.retentionState}`,
    ...(input.hasSourceSignal ? ['metadata:source-signal'] : []),
    ...(input.hasConversationLink ? ['metadata:conversation-link'] : []),
    ...(input.hasConflictFlag ? ['metadata:conflict-flag'] : []),
    ...(input.hasArchivedFlag ? ['metadata:archived-flag'] : []),
    'AI_AGENT_MEMORY_SYSTEM_SPEC.md',
  ];
}

function buildNextCampaign(rows: DispositionRow[], blockedRows: number) {
  if (blockedRows > 0) {
    return {
      id: 'ai_memory_disposition_mapping',
      reason: `${blockedRows} AI memory rows are unmapped or truncated; increase limits or add disposition mapping before closure.`,
    };
  }
  const topReview = topGroups(
    rows.filter((row) => ['review', 'conflict'].includes(row.closureState)),
  )[0];
  if (topReview) {
    return {
      id: 'ai_memory_consent_source_retention_review',
      reason: `${topReview.count} rows need review in ${topReview.key}.`,
      group: topReview.key,
    };
  }
  return {
    id: 'ai_memory_monitor',
    reason:
      'All memory rows have trusted or terminal dispositions; monitor new memories and rerun packet.',
  };
}

function topGroups(rows: DispositionRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.type}:${row.category ?? 'uncategorized'}:${row.disposition}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 12);
}

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countWhere<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function hasAny(record: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => {
    const value = record[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== null && value !== undefined;
  });
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hashKey(value: string, salt: string) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${value}`)
    .digest('hex')
    .slice(0, 24);
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const summary = report.summary ?? {};
  const groups = Array.isArray(summary.topReviewGroups)
    ? summary.topReviewGroups
    : [];
  return [
    '# AI Memory Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total memories: ${summary.totalMemories ?? 0}`,
    `- Emitted rows: ${summary.emittedRows ?? 0}`,
    `- Missing consent rows: ${summary.missingConsentRows ?? 0}`,
    `- Missing provenance rows: ${summary.missingProvenanceRows ?? 0}`,
    `- No-expiry rows: ${summary.memoriesNoExpiry ?? 0}`,
    `- High-sensitivity rows: ${summary.highSensitivityRows ?? 0}`,
    `- Review rows: ${summary.reviewRows ?? 0}`,
    `- Trusted rows: ${summary.trustedRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- This packet is read-only and does not write DB rows.',
    '- It exports anonymized keys, not raw user IDs.',
    '- It does not export memory content.',
    '- Chat and application-analysis consumers must treat review rows as weak-state context, not sourced facts.',
    '',
    '## Top Review Groups',
    '',
    '| Group | Rows |',
    '| --- | ---: |',
    ...(groups.length
      ? groups.map(
          (group: any) => `| ${escapeMarkdown(group.key)} | ${group.count} |`,
        )
      : ['| None | 0 |']),
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const header = [
    'memoryKey',
    'userKey',
    'type',
    'category',
    'importance',
    'accessCount',
    'hasExpiry',
    'hasMetadata',
    'hasSourceSignal',
    'hasConversationLink',
    'hasConflictFlag',
    'hasArchivedFlag',
    'consentState',
    'sensitivityTier',
    'provenanceState',
    'retentionState',
    'disposition',
    'closureState',
    'nextAction',
    'consumerPolicy',
  ];
  const lines = rows.map((row) =>
    [
      row.memoryKey,
      row.userKey,
      row.type,
      row.category ?? '',
      row.importance,
      row.accessCount,
      row.hasExpiry,
      row.hasMetadata,
      row.hasSourceSignal,
      row.hasConversationLink,
      row.hasConflictFlag,
      row.hasArchivedFlag,
      row.consentState,
      row.sensitivityTier,
      row.provenanceState,
      row.retentionState,
      row.disposition,
      row.closureState,
      row.nextAction,
      row.consumerPolicy,
    ]
      .map(csvCell)
      .join(','),
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
        csv: args.csv,
        totalMemories: report.summary?.totalMemories ?? 0,
        emittedRows: report.summary?.emittedRows ?? 0,
        blockedRows: report.summary?.blockedRows ?? 0,
        byClosureState: report.summary?.byClosureState ?? {},
        byDisposition: report.summary?.byDisposition ?? {},
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
