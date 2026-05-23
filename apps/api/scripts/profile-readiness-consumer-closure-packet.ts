#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type PacketStatus =
  | 'READINESS_CONSUMER_CLOSURE_READY'
  | 'READINESS_CONSUMER_CLOSURE_REVIEW'
  | 'BLOCKED_READINESS_CONSUMER_CLOSURE';
type CheckStatus = 'pass' | 'warn' | 'fail';

interface Args {
  disposition: string | null;
  adminDelivery: string | null;
  dispatch: string | null;
  liveGate: string | null;
  policy: string;
  out: string;
  markdown: string;
  csv: string;
}

interface CheckRow {
  id: string;
  status: CheckStatus;
  summary: string;
  evidence: string[];
  missing: string[];
}

interface DispositionReport {
  generatedAt?: string;
  status?: string;
  nextCampaign?: {
    id?: string;
    group?: string;
    highestSeverity?: string;
    score?: number;
  };
  summary?: {
    openRows?: number;
    dispositionRows?: number;
    blockedRows?: number;
    allOpenRowsHaveDisposition?: boolean;
  };
  rows?: Array<{
    gap?: string;
    disposition?: string;
    requiredActor?: string;
    severity?: string;
  }>;
}

interface AdminDeliveryReport {
  generatedAt?: string;
  privacy?: { includesUserIds?: boolean };
  summary?: {
    openRows?: number;
    byStatus?: Record<string, number>;
    byQueue?: Record<string, number>;
  };
  rows?: Array<{
    recipientKey?: string;
    campaignId?: string;
    domain?: string;
    action?: string;
    gap?: string;
    queue?: string;
    status?: string;
    severity?: string;
    route?: string;
    title?: string;
    content?: string;
    cta?: string;
    allowedChannels?: string[];
    liveChannelsDisabled?: string[];
    frequencyDedupeKey?: string;
    suppressWhen?: string[];
  }>;
}

interface DispatchReport {
  generatedAt?: string;
  summary?: {
    dispatchBatches?: number;
    blockedBatches?: number;
    inAppSurfaceReadyBatches?: number;
    liveNotificationBlockedBatches?: number;
  };
  batches?: Array<{
    gap?: string;
    status?: string;
    channels?: string[];
  }>;
}

interface LiveGateReport {
  generatedAt?: string;
  status?: string;
  summary?: {
    blockers?: string[];
    blockedChannels?: string[];
    includesUserIds?: boolean;
  };
}

interface DeliveryPolicy {
  status?: string;
  policyVersion?: string;
  copy?: Record<string, { title?: string; content?: string; cta?: string }>;
}

interface TopCampaignDeliveryRow {
  recipientKey: string;
  campaignId: string;
  domain: string;
  action: string;
  gap: string;
  severity: string;
  status: string;
  route: string;
  title: string | null;
  content: string | null;
  cta: string | null;
  allowedChannels: string[];
  liveChannelsDisabled: string[];
  frequencyDedupeKey: string | null;
  suppressWhen: string[];
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const REVIEW_ONLY_LIVE_BLOCKERS = new Set([
  'channel_disabled_by_policy',
  'recipient_user_ids_redacted',
]);

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
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        REPORT_ROOT,
        `profile-readiness-consumer-closure-${stamp}.json`,
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
    dispatch: optionalPath(
      '--dispatch',
      /^profile-readiness-dispatch-.+\.json$/,
    ),
    liveGate: optionalPath(
      '--live-gate',
      /^profile-readiness-live-delivery-gate-.+\.json$/,
    ),
    policy: resolveInputPath(
      get(
        '--policy',
        path.join(
          API_ROOT,
          'scripts',
          'data',
          'profile-readiness-delivery-policy.json',
        ),
      )!,
    ),
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
    path.resolve(REPO_ROOT, value),
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
  const dispatch = readOptionalJson<DispatchReport>(args.dispatch);
  const liveGate = readOptionalJson<LiveGateReport>(args.liveGate);
  const policy = readOptionalJson<DeliveryPolicy>(args.policy);

