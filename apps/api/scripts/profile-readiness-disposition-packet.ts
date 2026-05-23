#!/usr/bin/env tsx
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'READINESS_DISPOSITION_PACKET_READY'
  | 'BLOCKED_WORKLIST_MISSING'
  | 'BLOCKED_UNMAPPED_DISPOSITIONS';
type Severity = 'critical' | 'warning' | 'info';
type Disposition =
  | 'trusted'
  | 'user_prompt'
  | 'operator_review'
  | 'system_generation'
  | 'unmapped';

interface Args {
  worklist: string | null;
  adminDelivery: string | null;
  dispatch: string | null;
  liveGate: string | null;
  out: string;
  markdown: string;
  csv: string;
  salt: string | null;
}

interface WorklistReport {
  generatedAt?: string;
  readinessVersion?: string;
  summary?: Record<string, unknown>;
  rows?: WorklistRow[];
}

interface WorklistRow {
  userId: string;
  profileId: string | null;
  domain: string;
  gap: string;
  bucket?: string;
  action: string;
  severity: Severity;
  route: string;
  schoolId?: string;
  schoolName?: string;
  round?: string | null;
  details?: Record<string, unknown>;
}

interface DeliveryReport {
  generatedAt?: string;
  privacy?: {
    includesUserIds?: boolean;
  };
  summary?: {
    openRows?: number;
    byStatus?: Record<string, number>;
    byQueue?: Record<string, number>;
  };
}

interface DispatchReport {
  generatedAt?: string;
  summary?: {
    dispatchBatches?: number;
    blockedBatches?: number;
    inAppSurfaceReadyBatches?: number;
    liveNotificationBlockedBatches?: number;
  };
}

interface LiveGateReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    candidateRows?: number;
    blockedChannels?: string[];
    blockers?: string[];
    includesUserIds?: boolean;
  };
}

interface DispositionRow {
  recipientKey: string;
  profileKey: string | null;
  domain: string;
  gap: string;
  action: string;
  severity: Severity;
  route: string;
  disposition: Disposition;
  closureState: 'trusted' | 'actionable' | 'review' | 'blocked';
  requiredActor: 'user' | 'operator' | 'system' | 'none' | 'unknown';
  allowedWritePath: string;
  prohibitedWritePath: string;
  evidence: string[];
  schoolId?: string;
  schoolName?: string;
}

interface DispositionGroup {
  key: string;
  count: number;
  score: number;
  disposition: Disposition;
  requiredActor: DispositionRow['requiredActor'];
  highestSeverity: Severity;
  bySeverity: Record<Severity, number>;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const SEVERITY_SCORE: Record<Severity, number> = {
  critical: 5,
  warning: 3,
  info: 1,
};

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
      path.join(REPORT_ROOT, `profile-readiness-disposition-${stamp}.json`),
    )!,
  );
  const worklist = get('--worklist');
  const adminDelivery = get('--admin-delivery');
  const dispatch = get('--dispatch');
  const liveGate = get('--live-gate');
  return {
    worklist: worklist
      ? path.resolve(API_ROOT, worklist)
      : findLatest(/^profile-readiness-worklist-.+\.json$/),
    adminDelivery: adminDelivery
      ? path.resolve(API_ROOT, adminDelivery)
      : findLatest(/^profile-readiness-admin-delivery-.+\.json$/),
    dispatch: dispatch
      ? path.resolve(API_ROOT, dispatch)
      : findLatest(/^profile-readiness-dispatch-.+\.json$/),
    liveGate: liveGate
      ? path.resolve(API_ROOT, liveGate)
      : findLatest(/^profile-readiness-live-delivery-gate-.+\.json$/),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    salt: get('--salt') ?? null,
  };
}

