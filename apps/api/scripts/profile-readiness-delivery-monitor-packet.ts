#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type MonitorStatus =
  | 'READINESS_DELIVERY_MONITOR_ACTIVE'
  | 'READINESS_DELIVERY_MONITOR_COMPLETE'
  | 'BLOCKED_READINESS_DELIVERY_MONITOR';
type CheckStatus = 'pass' | 'warn' | 'fail';

interface Args {
  worklist: string | null;
  adminDelivery: string | null;
  consumerClosure: string | null;
  campaignGroup: string | null;
  out: string;
  markdown: string;
  csv: string;
}

interface WorklistReport {
  generatedAt?: string;
  readinessVersion?: string;
  summary?: Record<string, unknown>;
  rows?: WorklistRow[];
}

interface WorklistRow {
  domain?: string;
  gap?: string;
  action?: string;
  severity?: string;
  route?: string;
}

interface AdminDeliveryReport {
  generatedAt?: string;
  privacy?: { includesUserIds?: boolean };
  summary?: Record<string, unknown>;
  rows?: DeliveryRow[];
}

interface ConsumerClosureReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    topCampaignGroup?: string | null;
    topCampaignDeliveryRows?: number;
    topCampaignReadyRows?: number;
    topCampaignAnonymized?: boolean;
    topCampaignAllowedChannels?: string[];
    topCampaignLiveChannelsDisabled?: string[];
  };
  topCampaignDeliveryRows?: DeliveryRow[];
  nextCampaign?: unknown;
}

interface DeliveryRow {
  recipientKey?: string;
  campaignId?: string;
  domain?: string;
  action?: string;
  gap?: string;
  severity?: string;
  status?: string;
  route?: string;
  allowedChannels?: string[];
  liveChannelsDisabled?: string[];
  frequencyDedupeKey?: string;
  suppressWhen?: string[];
}

interface CheckRow {
  id: string;
  status: CheckStatus;
  summary: string;
  evidence: string[];
  missing: string[];
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const LIVE_CHANNELS = ['redis_notification_feed', 'remote_push', 'email'];
const APPROVED_SURFACES = ['in_app_readiness_surface', 'dashboard'];

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
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? resolveInputPath(value) : findLatest(pattern);
  };
  const campaignGroup = get('--campaign-group') ?? null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultReportName = campaignGroup
    ? `profile-readiness-delivery-monitor-${slug(campaignGroup)}-${stamp}.json`
    : `profile-readiness-delivery-monitor-${stamp}.json`;
  const out = path.resolve(
    API_ROOT,
    get('--out', path.join(REPORT_ROOT, defaultReportName))!,
  );
  return {
    worklist: optionalPath(
      '--worklist',
      /^profile-readiness-worklist-.+\.json$/,
    ),
    adminDelivery: optionalPath(
      '--admin-delivery',
      /^profile-readiness-admin-delivery-.+\.json$/,
    ),
    consumerClosure: optionalPath(
      '--consumer-closure',
      /^profile-readiness-consumer-closure-.+\.json$/,
    ),
    campaignGroup,
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
  };
}

function resolveInputPath(value: string) {
  if (path.isAbsolute(value)) return value;
  const candidates = [
    path.resolve(process.cwd(), value),
    path.resolve(API_ROOT, value),
  ];
  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[1]
  );
}