  const userPromptRows = (disposition?.rows ?? []).filter(
    (row) => row.disposition === 'user_prompt' && row.requiredActor === 'user',
  );
  const userPromptGaps = unique(
    userPromptRows.map((row) => row.gap).filter(isNonEmptyString),
  ).sort();
  const schoolListRows = (adminDelivery?.rows ?? []).filter(
    (row) => row.gap === 'school_list.add_first',
  );
  const topCampaignDeliveryRows = buildTopCampaignDeliveryRows(
    disposition,
    adminDelivery,
  );
  const checks = buildChecks({
    args,
    disposition,
    adminDelivery,
    dispatch,
    liveGate,
    policy,
    userPromptGaps,
    schoolListRows,
    topCampaignDeliveryRows,
  });
  const failedChecks = checks.filter((check) => check.status === 'fail');
  const warnChecks = checks.filter((check) => check.status === 'warn');
  const status: PacketStatus =
    failedChecks.length > 0
      ? 'BLOCKED_READINESS_CONSUMER_CLOSURE'
      : warnChecks.length > 0
        ? 'READINESS_CONSUMER_CLOSURE_REVIEW'
        : 'READINESS_CONSUMER_CLOSURE_READY';

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-consumer-closure',
    status,
    destructiveDbWriteAllowedByThisPlan: false,
    notificationSendAllowedByThisPlan: false,
    sourceArtifacts: {
      disposition: summarizeInput(args.disposition, disposition),
      adminDelivery: summarizeInput(args.adminDelivery, adminDelivery),
      dispatch: summarizeInput(args.dispatch, dispatch),
      liveGate: summarizeInput(args.liveGate, liveGate),
      policy: summarizeInput(args.policy, policy),
    },
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.filter((check) => check.status === 'pass').length,
      warningChecks: warnChecks.length,
      failedChecks: failedChecks.length,
      userPromptGaps: userPromptGaps.length,
      missingCopyGaps: missingPolicyCopyGaps(policy, userPromptGaps),
      schoolListAddFirstRows: schoolListRows.length,
      schoolListAddFirstReadyRows: schoolListRows.filter(
        (row) => row.status === 'ready_for_in_app_admin_delivery',
      ).length,
      schoolListAddFirstRouteRows: schoolListRows.filter(
        (row) => row.route === '/schools',
      ).length,
      topCampaignGroup: disposition?.nextCampaign?.group ?? null,
      topCampaignDeliveryRows: topCampaignDeliveryRows.length,
      topCampaignReadyRows: topCampaignDeliveryRows.filter(
        (row) => row.status === 'ready_for_in_app_admin_delivery',
      ).length,
      topCampaignAnonymized:
        Boolean(adminDelivery) &&
        adminDelivery?.privacy?.includesUserIds === false,
      topCampaignAllowedChannels: unique(
        topCampaignDeliveryRows.flatMap((row) => row.allowedChannels),
      ).sort(),
      topCampaignLiveChannelsDisabled: unique(
        topCampaignDeliveryRows.flatMap((row) => row.liveChannelsDisabled),
      ).sort(),
      topCampaignStatusCounts: countBy(
        topCampaignDeliveryRows,
        (row) => row.status,
      ),
      topDispositionCampaign: disposition?.nextCampaign ?? null,
      liveGateStatus: liveGate?.status ?? null,
      liveGateBlockers: liveGate?.summary?.blockers ?? [],
    },
    topCampaignDeliveryContract: {
      defaultReportsStayAnonymized: true,
      rawUserIdsIncluded: adminDelivery?.privacy?.includesUserIds === true,
      writesFirstPartyFacts: false,
      sendsNotifications: false,
      approvedDeliverySurfaces: ['in_app_readiness_surface', 'dashboard'],
      liveChannelsRemainDisabledUntilPolicyApproval: [
        'redis_notification_feed',
        'remote_push',
        'email',
      ],
      suppressBeforeDisplay: [
        're-check row suppressWhen conditions',
        'respect per-user per-campaign frequency cap',
        'hide row if user already completed the first-party field',
      ],
    },
    topCampaignDeliveryRows,
    consumerContract: {
      firstPartyFactsAreUserCollected: true,
      defaultReportsStayAnonymized: true,
      liveNotificationsRemainPolicyGated: true,
      checkedSurfaces: [
        'GET /profiles/me/readiness',
        'profile readiness shared route',
        'profile action bar nextActions rendering',
        '/schools frontend route',
        'admin delivery package copy/route/channel/suppression',
        'dispatch dry-run in-app surface batches',
      ],
    },
    nextCampaign: buildNextCampaign(
      status,
      failedChecks,
      warnChecks,
      disposition,
    ),
    checks,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(args.markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(
    args.csv,
    renderCsv(checks, topCampaignDeliveryRows),
    'utf8',
  );
  printSummary(args, report);
}