function main() {
  const args = parseArgs();
  if (!args.worklist || !fs.existsSync(args.worklist)) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only-profile-readiness-disposition',
      status: 'BLOCKED_WORKLIST_MISSING' satisfies PacketStatus,
      destructiveDbWriteAllowedByThisPlan: false,
      worklist: args.worklist,
      summary: {
        openRows: 0,
        dispositionRows: 0,
        unmappedRows: 0,
        allOpenRowsHaveDisposition: false,
      },
      rows: [],
    };
    writeReport(args, report);
    printSummary(args, report);
    return;
  }

  const worklist = readJson<WorklistReport>(args.worklist);
  const adminDelivery = readOptionalJson<DeliveryReport>(args.adminDelivery);
  const dispatch = readOptionalJson<DispatchReport>(args.dispatch);
  const liveGate = readOptionalJson<LiveGateReport>(args.liveGate);
  const salt =
    args.salt ?? `profile-readiness-disposition:${worklist.generatedAt}`;
  const rows = (worklist.rows ?? []).map((row) => buildRow(row, salt));
  const unmappedRows = rows.filter((row) => row.disposition === 'unmapped');
  const adminBlockedRows =
    adminDelivery?.summary?.byStatus?.blocked_missing_copy ?? 0;
  const status: PacketStatus =
    unmappedRows.length > 0 || adminBlockedRows > 0
      ? 'BLOCKED_UNMAPPED_DISPOSITIONS'
      : 'READINESS_DISPOSITION_PACKET_READY';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-disposition',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    worklist: path.relative(API_ROOT, args.worklist),
    worklistGeneratedAt: worklist.generatedAt ?? null,
    readinessVersion: worklist.readinessVersion ?? 'unknown',
    adminDelivery: summarizeInput(args.adminDelivery, adminDelivery),
    dispatch: summarizeInput(args.dispatch, dispatch),
    liveGate: summarizeInput(args.liveGate, liveGate),
    privacy: {
      includesUserIds: false,
      recipientKeyStrategy: 'sha256(report-salted-user-id)',
      profileKeyStrategy: 'sha256(report-salted-profile-id)',
    },
    summary: {
      openRows: rows.length,
      dispositionRows: rows.filter((row) => row.disposition !== 'unmapped')
        .length,
      unmappedRows: unmappedRows.length,
      blockedRows: unmappedRows.length + adminBlockedRows,
      allOpenRowsHaveDisposition: unmappedRows.length === 0,
      adminDeliveryBlockedRows: adminBlockedRows,
      adminDeliveryIncludesUserIds:
        adminDelivery?.privacy?.includesUserIds ?? null,
      dispatchBatches: dispatch?.summary?.dispatchBatches ?? null,
      dispatchBlockedBatches: dispatch?.summary?.blockedBatches ?? null,
      inAppSurfaceReadyBatches:
        dispatch?.summary?.inAppSurfaceReadyBatches ?? null,
      liveGateStatus: liveGate?.status ?? null,
      liveGateBlockedChannels: liveGate?.summary?.blockedChannels ?? [],
      liveGateBlockers: liveGate?.summary?.blockers ?? [],
      byDisposition: countBy(rows, (row) => row.disposition),
      byRequiredActor: countBy(rows, (row) => row.requiredActor),
      byDomain: countBy(rows, (row) => row.domain),
      byGap: countBy(rows, (row) => row.gap),
      bySeverity: countBy(rows, (row) => row.severity),
      topDispositionGroups: topGroups(rows),
    },
    closureContract: {
      firstPartySignalsAreNotBackfilledByInference: true,
      userPromptMeans:
        'The missing fact must be collected from the user through an approved profile/readiness surface.',
      operatorReviewMeans:
        'The row needs admin/operator review of existing user-entered or linked platform data.',
      systemGenerationMeans:
        'The row can be generated only from already trusted upstream user/school/deadline/prediction data.',
      prohibitedActions: [
        'do not infer GPA, target schools, demographics, awards, activities, or essay links for users',
        'do not send live Redis/push/email nudges from this packet',
        'do not expose raw user IDs in default closure artifacts',
      ],
    },
    nextCampaign: buildNextCampaign(rows, unmappedRows, adminBlockedRows),
    rows,
  };

  writeReport(args, report);
  printSummary(args, report);
}

function buildRow(row: WorklistRow, salt: string): DispositionRow {
  const disposition = dispositionFor(row.action);
  const actor = requiredActorFor(disposition);
  return {
    recipientKey: hashKey(row.userId, salt),
    profileKey: row.profileId ? hashKey(row.profileId, salt) : null,
    domain: row.domain,
    gap: row.gap,
    action: row.action,
    severity: row.severity,
    route: row.route,
    disposition,
    closureState: closureStateFor(disposition),
    requiredActor: actor,
    allowedWritePath: allowedWritePathFor(disposition),
    prohibitedWritePath: prohibitedWritePathFor(disposition),
    evidence: evidenceFor(row, disposition),
    schoolId: row.schoolId,
    schoolName: row.schoolName,
  };
}