function main() {
  const args = parseArgs();
  const worklist = readOptionalJson<WorklistReport>(args.worklist);
  const adminDelivery = readOptionalJson<AdminDeliveryReport>(
    args.adminDelivery,
  );
  const consumerClosure = readOptionalJson<ConsumerClosureReport>(
    args.consumerClosure,
  );
  const selectedCampaignGroup =
    args.campaignGroup ?? consumerClosure?.summary?.topCampaignGroup ?? null;
  const targetCampaign = parseDispositionGroup(selectedCampaignGroup);
  const activeTopCampaignGroup = consumerClosure?.summary?.topCampaignGroup;
  const monitorsActiveTopCampaign =
    selectedCampaignGroup === activeTopCampaignGroup;
  const worklistRows = targetCampaign
    ? (worklist?.rows ?? []).filter((row) => matchesGroup(row, targetCampaign))
    : [];
  const adminRows = targetCampaign
    ? (adminDelivery?.rows ?? []).filter((row) =>
        matchesGroup(row, targetCampaign),
      )
    : [];
  const previewRows = (consumerClosure?.topCampaignDeliveryRows ?? []).filter(
    (row) => !targetCampaign || matchesGroup(row, targetCampaign),
  );
  const monitorRows = previewRows.length > 0 ? previewRows : adminRows;
  const checks = buildChecks({
    worklist,
    adminDelivery,
    consumerClosure,
    targetCampaign,
    selectedCampaignGroup,
    monitorsActiveTopCampaign,
    worklistRows,
    monitorRows,
  });
  const failedChecks = checks.filter((check) => check.status === 'fail');
  const pendingRows = Math.max(worklistRows.length, monitorRows.length);
  const status: MonitorStatus =
    failedChecks.length > 0
      ? 'BLOCKED_READINESS_DELIVERY_MONITOR'
      : pendingRows === 0
        ? 'READINESS_DELIVERY_MONITOR_COMPLETE'
        : 'READINESS_DELIVERY_MONITOR_ACTIVE';
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-delivery-monitor',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationSendAllowedByThisPlan: false,
    sourceArtifacts: {
      worklist: summarizeInput(args.worklist, worklist),
      adminDelivery: summarizeInput(args.adminDelivery, adminDelivery),
      consumerClosure: summarizeInput(args.consumerClosure, consumerClosure),
    },
    summary: {
      topCampaignGroup: selectedCampaignGroup,
      targetCampaignGroups: selectedCampaignGroup
        ? [selectedCampaignGroup]
        : [],
      targetMonitorCount: selectedCampaignGroup ? 1 : 0,
      activeTopCampaignGroup,
      campaignSelectionSource: args.campaignGroup
        ? 'campaign-group-override'
        : 'consumer-closure-top-campaign',
      targetMonitorSelectionSources: [
        args.campaignGroup
          ? 'campaign-group-override'
          : 'consumer-closure-top-campaign',
      ],
      monitorsActiveTopCampaign,
      topCampaignDomain: targetCampaign?.domain ?? null,
      topCampaignAction: targetCampaign?.action ?? null,
      topCampaignGap: targetCampaign?.gap ?? null,
      currentWorklistRows: worklistRows.length,
      deliveryPreviewRows: monitorRows.length,
      readyPreviewRows: monitorRows.filter(
        (row) => row.status === 'ready_for_in_app_admin_delivery',
      ).length,
      uniquePreviewRecipients: unique(
        monitorRows.map((row) => row.recipientKey).filter(isNonEmptyString),
      ).length,
      pendingRows,
      targetMonitorPendingRows: pendingRows,
      completedRows: pendingRows === 0 ? worklistRows.length : 0,
      topCampaignAnonymized:
        adminDelivery?.privacy?.includesUserIds === false &&
        (!monitorsActiveTopCampaign ||
          consumerClosure?.summary?.topCampaignAnonymized === true),
      targetMonitorAnonymizedFailures:
        adminDelivery?.privacy?.includesUserIds === false &&
        (!monitorsActiveTopCampaign ||
          consumerClosure?.summary?.topCampaignAnonymized === true)
          ? 0
          : 1,
      allowedChannels: unique(
        monitorRows.flatMap((row) => row.allowedChannels ?? []),
      ).sort(),
      liveChannelsDisabled: unique(
        monitorRows.flatMap((row) => row.liveChannelsDisabled ?? []),
      ).sort(),
      rowsWithSuppression: monitorRows.filter(
        (row) => (row.suppressWhen ?? []).length > 0,
      ).length,
      failedChecks: failedChecks.length,
      warningChecks: checks.filter((check) => check.status === 'warn').length,
      passedChecks: checks.filter((check) => check.status === 'pass').length,
    },
    monitorContract: {
      firstPartyFactsAreUserProvided: true,
      writesFirstPartyFacts: false,
      sendsNotifications: false,
      defaultReportsStayAnonymized: true,
      approvedDeliverySurfaces: APPROVED_SURFACES,
      liveChannelsRemainDisabledUntilPolicyApproval: LIVE_CHANNELS,
      completionSignal:
        'pendingRows reaches 0 after the current worklist no longer emits this top campaign gap',
    },
    nextCampaign: nextCampaign(
      status,
      failedChecks,
      targetCampaign,
      pendingRows,
      selectedCampaignGroup,
    ),
    checks,
    rows: monitorRows.map((row) => ({
      recipientKey: row.recipientKey ?? '',
      campaignId: row.campaignId ?? '',
      status: row.status ?? '',
      severity: row.severity ?? '',
      route: row.route ?? '',
      allowedChannels: row.allowedChannels ?? [],
      liveChannelsDisabled: row.liveChannelsDisabled ?? [],
      frequencyDedupeKey: row.frequencyDedupeKey ?? '',
      suppressWhen: row.suppressWhen ?? [],
    })),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(checks, report.rows), 'utf8');
  printSummary(args, report);
}