function buildChecks(args: {
  args: Args;
  disposition: DispositionReport | null;
  adminDelivery: AdminDeliveryReport | null;
  dispatch: DispatchReport | null;
  liveGate: LiveGateReport | null;
  policy: DeliveryPolicy | null;
  userPromptGaps: string[];
  schoolListRows: AdminDeliveryReport['rows'];
  topCampaignDeliveryRows: TopCampaignDeliveryRow[];
}) {
  const checks: CheckRow[] = [];
  const add = (
    id: string,
    ok: boolean,
    summary: string,
    evidence: string[],
    missing: string[] = [],
    warn = false,
  ) => {
    checks.push({
      id,
      status: ok ? (warn ? 'warn' : 'pass') : 'fail',
      summary,
      evidence,
      missing,
    });
  };

  add(
    'disposition_packet_ready',
    Boolean(
      args.disposition &&
      args.disposition.status === 'READINESS_DISPOSITION_PACKET_READY' &&
      args.disposition.summary?.allOpenRowsHaveDisposition === true &&
      Number(args.disposition.summary?.blockedRows ?? 0) === 0,
    ),
    'Every open first-party readiness row must have a user/operator/system disposition.',
    [args.args.disposition ?? 'missing'],
    args.disposition ? [] : ['--disposition'],
  );

  add(
    'top_campaign_school_list_add_first',
    args.disposition?.nextCampaign?.group ===
      'school_list:prompt-user:school_list.add_first',
    'The highest-priority user prompt campaign should be school_list.add_first.',
    [
      `group=${args.disposition?.nextCampaign?.group ?? 'none'}`,
      `severity=${args.disposition?.nextCampaign?.highestSeverity ?? 'none'}`,
    ],
    ['school_list:prompt-user:school_list.add_first'].filter(
      (expected) => args.disposition?.nextCampaign?.group !== expected,
    ),
  );

  const missingCopy = missingPolicyCopyGaps(args.policy, args.userPromptGaps);
  add(
    'policy_copy_covers_user_prompt_gaps',
    Boolean(args.policy && missingCopy.length === 0),
    'Every user-prompt gap needs approved in-app/dashboard copy before delivery packages are considered consumable.',
    [`copyGaps=${args.userPromptGaps.length}`],
    missingCopy,
  );

  const adminBlockedRows =
    Number(args.adminDelivery?.summary?.byStatus?.blocked_missing_copy ?? 0) ||
    (args.adminDelivery?.rows ?? []).filter(
      (row) => row.status === 'blocked_missing_copy',
    ).length;
  add(
    'admin_delivery_ready_and_anonymized',
    Boolean(
      args.adminDelivery &&
      adminBlockedRows === 0 &&
      args.adminDelivery.privacy?.includesUserIds === false,
    ),
    'Admin delivery must be privacy-safe and have zero blocked copy rows.',
    [
      `blockedRows=${adminBlockedRows}`,
      `includesUserIds=${String(args.adminDelivery?.privacy?.includesUserIds)}`,
    ],
  );

  const schoolRows = args.schoolListRows ?? [];
  add(
    'school_list_add_first_delivery_rows_ready',
    schoolRows.length > 0 &&
      schoolRows.every(
        (row) =>
          row.status === 'ready_for_in_app_admin_delivery' &&
          row.route === '/schools' &&
          (row.allowedChannels ?? []).includes('in_app_readiness_surface') &&
          (row.allowedChannels ?? []).includes('dashboard') &&
          (row.suppressWhen ?? []).length > 0,
      ),
    'school_list.add_first rows must route to /schools, stay in in-app/dashboard surfaces, and include suppression rules.',
    [
      `rows=${schoolRows.length}`,
      `ready=${schoolRows.filter((row) => row.status === 'ready_for_in_app_admin_delivery').length}`,
      `route=/schools=${schoolRows.filter((row) => row.route === '/schools').length}`,
    ],
  );

  const topRows = args.topCampaignDeliveryRows;
  add(
    'top_campaign_delivery_preflight_rows_ready',
    topRows.length > 0 &&
      args.adminDelivery?.privacy?.includesUserIds === false &&
      topRows.every(
        (row) =>
          row.status === 'ready_for_in_app_admin_delivery' &&
          row.allowedChannels.includes('in_app_readiness_surface') &&
          row.allowedChannels.includes('dashboard') &&
          row.liveChannelsDisabled.includes('redis_notification_feed') &&
          row.liveChannelsDisabled.includes('remote_push') &&
          row.liveChannelsDisabled.includes('email') &&
          row.suppressWhen.length > 0,
      ),
    'The top disposition campaign must have anonymized, ready, non-live delivery rows with suppression rules.',
    [
      `rows=${topRows.length}`,
      `ready=${topRows.filter((row) => row.status === 'ready_for_in_app_admin_delivery').length}`,
      `includesUserIds=${String(args.adminDelivery?.privacy?.includesUserIds)}`,
    ],
  );

  add(
    'dispatch_in_app_surface_ready',
    Boolean(
      args.dispatch &&
      Number(args.dispatch.summary?.blockedBatches ?? 0) === 0 &&
      Number(args.dispatch.summary?.inAppSurfaceReadyBatches ?? 0) > 0,
    ),
    'Dispatch dry-run must have unblocked in-app/dashboard readiness batches before consumer closure can be claimed.',
    [
      `dispatchBatches=${args.dispatch?.summary?.dispatchBatches ?? 0}`,
      `blockedBatches=${args.dispatch?.summary?.blockedBatches ?? 0}`,
      `inAppSurfaceReadyBatches=${args.dispatch?.summary?.inAppSurfaceReadyBatches ?? 0}`,
    ],
  );

  const liveBlockers = args.liveGate?.summary?.blockers ?? [];
  const liveOnlyReview =
    liveBlockers.length > 0 &&
    liveBlockers.every((blocker) => REVIEW_ONLY_LIVE_BLOCKERS.has(blocker));
  if (args.liveGate) {
    add(
      'live_delivery_policy_gate_review_only',
      liveBlockers.length === 0 || liveOnlyReview,
      'Live Redis/push/email blockers may remain review-only when in-app/admin delivery is the approved surface.',
      [`status=${args.liveGate.status ?? 'unknown'}`, ...liveBlockers],
      liveBlockers.filter((blocker) => !REVIEW_ONLY_LIVE_BLOCKERS.has(blocker)),
      liveOnlyReview,
    );
  }

  addStaticCodeChecks(checks);
  return checks;
}