function dispositionFor(action: string): Disposition {
  if (action === 'accept') return 'trusted';
  if (
    [
      'prompt-user',
      'set-application-round',
      'balance-school-list',
      'start-essay-workflow',
      'add-recommendation-letters',
      'create-resume',
    ].includes(action)
  ) {
    return 'user_prompt';
  }
  if (
    [
      'review-deadline-source',
      'match-activity-template',
      'match-award-competition',
      'review-legacy-target-source',
    ].includes(action)
  ) {
    return 'operator_review';
  }
  if (
    [
      'generate-timeline',
      'run-prediction',
      'refresh-prediction',
      'run-application-analysis',
    ].includes(action)
  ) {
    return 'system_generation';
  }
  return 'unmapped';
}

function requiredActorFor(disposition: Disposition) {
  switch (disposition) {
    case 'trusted':
      return 'none';
    case 'user_prompt':
      return 'user';
    case 'operator_review':
      return 'operator';
    case 'system_generation':
      return 'system';
    case 'unmapped':
      return 'unknown';
  }
}

function closureStateFor(disposition: Disposition) {
  switch (disposition) {
    case 'trusted':
      return 'trusted';
    case 'operator_review':
      return 'review';
    case 'user_prompt':
    case 'system_generation':
      return 'actionable';
    case 'unmapped':
      return 'blocked';
  }
}

function allowedWritePathFor(disposition: Disposition) {
  switch (disposition) {
    case 'trusted':
      return 'no action needed';
    case 'user_prompt':
      return 'user-owned profile/school-list/essay/resume/recommendation UI or approved import';
    case 'operator_review':
      return 'admin review queue or curated taxonomy/source review workflow';
    case 'system_generation':
      return 'dry-run generation from trusted upstream data, followed by normal service write path';
    case 'unmapped':
      return 'none until disposition mapping is added';
  }
}

function prohibitedWritePathFor(disposition: Disposition) {
  if (disposition === 'trusted') return 'do not overwrite without user change';
  return 'no inferred first-party facts, no raw-user-ID default exports, no live notification send';
}

function evidenceFor(row: WorklistRow, disposition: Disposition) {
  const evidence = [
    'profile-readiness-worklist',
    `gap:${row.gap}`,
    `action:${row.action}`,
    `route:${row.route}`,
  ];
  if (disposition === 'user_prompt') {
    evidence.push('GET /profiles/me/readiness');
    evidence.push('profile-readiness-admin-delivery');
  }
  if (disposition === 'operator_review') {
    evidence.push('admin/operator review queue');
  }
  if (disposition === 'system_generation') {
    evidence.push('system-generation queue');
  }
  return evidence;
}

function buildNextCampaign(
  rows: DispositionRow[],
  unmappedRows: DispositionRow[],
  adminBlockedRows: number,
) {
  if (unmappedRows.length > 0) {
    const row = unmappedRows[0];
    return {
      id: 'profile_readiness_disposition_mapping',
      reason: `${unmappedRows.length} readiness rows have unmapped actions; add disposition mapping before treating the worklist as closed-loop.`,
      action: row.action,
      gap: row.gap,
    };
  }
  if (adminBlockedRows > 0) {
    return {
      id: 'profile_readiness_delivery_copy',
      reason: `${adminBlockedRows} admin delivery rows are blocked by missing copy or delivery metadata.`,
    };
  }
  const topUserPrompt = topGroups(
    rows.filter((row) => row.disposition === 'user_prompt'),
  )[0];
  if (topUserPrompt) {
    return {
      id: 'profile_readiness_user_prompt_delivery',
      reason: `${topUserPrompt.count} rows are ready for user-prompt disposition in ${topUserPrompt.key}; weighted readiness score ${topUserPrompt.score} with highest severity ${topUserPrompt.highestSeverity}.`,
      group: topUserPrompt.key,
      score: topUserPrompt.score,
      highestSeverity: topUserPrompt.highestSeverity,
    };
  }
  return {
    id: 'profile_readiness_monitor',
    reason:
      'All open readiness rows have explicit dispositions; monitor user completion and rerun worklist.',
  };
}

