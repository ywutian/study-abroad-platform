#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type MonitorStatus =
  | 'READINESS_CAMPAIGN_STACK_MONITOR_READY'
  | 'READINESS_CAMPAIGN_STACK_MONITOR_COMPLETE'
  | 'BLOCKED_READINESS_CAMPAIGN_STACK_MONITOR';
type CheckStatus = 'pass' | 'warn' | 'fail';

interface Args {
  disposition: string | null;
  adminDelivery: string | null;
  consumerClosure: string | null;
  deliveryMonitor: string | null;
  targetDeliveryMonitor: string[];
  out: string;
  markdown: string;
  csv: string;
  limit: number;
}

interface DispositionReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    openRows?: number;
    dispositionRows?: number;
    blockedRows?: number;
    unmappedRows?: number;
    allOpenRowsHaveDisposition?: boolean;
    topDispositionGroups?: TopDispositionGroup[];
  };
  nextCampaign?: {
    group?: string;
    score?: number;
    highestSeverity?: string;
  };
}

interface TopDispositionGroup {
  key: string;
  count: number;
  score: number;
  disposition: string;
  requiredActor: string;
  highestSeverity: string;
  bySeverity?: Record<string, number>;
}

interface AdminDeliveryReport {
  generatedAt?: string;
  privacy?: { includesUserIds?: boolean };
  summary?: {
    openRows?: number;
    uniqueRecipients?: number;
    campaignGroups?: number;
    byStatus?: Record<string, number>;
    byQueue?: Record<string, number>;
  };
  rows?: DeliveryRow[];
}

interface DeliveryRow {
  queue?: string;
  status?: string;
  recipientKey?: string;
  campaignId?: string;
  domain?: string;
  action?: string;
  gap?: string;
  severity?: string;
  route?: string;
  allowedChannels?: string[];
  liveChannelsDisabled?: string[];
  frequencyDedupeKey?: string;
  suppressWhen?: string[];
}

interface ConsumerClosureReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    topCampaignGroup?: string | null;
    topCampaignDeliveryRows?: number;
    topCampaignReadyRows?: number;
    topCampaignAnonymized?: boolean;
  };
}

interface DeliveryMonitorReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    topCampaignGroup?: string | null;
    pendingRows?: number;
    readyPreviewRows?: number;
    failedChecks?: number;
    topCampaignAnonymized?: boolean;
    targetCampaignGroups?: string[];
  };
}

interface CheckRow {
  id: string;
  status: CheckStatus;
  summary: string;
  evidence: string[];
  missing: string[];
}

interface StackRow {
  rank: number;
  group: string;
  domain: string;
  action: string;
  gap: string;
  disposition: string;
  requiredActor: string;
  highestSeverity: string;
  score: number;
  dispositionRows: number;
  deliveryRows: number;
  readyRows: number;
  uniqueRecipients: number;
  expectedDeliveryStatus: string;
  campaignIds: string[];
  routes: string[];
  allowedChannels: string[];
  liveChannelsDisabled: string[];
  rowsWithSuppression: number;
  activeTopCampaign: boolean;
  monitoredTargetCampaign: boolean;
  monitorKind: string | null;
  monitoredPendingRows: number | null;
  stackState: string;
}