function addStaticCodeChecks(checks: CheckRow[]) {
  const profileService = safeRead(
    path.join(
      API_ROOT,
      'src',
      'modules',
      'profile',
      'profile-readiness.service.ts',
    ),
  );
  const profileController = safeRead(
    path.join(API_ROOT, 'src', 'modules', 'profile', 'profile.controller.ts'),
  );
  const routes = safeRead(
    path.join(
      REPO_ROOT,
      'packages',
      'shared',
      'src',
      'constants',
      'api-routes.ts',
    ),
  );
  const profileHeader = safeRead(
    path.join(
      REPO_ROOT,
      'apps',
      'web',
      'src',
      'app',
      '[locale]',
      '(main)',
      'profile',
      '_components',
      'profile-header.tsx',
    ),
  );
  const schoolsRoute = path.join(
    REPO_ROOT,
    'apps',
    'web',
    'src',
    'app',
    '[locale]',
    '(main)',
    'schools',
  );
  const enMessages = readOptionalJson<Record<string, unknown>>(
    path.join(REPO_ROOT, 'apps', 'web', 'src', 'messages', 'en.json'),
  );
  const zhMessages = readOptionalJson<Record<string, unknown>>(
    path.join(REPO_ROOT, 'apps', 'web', 'src', 'messages', 'zh.json'),
  );
  const staticChecks: CheckRow[] = [
    {
      id: 'profile_readiness_api_endpoint',
      status:
        profileController.includes("Get('me/readiness')") &&
        routes.includes('readiness: ()')
          ? 'pass'
          : 'fail',
      summary:
        'The user-facing readiness endpoint and shared route must exist.',
      evidence: [
        'ProfileController Get(me/readiness)',
        'profileRoutes.readiness',
      ],
      missing: [],
    },
    {
      id: 'profile_service_emits_school_list_add_first',
      status:
        profileService.includes('school_list.add_first') &&
        profileService.includes(
          "href: args.schoolList.count === 0 ? '/schools'",
        )
          ? 'pass'
          : 'fail',
      summary:
        'ProfileReadinessService must emit school_list.add_first and route it to /schools.',
      evidence: ['profile-readiness.service.ts'],
      missing: [],
    },
    {
      id: 'frontend_profile_consumes_readiness_actions',
      status:
        profileHeader.includes('overallReadiness?.nextActions') &&
        profileHeader.includes('<Link href={action.href}')
          ? 'pass'
          : 'fail',
      summary:
        'The profile first fold must render readiness nextActions as clickable UI.',
      evidence: ['profile-header.tsx'],
      missing: [],
    },
    {
      id: 'frontend_schools_route_exists',
      status: fs.existsSync(schoolsRoute) ? 'pass' : 'fail',
      summary: 'The /schools route must exist for school_list.add_first.',
      evidence: [path.relative(REPO_ROOT, schoolsRoute)],
      missing: fs.existsSync(schoolsRoute) ? [] : ['apps/web /schools route'],
    },
    {
      id: 'frontend_action_labels_localized',
      status:
        getJsonPath(enMessages, [
          'profile',
          'readiness',
          'action',
          'addSchools',
        ]) &&
        getJsonPath(zhMessages, [
          'profile',
          'readiness',
          'action',
          'addSchools',
        ])
          ? 'pass'
          : 'fail',
      summary:
        'The Add Schools readiness action must be localized in English and Chinese.',
      evidence: [
        'apps/web/src/messages/en.json',
        'apps/web/src/messages/zh.json',
      ],
      missing: [
        !getJsonPath(enMessages, [
          'profile',
          'readiness',
          'action',
          'addSchools',
        ])
          ? 'en profile.readiness.action.addSchools'
          : '',
        !getJsonPath(zhMessages, [
          'profile',
          'readiness',
          'action',
          'addSchools',
        ])
          ? 'zh profile.readiness.action.addSchools'
          : '',
      ].filter(Boolean),
    },
  ];
  checks.push(...staticChecks);
}