function buildChecks(input: {
  worklist: WorklistReport | null;
  adminDelivery: AdminDeliveryReport | null;
  consumerClosure: ConsumerClosureReport | null;
  targetCampaign: ReturnType<typeof parseDispositionGroup>;
  selectedCampaignGroup: string | null;
  monitorsActiveTopCampaign: boolean;
  worklistRows: WorklistRow[];
  monitorRows: DeliveryRow[];
}) {
  const checks: CheckRow[] = [];
  const add = (
    id: string,
    ok: boolean,
    summary: string,
    evidence: string[],
    missing: string[] = [],
  ) => {
    checks.push({
      id,
      status: ok ? 'pass' : 'fail',
      summary,
      evidence,
      missing,
    });
  };
  add(
    'consumer_closure_present',
    Boolean(input.consumerClosure),
    'Delivery monitor requires the latest consumer closure packet.',
    [`status=${input.consumerClosure?.status ?? 'missing'}`],
    input.consumerClosure ? [] : ['--consumer-closure'],
  );
  add(
    'top_campaign_identified',
    Boolean(input.targetCampaign),
    'The delivery monitor must identify a readiness campaign group.',
    [`group=${input.selectedCampaignGroup ?? 'missing'}`],
    input.targetCampaign
      ? []
      : ['--campaign-group or summary.topCampaignGroup'],
  );
  add(
    'worklist_alignment',
    input.worklistRows.length === input.monitorRows.length,
    'The monitor rows should match the current top-campaign worklist rows.',
    [
      `worklistRows=${input.worklistRows.length}`,
      `monitorRows=${input.monitorRows.length}`,
    ],
    input.worklistRows.length === input.monitorRows.length
      ? []
      : ['regenerate worklist/admin-delivery/consumer-closure together'],
  );
  add(
    'monitor_rows_ready',
    input.monitorRows.length > 0 &&
      input.monitorRows.every(
        (row) => row.status === 'ready_for_in_app_admin_delivery',
      ),
    'Pending top-campaign rows must be ready for in-app/admin delivery.',
    [
      `rows=${input.monitorRows.length}`,
      `ready=${input.monitorRows.filter((row) => row.status === 'ready_for_in_app_admin_delivery').length}`,
    ],
    input.monitorRows.length > 0 ? [] : ['topCampaignDeliveryRows'],
  );
  add(
    'monitor_rows_anonymized',
    input.adminDelivery?.privacy?.includesUserIds === false &&
      (!input.monitorsActiveTopCampaign ||
        input.consumerClosure?.summary?.topCampaignAnonymized === true),
    'Delivery monitor rows must stay anonymized by default.',
    [
      `adminIncludesUserIds=${String(input.adminDelivery?.privacy?.includesUserIds)}`,
      `consumerClosureTopCampaignAnonymized=${String(input.consumerClosure?.summary?.topCampaignAnonymized)}`,
      `monitorsActiveTopCampaign=${String(input.monitorsActiveTopCampaign)}`,
    ],
  );
  add(
    'approved_surfaces_only',
    input.monitorRows.every((row) =>
      APPROVED_SURFACES.every((surface) =>
        (row.allowedChannels ?? []).includes(surface),
      ),
    ),
    'Delivery monitor rows must stay on approved in-app/dashboard surfaces.',
    [`approvedSurfaces=${APPROVED_SURFACES.join(',')}`],
  );
  add(
    'live_channels_disabled',
    input.monitorRows.every((row) =>
      LIVE_CHANNELS.every((channel) =>
        (row.liveChannelsDisabled ?? []).includes(channel),
      ),
    ),
    'Live Redis, push, and email delivery must remain disabled in this monitor.',
    [`disabledChannels=${LIVE_CHANNELS.join(',')}`],
  );
  add(
    'suppression_rules_present',
    input.monitorRows.length > 0 &&
      input.monitorRows.every((row) => (row.suppressWhen ?? []).length > 0),
    'Every delivery monitor row needs suppression criteria before display.',
    [
      `rowsWithSuppression=${input.monitorRows.filter((row) => (row.suppressWhen ?? []).length > 0).length}`,
    ],
  );
  return checks;
}

function nextCampaign(
  status: MonitorStatus,
  failedChecks: CheckRow[],
  targetCampaign: ReturnType<typeof parseDispositionGroup>,
  pendingRows: number,
  selectedCampaignGroup: string | null,
) {
  if (status === 'BLOCKED_READINESS_DELIVERY_MONITOR') {
    return {
      id: 'profile_readiness_delivery_monitor_fix',
      reason: `${failedChecks.length} monitor checks failed; fix ${failedChecks[0]?.id ?? 'unknown'} first.`,
      firstFailedCheck: failedChecks[0]?.id ?? null,
    };
  }
  if (status === 'READINESS_DELIVERY_MONITOR_COMPLETE') {
    return {
      id: 'profile_readiness_next_user_prompt_campaign',
      reason:
        'The current top campaign has no pending monitor rows; regenerate disposition to select the next readiness campaign.',
    };
  }
  return {
    id: `profile_readiness_monitor_${slug(selectedCampaignGroup ?? 'campaign')}`,
    reason: `${pendingRows} anonymized in-app/dashboard rows remain pending for ${targetCampaign?.gap ?? 'the readiness campaign'}.`,
    group: selectedCampaignGroup,
    recommendedAction:
      'monitor in-app/dashboard completion and regenerate readiness worklist',
  };
}