const API_ROOT = detectApiRoot();
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const LIVE_CHANNELS = ['redis_notification_feed', 'remote_push', 'email'];
const USER_SURFACES = ['in_app_readiness_surface', 'dashboard'];

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
  const values = (name: string) => {
    const found: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
      const arg = argv[index];
      if (arg.startsWith(`${name}=`)) found.push(arg.slice(name.length + 1));
      if (arg === name && argv[index + 1]) found.push(argv[index + 1]);
    }
    return found;
  };
  const optionalPath = (name: string, pattern: RegExp) => {
    const value = get(name);
    return value ? resolveInputPath(value) : findLatest(pattern);
  };
  const optionalPathList = (name: string) =>
    values(name).map((value) => resolveInputPath(value));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `profile-readiness-campaign-stack-monitor-${stamp}.json`,
      ),
    )!,
  );
  return {
    disposition: optionalPath(
      '--disposition',
      /^profile-readiness-disposition-.+\.json$/,
    ),
    adminDelivery: optionalPath(
      '--admin-delivery',
      /^profile-readiness-admin-delivery-.+\.json$/,
    ),
    consumerClosure: optionalPath(
      '--consumer-closure',
      /^profile-readiness-consumer-closure-.+\.json$/,
    ),
    deliveryMonitor: optionalPath(
      '--delivery-monitor',
      /^profile-readiness-delivery-monitor-.+\.json$/,
    ),
    targetDeliveryMonitor: optionalPathList('--target-delivery-monitor'),
    out,
    markdown: path.resolve(
      API_ROOT,
      get('--markdown', out.replace(/\.json$/i, '.md'))!,
    ),
    csv: path.resolve(API_ROOT, get('--csv', out.replace(/\.json$/i, '.csv'))!),
    limit: Number(get('--limit', '12')),
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
  const disposition = readOptionalJson<DispositionReport>(args.disposition);
  const adminDelivery = readOptionalJson<AdminDeliveryReport>(
    args.adminDelivery,
  );
  const consumerClosure = readOptionalJson<ConsumerClosureReport>(
    args.consumerClosure,
  );
  const deliveryMonitor = readOptionalJson<DeliveryMonitorReport>(
    args.deliveryMonitor,
  );
  const targetDeliveryMonitorInputs = args.targetDeliveryMonitor.map(
    (filePath) => ({
      filePath,
      report: readOptionalJson<DeliveryMonitorReport>(filePath),
    }),
  );
  const targetDeliveryMonitors = targetDeliveryMonitorInputs
    .map((input) => input.report)
    .filter((report): report is DeliveryMonitorReport => Boolean(report));
  const rows = buildRows({
    disposition,
    adminDelivery,
    consumerClosure,
    deliveryMonitor,
    targetDeliveryMonitors,
    limit: args.limit,
  });
  const checks = buildChecks({
    disposition,
    adminDelivery,
    consumerClosure,
    deliveryMonitor,
    targetDeliveryMonitors,
    rows,
  });
  const failedChecks = checks.filter((check) => check.status === 'fail');
  const status: MonitorStatus =
    failedChecks.length > 0
      ? 'BLOCKED_READINESS_CAMPAIGN_STACK_MONITOR'
      : rows.length === 0
        ? 'READINESS_CAMPAIGN_STACK_MONITOR_COMPLETE'
        : 'READINESS_CAMPAIGN_STACK_MONITOR_READY';
  const readyUserPromptRows = rows.filter(
    (row) =>
      row.disposition === 'user_prompt' &&
      row.readyRows === row.deliveryRows &&
      row.deliveryRows > 0,
  );
  const unmonitoredReadyUserPromptRows = readyUserPromptRows.filter(
    (row) => !row.activeTopCampaign && !row.monitoredTargetCampaign,
  );
  const nextParallelReadyGroup = unmonitoredReadyUserPromptRows[0] ?? null;
  const activeRow = rows.find((row) => row.activeTopCampaign) ?? null;
  const targetMonitoredRows = rows.filter((row) => row.monitoredTargetCampaign);
  const unmonitoredRows = rows.filter(
    (row) => !row.activeTopCampaign && !row.monitoredTargetCampaign,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-campaign-stack-monitor',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationAllowedByThisPlan: false,
    sourceArtifacts: {
      disposition: summarizeInput(args.disposition, disposition),
      adminDelivery: summarizeInput(args.adminDelivery, adminDelivery),
      consumerClosure: summarizeInput(args.consumerClosure, consumerClosure),
      deliveryMonitor: summarizeInput(args.deliveryMonitor, deliveryMonitor),
      targetDeliveryMonitors: targetDeliveryMonitorInputs.map((input) =>
        summarizeInput(input.filePath, input.report),
      ),
    },
    summary: {
      dispositionOpenRows: disposition?.summary?.openRows ?? 0,
      dispositionRows: disposition?.summary?.dispositionRows ?? 0,
      adminDeliveryRows: adminDelivery?.summary?.openRows ?? 0,
      trackedGroups: rows.length,
      trackedDispositionRows: sum(rows.map((row) => row.dispositionRows)),
      trackedDeliveryRows: sum(rows.map((row) => row.deliveryRows)),
      trackedReadyRows: sum(rows.map((row) => row.readyRows)),
      trackedRecipientSlots: sum(rows.map((row) => row.uniqueRecipients)),
      userPromptGroups: rows.filter((row) => row.disposition === 'user_prompt')
        .length,
      criticalGroups: rows.filter((row) => row.highestSeverity === 'critical')
        .length,
      activeTopCampaignGroup:
        consumerClosure?.summary?.topCampaignGroup ?? null,
      activeTopCampaignTracked: Boolean(activeRow),
      activeTopCampaignDeliveryRows: activeRow?.deliveryRows ?? 0,
      activeTopCampaignReadyRows: activeRow?.readyRows ?? 0,
      activeMonitorPendingRows: deliveryMonitor?.summary?.pendingRows ?? null,
      targetDeliveryMonitorCount: targetDeliveryMonitors.length,
      targetDeliveryMonitorGroups: targetDeliveryMonitors
        .map((monitor) => monitor.summary?.topCampaignGroup)
        .filter(isNonEmptyString),
      targetMonitoredGroups: rows.filter((row) => row.monitoredTargetCampaign)
        .length,
      monitoredCampaignGroups: (activeRow ? 1 : 0) + targetMonitoredRows.length,
      unmonitoredCampaignGroups: unmonitoredRows.length,
      targetMonitoredRows: sum(
        targetMonitoredRows.map((row) => row.deliveryRows),
      ),
      activeAndTargetMonitoredRows:
        (activeRow?.deliveryRows ?? 0) +
        sum(targetMonitoredRows.map((row) => row.deliveryRows)),
      readyParallelUserPromptGroups: readyUserPromptRows.filter(
        (row) => !row.activeTopCampaign,
      ).length,
      readyUnmonitoredParallelUserPromptGroups:
        unmonitoredReadyUserPromptRows.length,
      readyUnmonitoredParallelUserPromptRows: sum(
        unmonitoredReadyUserPromptRows.map((row) => row.deliveryRows),
      ),
      nextParallelReadyGroup: nextParallelReadyGroup?.group ?? null,
      nextParallelReadyRows: nextParallelReadyGroup?.deliveryRows ?? 0,
      groupsMissingDeliveryRows: rows.filter((row) => row.deliveryRows === 0)
        .length,
      groupsWithMismatchedDeliveryRows: rows.filter(
        (row) => row.deliveryRows !== row.dispositionRows,
      ).length,
      groupsWithAllRowsReady: rows.filter(
        (row) => row.readyRows === row.deliveryRows && row.deliveryRows > 0,
      ).length,
      failedChecks: failedChecks.length,
      warningChecks: checks.filter((check) => check.status === 'warn').length,
      passedChecks: checks.filter((check) => check.status === 'pass').length,
    },
    monitorContract: {
      firstPartyFactsAreUserProvided: true,
      writesFirstPartyFacts: false,
      sendsNotifications: false,
      exposesRawUserIds: false,
      approvedUserPromptSurfaces: USER_SURFACES,
      liveChannelsRemainDisabled: LIVE_CHANNELS,
      purpose:
        'Track the readiness campaign stack so active delivery and next prompt groups stay visible without inferring user facts or sending live notifications.',
    },
    nextCampaign: nextCampaign(
      status,
      failedChecks,
      activeRow,
      nextParallelReadyGroup,
    ),
    checks,
    rows,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(args.csv, renderCsv(checks, rows), 'utf8');
  printSummary(args, report);
}

function buildRows(input: {
  disposition: DispositionReport | null;
  adminDelivery: AdminDeliveryReport | null;
  consumerClosure: ConsumerClosureReport | null;
  deliveryMonitor: DeliveryMonitorReport | null;
  targetDeliveryMonitors: DeliveryMonitorReport[];
  limit: number;
}) {
  const groups = (input.disposition?.summary?.topDispositionGroups ?? []).slice(
    0,
    Math.max(1, input.limit),
  );
  const deliveryRows = input.adminDelivery?.rows ?? [];
  const activeTopCampaign = input.consumerClosure?.summary?.topCampaignGroup;
  const deliveryMonitorTopCampaign =
    input.deliveryMonitor?.summary?.topCampaignGroup;
  const targetMonitorByGroup = new Map(
    input.targetDeliveryMonitors
      .map((monitor) => [monitor.summary?.topCampaignGroup, monitor] as const)
      .filter((entry): entry is readonly [string, DeliveryMonitorReport] =>
        isNonEmptyString(entry[0]),
      ),
  );
  return groups.map((group, index): StackRow => {
    const parsed = parseGroup(group.key);
    const rows = deliveryRows.filter((row) => rowMatchesGroup(row, parsed));
    const expectedStatus = expectedStatusFor(group);
    const readyRows = rows.filter((row) => row.status === expectedStatus);
    const isActiveTopCampaign = group.key === activeTopCampaign;
    const targetMonitor = targetMonitorByGroup.get(group.key) ?? null;
    const isTargetMonitored = Boolean(targetMonitor);
    const monitoredPendingRows =
      isActiveTopCampaign && group.key === deliveryMonitorTopCampaign
        ? (input.deliveryMonitor?.summary?.pendingRows ?? null)
        : isTargetMonitored
          ? (targetMonitor?.summary?.pendingRows ?? null)
          : null;
    return {
      rank: index + 1,
      group: group.key,
      domain: parsed.domain,
      action: parsed.action,
      gap: parsed.gap,
      disposition: group.disposition,
      requiredActor: group.requiredActor,
      highestSeverity: group.highestSeverity,
      score: group.score,
      dispositionRows: group.count,
      deliveryRows: rows.length,
      readyRows: readyRows.length,
      uniqueRecipients: unique(
        rows.map((row) => row.recipientKey).filter(isNonEmptyString),
      ).length,
      expectedDeliveryStatus: expectedStatus,
      campaignIds: unique(
        rows.map((row) => row.campaignId).filter(isNonEmptyString),
      ).sort(),
      routes: unique(rows.map((row) => row.route).filter(isNonEmptyString))
        .sort()
        .slice(0, 5),
      allowedChannels: unique(
        rows.flatMap((row) => row.allowedChannels ?? []),
      ).sort(),
      liveChannelsDisabled: unique(
        rows.flatMap((row) => row.liveChannelsDisabled ?? []),
      ).sort(),
      rowsWithSuppression: rows.filter(
        (row) => (row.suppressWhen ?? []).length > 0,
      ).length,
      activeTopCampaign: isActiveTopCampaign,
      monitoredTargetCampaign: isTargetMonitored,
      monitorKind:
        isActiveTopCampaign && group.key === deliveryMonitorTopCampaign
          ? 'active_delivery_monitor'
          : isTargetMonitored
            ? 'target_delivery_monitor'
            : null,
      monitoredPendingRows,
      stackState: stackStateFor({
        group,
        rows,
        readyRows,
        isActiveTopCampaign,
        isTargetMonitored,
        monitoredPendingRows,
      }),
    };
  });
}

function buildChecks(input: {
  disposition: DispositionReport | null;
  adminDelivery: AdminDeliveryReport | null;
  consumerClosure: ConsumerClosureReport | null;
  deliveryMonitor: DeliveryMonitorReport | null;
  targetDeliveryMonitors: DeliveryMonitorReport[];
  rows: StackRow[];
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
    'disposition_stack_ready',
    Boolean(input.disposition) &&
      input.disposition?.status === 'READINESS_DISPOSITION_PACKET_READY' &&
      input.disposition?.summary?.allOpenRowsHaveDisposition === true &&
      (input.disposition?.summary?.blockedRows ?? 0) === 0,
    'Campaign stack requires a ready disposition packet with every open row mapped.',
    [
      `status=${input.disposition?.status ?? 'missing'}`,
      `blockedRows=${input.disposition?.summary?.blockedRows ?? 'missing'}`,
      `allOpenRowsHaveDisposition=${String(input.disposition?.summary?.allOpenRowsHaveDisposition)}`,
    ],
    input.disposition ? [] : ['--disposition'],
  );
  add(
    'top_groups_present',
    input.rows.length > 0,
    'Disposition packet should expose ranked campaign groups to monitor.',
    [`trackedGroups=${input.rows.length}`],
    input.rows.length > 0 ? [] : ['summary.topDispositionGroups'],
  );
  add(
    'admin_delivery_anonymized',
    Boolean(input.adminDelivery) &&
      input.adminDelivery?.privacy?.includesUserIds === false,
    'Campaign stack monitor must use anonymized delivery rows by default.',
    [
      `statusRows=${input.adminDelivery?.summary?.openRows ?? 'missing'}`,
      `includesUserIds=${String(input.adminDelivery?.privacy?.includesUserIds)}`,
    ],
    input.adminDelivery ? [] : ['--admin-delivery'],
  );
  add(
    'stack_group_delivery_alignment',
    input.rows.every((row) => row.deliveryRows === row.dispositionRows),
    'Every tracked campaign group should align one-for-one with admin delivery rows.',
    [
      `mismatchedGroups=${input.rows.filter((row) => row.deliveryRows !== row.dispositionRows).length}`,
    ],
    input.rows.every((row) => row.deliveryRows === row.dispositionRows)
      ? []
      : ['regenerate disposition/admin-delivery together'],
  );
  add(
    'stack_rows_ready',
    input.rows.every(
      (row) => row.deliveryRows > 0 && row.readyRows === row.deliveryRows,
    ),
    'Every tracked campaign group should have rows ready for its actor-specific queue.',
    [
      `readyGroups=${input.rows.filter((row) => row.deliveryRows > 0 && row.readyRows === row.deliveryRows).length}`,
      `trackedGroups=${input.rows.length}`,
    ],
  );
  add(
    'user_prompt_live_channels_disabled',
    input.rows
      .filter((row) => row.disposition === 'user_prompt')
      .every((row) =>
        LIVE_CHANNELS.every((channel) =>
          row.liveChannelsDisabled.includes(channel),
        ),
      ),
    'User-prompt campaign groups must keep Redis, push, and email disabled.',
    [`disabledChannels=${LIVE_CHANNELS.join(',')}`],
  );
  add(
    'user_prompt_suppression_rules_present',
    input.rows
      .filter((row) => row.disposition === 'user_prompt')
      .every((row) => row.rowsWithSuppression === row.deliveryRows),
    'User-prompt campaign groups need suppression rules before display.',
    [
      `groupsWithoutFullSuppression=${input.rows.filter((row) => row.disposition === 'user_prompt' && row.rowsWithSuppression !== row.deliveryRows).length}`,
    ],
  );
  const activeGroup = input.consumerClosure?.summary?.topCampaignGroup;
  const activeRow = input.rows.find((row) => row.group === activeGroup);
  add(
    'active_top_campaign_monitor_aligned',
    Boolean(activeRow) &&
      input.deliveryMonitor?.summary?.topCampaignGroup === activeGroup &&
      input.deliveryMonitor?.summary?.pendingRows === activeRow?.deliveryRows &&
      (input.deliveryMonitor?.summary?.failedChecks ?? 0) === 0,
    'The active top campaign should be covered by the delivery monitor before parallel groups are considered.',
    [
      `consumerTopCampaign=${activeGroup ?? 'missing'}`,
      `deliveryMonitorTopCampaign=${input.deliveryMonitor?.summary?.topCampaignGroup ?? 'missing'}`,
      `pendingRows=${input.deliveryMonitor?.summary?.pendingRows ?? 'missing'}`,
      `activeDeliveryRows=${activeRow?.deliveryRows ?? 'missing'}`,
    ],
    activeRow ? [] : ['top campaign group row'],
  );
  if (input.targetDeliveryMonitors.length > 0) {
    const failedTargetMonitors = input.targetDeliveryMonitors.filter(
      (monitor) =>
        ![
          'READINESS_DELIVERY_MONITOR_ACTIVE',
          'READINESS_DELIVERY_MONITOR_COMPLETE',
        ].includes(monitor.status ?? '') ||
        (monitor.summary?.failedChecks ?? 0) > 0 ||
        monitor.summary?.topCampaignAnonymized !== true,
    );
    add(
      'target_delivery_monitors_aligned',
      failedTargetMonitors.length === 0,
      'Targeted readiness delivery monitors should be anonymized, active or complete, and check-clean before their groups are skipped.',
      [
        `targetMonitorCount=${input.targetDeliveryMonitors.length}`,
        `targetMonitorGroups=${input.targetDeliveryMonitors
          .map((monitor) => monitor.summary?.topCampaignGroup ?? 'unknown')
          .join(';')}`,
        `failedTargetMonitors=${failedTargetMonitors.length}`,
      ],
      failedTargetMonitors.length === 0
        ? []
        : ['fix target delivery monitor failures'],
    );
  }
  return checks;
}

function nextCampaign(
  status: MonitorStatus,
  failedChecks: CheckRow[],
  activeRow: StackRow | null,
  nextParallelReadyGroup: StackRow | null,
) {
  if (status === 'BLOCKED_READINESS_CAMPAIGN_STACK_MONITOR') {
    return {
      id: 'profile_readiness_campaign_stack_monitor_fix',
      reason: `${failedChecks.length} campaign stack checks failed; fix ${failedChecks[0]?.id ?? 'unknown'} first.`,
      firstFailedCheck: failedChecks[0]?.id ?? null,
    };
  }
  if (status === 'READINESS_CAMPAIGN_STACK_MONITOR_COMPLETE') {
    return {
      id: 'profile_readiness_regenerate_worklist',
      reason:
        'No ranked readiness groups remain in the monitored stack; regenerate the worklist to verify closure.',
    };
  }
  if (nextParallelReadyGroup) {
    return {
      id: 'profile_readiness_parallel_user_prompt_preflight',
      reason: `${nextParallelReadyGroup.deliveryRows} anonymized in-app/dashboard rows are ready for ${nextParallelReadyGroup.group} while ${activeRow?.group ?? 'the active campaign'} remains monitored.`,
      group: nextParallelReadyGroup.group,
      activeGroup: activeRow?.group ?? null,
      recommendedAction:
        'keep active monitor running and preflight the next critical user-prompt campaign in-app/dashboard only',
    };
  }
  return {
    id: 'profile_readiness_active_campaign_monitor',
    reason: `${activeRow?.deliveryRows ?? 0} rows remain under the active readiness monitor.`,
    group: activeRow?.group ?? null,
    recommendedAction:
      'monitor completion and regenerate the readiness worklist',
  };
}

function parseGroup(group: string) {
  const [domain, action, ...gapParts] = group.split(':');
  return {
    domain: domain ?? '',
    action: action ?? '',
    gap: gapParts.join(':'),
  };
}

function rowMatchesGroup(
  row: { domain?: string; action?: string; gap?: string },
  group: { domain: string; action: string; gap: string },
) {
  return (
    row.domain === group.domain &&
    row.action === group.action &&
    row.gap === group.gap
  );
}

function expectedStatusFor(group: TopDispositionGroup) {
  if (group.disposition === 'user_prompt')
    return 'ready_for_in_app_admin_delivery';
  if (group.requiredActor === 'system') return 'ready_for_system_generation';
  if (group.requiredActor === 'operator') return 'ready_for_operator_review';
  return 'ready';
}

function stackStateFor(input: {
  group: TopDispositionGroup;
  rows: DeliveryRow[];
  readyRows: DeliveryRow[];
  isActiveTopCampaign: boolean;
  isTargetMonitored: boolean;
  monitoredPendingRows: number | null;
}) {
  if (input.rows.length === 0) return 'missing_delivery_rows';
  if (input.readyRows.length !== input.rows.length) return 'delivery_not_ready';
  if (input.isActiveTopCampaign && input.monitoredPendingRows !== null) {
    return 'active_campaign_monitored';
  }
  if (input.isTargetMonitored && input.monitoredPendingRows !== null) {
    return 'target_campaign_monitored';
  }
  if (input.group.disposition === 'user_prompt') {
    return 'ready_parallel_in_app_dashboard_preflight';
  }
  if (input.group.requiredActor === 'system')
    return 'ready_system_generation_queue';
  if (input.group.requiredActor === 'operator')
    return 'ready_operator_review_queue';
  return 'ready_for_review';
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

function sum(items: number[]) {
  return items.reduce((total, item) => total + item, 0);
}

function renderMarkdown(report: Record<string, any>) {
  const rows = Array.isArray(report.rows) ? report.rows : [];
  return [
    '# Profile Readiness Campaign Stack Monitor',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Tracked groups: ${report.summary.trackedGroups}`,
    `- Tracked disposition rows: ${report.summary.trackedDispositionRows}`,
    `- Tracked ready rows: ${report.summary.trackedReadyRows}`,
    `- Active top campaign: ${report.summary.activeTopCampaignGroup ?? 'none'}`,
    `- Active monitor pending rows: ${report.summary.activeMonitorPendingRows ?? 'n/a'}`,
    `- Target delivery monitor groups: ${(report.summary.targetDeliveryMonitorGroups ?? []).join(', ') || 'none'}`,
    `- Monitored campaign groups: ${report.summary.monitoredCampaignGroups}`,
    `- Unmonitored campaign groups: ${report.summary.unmonitoredCampaignGroups}`,
    `- Ready parallel user-prompt groups: ${report.summary.readyParallelUserPromptGroups}`,
    `- Ready unmonitored parallel user-prompt groups: ${report.summary.readyUnmonitoredParallelUserPromptGroups}`,
    `- Ready unmonitored parallel user-prompt rows: ${report.summary.readyUnmonitoredParallelUserPromptRows}`,
    `- Next parallel ready group: ${report.summary.nextParallelReadyGroup ?? 'none'}`,
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
    '## Campaign Stack',
    '',
    '| Rank | Group | Rows | Ready | Severity | State |',
    '| ---: | --- | ---: | ---: | --- | --- |',
    ...(rows.length
      ? rows.map(
          (row: StackRow) =>
            `| ${row.rank} | ${escapeMarkdown(row.group)} | ${row.deliveryRows} | ${row.readyRows} | ${escapeMarkdown(row.highestSeverity)} | ${escapeMarkdown(row.stackState)} |`,
        )
      : ['| 0 | none | 0 | 0 | none | n/a |']),
    '',
  ].join('\n');
}

function renderCsv(checks: CheckRow[], rows: StackRow[]) {
  const header = [
    'rowKind',
    'id',
    'status',
    'summary',
    'missing',
    'rank',
    'group',
    'disposition',
    'requiredActor',
    'highestSeverity',
    'score',
    'dispositionRows',
    'deliveryRows',
    'readyRows',
    'uniqueRecipients',
    'expectedDeliveryStatus',
    'allowedChannels',
    'liveChannelsDisabled',
    'activeTopCampaign',
    'monitoredTargetCampaign',
    'monitorKind',
    'monitoredPendingRows',
    'stackState',
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
      '',
      '',
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
  const stackRows = rows.map((row) =>
    [
      'campaign_group',
      '',
      row.readyRows === row.deliveryRows ? 'ready' : 'review',
      row.stackState,
      '',
      row.rank,
      row.group,
      row.disposition,
      row.requiredActor,
      row.highestSeverity,
      row.score,
      row.dispositionRows,
      row.deliveryRows,
      row.readyRows,
      row.uniqueRecipients,
      row.expectedDeliveryStatus,
      row.allowedChannels.join('; '),
      row.liveChannelsDisabled.join('; '),
      row.activeTopCampaign ? 'true' : 'false',
      row.monitoredTargetCampaign ? 'true' : 'false',
      row.monitorKind ?? '',
      row.monitoredPendingRows ?? '',
      row.stackState,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...checkRows, ...stackRows].join('\n')}\n`;
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
        trackedGroups: report.summary.trackedGroups,
        activeTopCampaignGroup: report.summary.activeTopCampaignGroup,
        readyParallelUserPromptGroups:
          report.summary.readyParallelUserPromptGroups,
        monitoredCampaignGroups: report.summary.monitoredCampaignGroups,
        unmonitoredCampaignGroups: report.summary.unmonitoredCampaignGroups,
        readyUnmonitoredParallelUserPromptRows:
          report.summary.readyUnmonitoredParallelUserPromptRows,
        nextParallelReadyGroup: report.summary.nextParallelReadyGroup,
        failedChecks: report.summary.failedChecks,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