function missingPolicyCopyGaps(policy: DeliveryPolicy | null, gaps: string[]) {
  return gaps.filter((gap) => {
    const copy = policy?.copy?.[gap];
    return !copy?.title || !copy.content || !copy.cta;
  });
}

function buildNextCampaign(
  status: PacketStatus,
  failed: CheckRow[],
  warnings: CheckRow[],
  disposition: DispositionReport | null,
) {
  if (failed.length > 0) {
    return {
      id: 'profile_readiness_consumer_closure_fix',
      reason: `${failed.length} consumer closure checks failed; fix ${failed[0].id} first.`,
      firstFailedCheck: failed[0].id,
    };
  }
  if (warnings.length > 0) {
    const reviewOnlyWarnings = warnings.every(isReviewOnlyWarning);
    if (reviewOnlyWarnings) {
      return {
        id: 'profile_readiness_user_prompt_delivery_school_list_add_first',
        reason:
          'In-app/dashboard readiness consumer closure is ready; live Redis/push/email remains policy-gated, so continue with school_list.add_first user-prompt delivery or monitor completion.',
        reviewOnlyWarnings: warnings.map((warning) => warning.id),
        topDispositionCampaign: disposition?.nextCampaign ?? null,
      };
    }
    return {
      id: 'profile_readiness_live_delivery_policy_review',
      reason:
        'In-app/dashboard readiness consumer closure is ready; live Redis/push/email delivery remains policy-gated review work.',
      firstWarningCheck: warnings[0].id,
    };
  }
  return {
    id: 'profile_readiness_user_prompt_delivery_school_list_add_first',
    reason:
      'Consumer closure is ready for the top first-party readiness campaign; continue with school_list.add_first user-prompt delivery or monitor completion.',
    topDispositionCampaign: disposition?.nextCampaign ?? null,
  };
}

function isReviewOnlyWarning(check: CheckRow) {
  return check.id === 'live_delivery_policy_gate_review_only';
}

function buildTopCampaignDeliveryRows(
  disposition: DispositionReport | null,
  adminDelivery: AdminDeliveryReport | null,
): TopCampaignDeliveryRow[] {
  const group = parseDispositionGroup(disposition?.nextCampaign?.group);
  if (!group) return [];
  return (adminDelivery?.rows ?? [])
    .filter(
      (row) =>
        row.domain === group.domain &&
        row.action === group.action &&
        row.gap === group.gap,
    )
    .map((row) => ({
      recipientKey: row.recipientKey ?? '',
      campaignId: row.campaignId ?? '',
      domain: row.domain ?? group.domain,
      action: row.action ?? group.action,
      gap: row.gap ?? group.gap,
      severity: row.severity ?? 'unknown',
      status: row.status ?? 'unknown',
      route: row.route ?? '',
      title: row.title ?? null,
      content: row.content ?? null,
      cta: row.cta ?? null,
      allowedChannels: row.allowedChannels ?? [],
      liveChannelsDisabled: row.liveChannelsDisabled ?? [],
      frequencyDedupeKey: row.frequencyDedupeKey ?? null,
      suppressWhen: row.suppressWhen ?? [],
    }))
    .sort(
      (a, b) =>
        a.status.localeCompare(b.status) ||
        a.recipientKey.localeCompare(b.recipientKey),
    );
}