function matchesGroup(
  row: { domain?: string; action?: string; gap?: string },
  group: { domain: string; action: string; gap: string },
) {
  return (
    row.domain === group.domain &&
    row.action === group.action &&
    row.gap === group.gap
  );
}

function parseDispositionGroup(group: string | null | undefined) {
  if (!group) return null;
  const [domain, action, ...gapParts] = group.split(':');
  const gap = gapParts.join(':');
  if (!domain || !action || !gap) return null;
  return { domain, action, gap };
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

function findLatest(pattern: RegExp) {
  const candidates = [REPORT_ROOT, '/tmp'].filter((dir) => fs.existsSync(dir));
  const latest = candidates
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((file) => pattern.test(file))
        .map((file) => ({
          file: path.join(dir, file),
          mtimeMs: fs.statSync(path.join(dir, file)).mtimeMs,
        })),
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.file.localeCompare(a.file))[0];
  return latest?.file ?? null;
}

function readOptionalJson<T>(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? report.rows : [];
  return [
    '# Profile Readiness Delivery Monitor',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Top campaign: ${report.summary.topCampaignGroup ?? 'none'}`,
    `- Current worklist rows: ${report.summary.currentWorklistRows}`,
    `- Delivery preview rows: ${report.summary.deliveryPreviewRows}`,
    `- Ready preview rows: ${report.summary.readyPreviewRows}`,
    `- Unique preview recipients: ${report.summary.uniquePreviewRecipients}`,
    `- Pending rows: ${report.summary.pendingRows}`,
    `- Top campaign anonymized: ${report.summary.topCampaignAnonymized ? 'yes' : 'no'}`,
    `- Sends notifications: ${report.notificationSendAllowedByThisPlan ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    '| Check | Status | Summary | Missing |',
    '| --- | --- | --- | --- |',
    ...report.checks.map(
      (check: CheckRow) =>
        `| ${escapeMarkdown(check.id)} | ${check.status} | ${escapeMarkdown(check.summary)} | ${escapeMarkdown(check.missing.join(', ') || 'none')} |`,
    ),
    '',
    '## Monitor Rows',
    '',
    `Showing ${Math.min(rows.length, 25)} of ${rows.length} anonymized rows.`,
    '',
    '| Recipient | Status | Severity | Route | Suppress When |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length
      ? rows
          .slice(0, 25)
          .map(
            (row: any) =>
              `| ${escapeMarkdown(row.recipientKey)} | ${escapeMarkdown(row.status)} | ${escapeMarkdown(row.severity)} | ${escapeMarkdown(row.route)} | ${escapeMarkdown((row.suppressWhen ?? []).join('; '))} |`,
          )
      : ['| none | n/a | n/a | n/a | n/a |']),
    '',
  ].join('\n');
}

function renderCsv(checks: CheckRow[], rows: Record<string, any>[]) {
  const header = [
    'rowKind',
    'id',
    'status',
    'summary',
    'missing',
    'recipientKey',
    'campaignId',
    'severity',
    'route',
    'allowedChannels',
    'liveChannelsDisabled',
    'frequencyDedupeKey',
    'suppressWhen',
  ];
  const checkRows = checks.map((check) =>
    [
      'check',
      check.id,
      check.status,
      check.summary,
      check.missing.join('; '),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]
      .map(csvCell)
      .join(','),
  );
  const monitorRows = rows.map((row) =>
    [
      'monitor_row',
      '',
      row.status,
      'anonymized readiness delivery monitor row',
      '',
      row.recipientKey,
      row.campaignId,
      row.severity,
      row.route,
      (row.allowedChannels ?? []).join('; '),
      (row.liveChannelsDisabled ?? []).join('; '),
      row.frequencyDedupeKey,
      (row.suppressWhen ?? []).join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...checkRows, ...monitorRows].join('\n')}\n`;
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
        topCampaignGroup: report.summary.topCampaignGroup,
        pendingRows: report.summary.pendingRows,
        failedChecks: report.summary.failedChecks,
        sendsNotifications: report.notificationSendAllowedByThisPlan,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