function topGroups(rows: DispositionRow[]) {
  const groups = new Map<string, DispositionGroup>();
  for (const row of rows) {
    const key = `${row.domain}:${row.action}:${row.gap}`;
    const group =
      groups.get(key) ??
      ({
        key,
        count: 0,
        score: 0,
        disposition: row.disposition,
        requiredActor: row.requiredActor,
        highestSeverity: row.severity,
        bySeverity: {
          critical: 0,
          warning: 0,
          info: 0,
        },
      } satisfies DispositionGroup);
    group.count += 1;
    group.score += SEVERITY_SCORE[row.severity];
    group.bySeverity[row.severity] += 1;
    if (SEVERITY_SCORE[row.severity] > SEVERITY_SCORE[group.highestSeverity]) {
      group.highestSeverity = row.severity;
    }
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .sort(
      (a, b) =>
        b.score - a.score || b.count - a.count || a.key.localeCompare(b.key),
    )
    .slice(0, 12);
}

function hashKey(value: string, salt: string) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${value}`)
    .digest('hex')
    .slice(0, 24);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readOptionalJson<T>(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return readJson<T>(filePath);
}

function summarizeInput(
  filePath: string | null,
  report: Record<string, any> | null,
) {
  return {
    path: filePath ? path.relative(API_ROOT, filePath) : null,
    found: Boolean(report),
    generatedAt: report?.generatedAt ?? null,
    status: report?.status ?? null,
    summary: report?.summary ?? null,
  };
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
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file))[0];
  return latest ? path.join(REPORT_ROOT, latest.file) : null;
}

function writeReport(args: Args, report: Record<string, any>) {
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(report.rows ?? []), 'utf8');
}

function renderMarkdown(report: Record<string, any>) {
  const groups = Array.isArray(report.summary?.topDispositionGroups)
    ? report.summary.topDispositionGroups
    : [];
  return [
    '# Profile Readiness Disposition Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Worklist: ${report.worklist ?? 'none'}`,
    '',
    '## Summary',
    '',
    `- Open rows: ${report.summary?.openRows ?? 0}`,
    `- Disposition rows: ${report.summary?.dispositionRows ?? 0}`,
    `- Unmapped rows: ${report.summary?.unmappedRows ?? 0}`,
    `- Blocked rows: ${report.summary?.blockedRows ?? 0}`,
    `- Admin delivery blocked rows: ${report.summary?.adminDeliveryBlockedRows ?? 0}`,
    '',
    '## Contract',
    '',
    '- Missing first-party signals are user-prompt/operator/system-generation dispositions, not inferred facts.',
    '- Default output uses anonymized recipient/profile keys.',
    '- This packet does not send notifications or write profile data.',
    '',
    '## Top Disposition Groups',
    '',
    '| Group | Rows | Weighted score | Highest severity |',
    '| --- | ---: | ---: | --- |',
    ...(groups.length > 0
      ? groups.map(
          (group: any) =>
            `| ${escapeMarkdown(group.key)} | ${group.count} | ${group.score ?? group.count} | ${group.highestSeverity ?? 'unknown'} |`,
        )
      : ['| None | 0 | 0 | none |']),
    '',
  ].join('\n');
}

function renderCsv(rows: DispositionRow[]) {
  const header = [
    'recipientKey',
    'profileKey',
    'domain',
    'gap',
    'action',
    'severity',
    'route',
    'disposition',
    'closureState',
    'requiredActor',
    'allowedWritePath',
    'prohibitedWritePath',
    'schoolId',
    'schoolName',
  ];
  const lines = rows.map((row) =>
    [
      row.recipientKey,
      row.profileKey ?? '',
      row.domain,
      row.gap,
      row.action,
      row.severity,
      row.route,
      row.disposition,
      row.closureState,
      row.requiredActor,
      row.allowedWritePath,
      row.prohibitedWritePath,
      row.schoolId ?? '',
      row.schoolName ?? '',
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
        openRows: report.summary.openRows,
        dispositionRows: report.summary.dispositionRows,
        unmappedRows: report.summary.unmappedRows,
        blockedRows: report.summary.blockedRows,
        byDisposition: report.summary.byDisposition,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