function parseDispositionGroup(group: string | undefined) {
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

function readOptionalJson<T>(filePath: string | null) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function safeRead(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function getJsonPath(
  root: Record<string, unknown> | null,
  pathParts: string[],
) {
  let current: unknown = root;
  for (const part of pathParts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' && current.trim() ? current : null;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function countBy<T>(
  values: T[],
  getKey: (value: T) => string,
): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = getKey(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function renderMarkdown(report: Record<string, any>) {
  const topRows = Array.isArray(report.topCampaignDeliveryRows)
    ? (report.topCampaignDeliveryRows as TopCampaignDeliveryRow[])
    : [];
  return [
    '# Profile Readiness Consumer Closure Packet',
    '',
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total checks: ${report.summary.totalChecks}`,
    `- Passed checks: ${report.summary.passedChecks}`,
    `- Warning checks: ${report.summary.warningChecks}`,
    `- Failed checks: ${report.summary.failedChecks}`,
    `- User-prompt gaps: ${report.summary.userPromptGaps}`,
    `- Missing copy gaps: ${report.summary.missingCopyGaps.join(', ') || 'none'}`,
    `- school_list.add_first rows: ${report.summary.schoolListAddFirstRows}`,
    `- Top campaign group: ${report.summary.topCampaignGroup ?? 'none'}`,
    `- Top campaign delivery rows: ${report.summary.topCampaignDeliveryRows}`,
    `- Top campaign ready rows: ${report.summary.topCampaignReadyRows}`,
    `- Top campaign anonymized: ${report.summary.topCampaignAnonymized ? 'yes' : 'no'}`,
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
    '## Top Campaign Delivery Preflight',
    '',
    `Showing ${Math.min(topRows.length, 25)} of ${topRows.length} rows. These rows are anonymized delivery previews only and do not send notifications.`,
    '',
    '| Recipient | Campaign | Status | Severity | Route | Channels | Live Disabled | Suppress When |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...(topRows.length
      ? topRows
          .slice(0, 25)
          .map(
            (row) =>
              `| ${escapeMarkdown(row.recipientKey)} | ${escapeMarkdown(row.campaignId)} | ${escapeMarkdown(row.status)} | ${escapeMarkdown(row.severity)} | ${escapeMarkdown(row.route)} | ${escapeMarkdown(row.allowedChannels.join('; '))} | ${escapeMarkdown(row.liveChannelsDisabled.join('; '))} | ${escapeMarkdown(row.suppressWhen.join('; '))} |`,
          )
      : ['| none | n/a | n/a | n/a | n/a | n/a | n/a | n/a |']),
    '',
  ].join('\n');
}

function renderCsv(
  checks: CheckRow[],
  topCampaignDeliveryRows: TopCampaignDeliveryRow[],
) {
  const header = [
    'rowKind',
    'id',
    'status',
    'summary',
    'evidence',
    'missing',
    'recipientKey',
    'campaignId',
    'domain',
    'action',
    'gap',
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
      check.evidence.join('; '),
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
    ]
      .map(csvCell)
      .join(','),
  );
  const deliveryRows = topCampaignDeliveryRows.map((row) =>
    [
      'top_campaign_delivery_preview',
      '',
      row.status,
      'anonymized non-live delivery preview row',
      '',
      '',
      row.recipientKey,
      row.campaignId,
      row.domain,
      row.action,
      row.gap,
      row.severity,
      row.route,
      row.allowedChannels.join('; '),
      row.liveChannelsDisabled.join('; '),
      row.frequencyDedupeKey ?? '',
      row.suppressWhen.join('; '),
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[header.join(','), ...checkRows, ...deliveryRows].join('\n')}\n`;
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
        failedChecks: report.summary.failedChecks,
        warningChecks: report.summary.warningChecks,
        schoolListAddFirstRows: report.summary.schoolListAddFirstRows,
        nextCampaign: report.nextCampaign,
      },
      null,
      2,
    ),
  );
}

main();
