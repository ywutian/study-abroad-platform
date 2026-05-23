#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type Severity = 'critical' | 'warning' | 'info';
type Automation = 'user_prompt' | 'operator_review' | 'system_generation';

interface Args {
  worklist: string;
  out: string;
  policy: string;
  includeUserIds: boolean;
  sampleLimit: number;
  campaignLimit: number;
  salt: string | null;
}

interface WorklistReport {
  generatedAt: string;
  readinessVersion?: string;
  summary?: Record<string, unknown>;
  rows: WorklistRow[];
}

interface WorklistRow {
  userId: string;
  profileId: string | null;
  domain: string;
  gap: string;
  action: string;
  severity: Severity;
  route: string;
  schoolId?: string;
  schoolName?: string;
}

interface DispatchBatch {
  batchId: string;
  campaignId: string;
  automation: Automation;
  severity: Severity;
  audienceCount: number;
  rowCount: number;
  primaryRoute: string;
  recipientKeyStrategy: 'raw-user-id' | 'sha256(report-salted-user-id)';
  recipients: string[];
  notificationCandidate: {
    type: 'PROFILE_INCOMPLETE';
    relatedType: 'profile_readiness';
    relatedId: string;
    titleKey: string;
    contentKey: string;
    route: string;
  } | null;
  copyCandidate: {
    title: string;
    content: string;
    cta: string;
  } | null;
  channelPolicy: {
    allowedNow: string[];
    requiresApproval: string[];
    suppressWhen: string[];
  };
  dispatchReadiness: {
    inAppSurfaceReady: boolean;
    notificationReady: boolean;
    recipientIdsAvailable: boolean;
    blockers: string[];
    liveNotificationBlockers: string[];
  };
}

interface DeliveryPolicy {
  policyVersion: string;
  status: string;
  approvedAt: string;
  sourceAdr: string;
  channels: Record<
    string,
    {
      enabled: boolean;
      consentBasis: string;
      writesNotificationFeed: boolean;
    }
  >;
  frequencyCap: {
    perUserPerCampaignDays: number;
    perUserTotalReadinessPromptsPer30Days: number;
    quietHoursLocal: {
      start: string;
      end: string;
    };
    dedupeKey: string;
  };
  copy: Record<
    string,
    {
      title: string;
      content: string;
      cta: string;
    }
  >;
}

const DEFAULT_SAMPLE_LIMIT = 25;
const DEFAULT_CAMPAIGN_LIMIT = 16;

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const worklist = get('--worklist');
  if (!worklist) {
    throw new Error(
      'Missing --worklist path from audit:profile-readiness-worklist',
    );
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    worklist: path.resolve(worklist),
    out: path.resolve(
      get(
        '--out',
        path.join('/tmp', `profile-readiness-dispatch-dry-run-${stamp}.json`),
      )!,
    ),
    policy: path.resolve(
      get(
        '--policy',
        path.join('scripts', 'data', 'profile-readiness-delivery-policy.json'),
      )!,
    ),
    includeUserIds: argv.includes('--include-user-ids'),
    sampleLimit: Number(get('--sample-limit', `${DEFAULT_SAMPLE_LIMIT}`)),
    campaignLimit: Number(get('--campaign-limit', `${DEFAULT_CAMPAIGN_LIMIT}`)),
    salt: get('--salt') ?? null,
  };
}

function main() {
  const args = parseArgs();
  const report = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  if (!Array.isArray(report.rows)) {
    throw new Error(`Invalid worklist report: ${args.worklist}`);
  }
  const policy = loadDeliveryPolicy(args.policy);

  const salt = args.salt ?? `profile-readiness:${report.generatedAt}`;
  const openRows = report.rows.filter((row) => row.action !== 'accept');
  const grouped = new Map<string, WorklistRow[]>();
  for (const row of openRows) {
    const key = `${row.domain}:${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const batches = Array.from(grouped.entries())
    .map(([key, rows]) => buildBatch(key, rows, args, salt, policy))
    .sort(
      (a, b) =>
        scoreBatch(b) - scoreBatch(a) ||
        b.audienceCount - a.audienceCount ||
        a.batchId.localeCompare(b.batchId),
    )
    .slice(0, args.campaignLimit);

  const output = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-dry-run',
    sourceWorklist: args.worklist,
    readinessVersion: report.readinessVersion ?? 'unknown',
    privacy: {
      includesUserIds: args.includeUserIds,
      recipientKeyStrategy: args.includeUserIds
        ? 'raw-user-id'
        : 'sha256(report-salted-user-id)',
      sampleLimit: args.sampleLimit,
      campaignLimit: args.campaignLimit,
    },
    deliveryContract: {
      writesDatabase: false,
      sendsNotifications: false,
      policyFile: args.policy,
      policyVersion: policy.policyVersion,
      policyStatus: policy.status,
      policyApprovedAt: policy.approvedAt,
      defaultUserChannels: ['in_app_readiness_surface', 'dashboard'],
      blockedChannelsUntilApproval: disabledChannels(policy),
      notificationTypeCandidate: 'PROFILE_INCOMPLETE',
      notificationPersistenceDecision:
        'ADR-0021: Redis notification feed is an ephemeral 30-day delivery cache; P0/P1 closure remains in owning domain models.',
      approvalGate:
        'Dry-run and in-app/dashboard surfaces are policy-approved. Live Redis/push/email dispatch remains disabled until a user notification preference model and explicit admin delivery path are implemented.',
      frequencyCap: policy.frequencyCap,
    },
    summary: {
      sourceGeneratedAt: report.generatedAt,
      sourceSummary: report.summary ?? {},
      openRows: openRows.length,
      dispatchBatches: batches.length,
      totalAudienceMemberships: batches.reduce(
        (sum, batch) => sum + batch.audienceCount,
        0,
      ),
      notificationReadyBatches: batches.filter(
        (batch) => batch.dispatchReadiness.notificationReady,
      ).length,
      inAppSurfaceReadyBatches: batches.filter(
        (batch) => batch.dispatchReadiness.inAppSurfaceReady,
      ).length,
      blockedBatches: batches.filter(
        (batch) => batch.dispatchReadiness.blockers.length > 0,
      ).length,
      liveNotificationBlockedBatches: batches.filter(
        (batch) => batch.dispatchReadiness.liveNotificationBlockers.length > 0,
      ).length,
    },
    batches,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Profile readiness dispatch dry-run: ${args.out}`);
  console.log(
    `Batches=${batches.length}; audienceMemberships=${output.summary.totalAudienceMemberships}; sendsNotifications=false`,
  );
  for (const batch of batches.slice(0, 6)) {
    console.log(
      `- ${batch.batchId}: audience=${batch.audienceCount} ready=${batch.dispatchReadiness.inAppSurfaceReady} notificationReady=${batch.dispatchReadiness.notificationReady}`,
    );
  }
}

function buildBatch(
  key: string,
  rows: WorklistRow[],
  args: Args,
  salt: string,
  policy: DeliveryPolicy,
): DispatchBatch {
  const [domain, action, gap] = key.split(':');
  const campaignId = slug(`${domain}-${action}-${gap}`);
  const severity = maxSeverity(rows);
  const automation = automationFor(action);
  const audience = unique(
    rows.map((row) => recipientKey(row.userId, args, salt)),
  );
  const primaryRoute = routeFor(gap, rows[0]?.route);
  const suppressWhen = suppressWhenFor(gap, action);
  const recipientIdsAvailable = args.includeUserIds;
  const copyCandidate = policy.copy[gap] ?? null;
  const notificationCandidate =
    automation === 'user_prompt'
      ? {
          type: 'PROFILE_INCOMPLETE' as const,
          relatedType: 'profile_readiness' as const,
          relatedId: campaignId,
          titleKey: `profile.readiness.campaign.${camelKey(gap)}.title`,
          contentKey: `profile.readiness.campaign.${camelKey(gap)}.content`,
          route: primaryRoute,
        }
      : null;
  const blockers = [
    ...(automation === 'user_prompt' && !copyCandidate
      ? ['missing_delivery_policy_copy']
      : []),
  ];
  const liveNotificationBlockers = [
    ...(recipientIdsAvailable ? [] : ['recipient_user_ids_redacted']),
    ...(notificationCandidate && !copyCandidate
      ? ['missing_delivery_policy_copy']
      : []),
    ...(notificationCandidate &&
    !policy.channels.redis_notification_feed?.enabled
      ? ['redis_notification_feed_disabled_by_policy']
      : []),
    ...(notificationCandidate && !policy.channels.remote_push?.enabled
      ? ['remote_push_disabled_by_policy']
      : []),
    ...(notificationCandidate && !policy.channels.email?.enabled
      ? ['email_disabled_by_policy']
      : []),
  ];

  return {
    batchId: `dry-run-${campaignId}`,
    campaignId,
    automation,
    severity,
    audienceCount: audience.length,
    rowCount: rows.length,
    primaryRoute,
    recipientKeyStrategy: args.includeUserIds
      ? 'raw-user-id'
      : 'sha256(report-salted-user-id)',
    recipients: audience.slice(0, args.sampleLimit),
    notificationCandidate,
    copyCandidate,
    channelPolicy: {
      allowedNow:
        automation === 'user_prompt'
          ? enabledSurfaceChannels(policy)
          : ['admin_queue'],
      requiresApproval:
        automation === 'user_prompt' ? disabledChannels(policy) : [],
      suppressWhen,
    },
    dispatchReadiness: {
      inAppSurfaceReady:
        automation === 'user_prompt' &&
        Boolean(primaryRoute) &&
        Boolean(copyCandidate),
      notificationReady: false,
      recipientIdsAvailable,
      blockers,
      liveNotificationBlockers,
    },
  };
}

function loadDeliveryPolicy(policyPath: string): DeliveryPolicy {
  const policy = JSON.parse(
    fs.readFileSync(policyPath, 'utf8'),
  ) as DeliveryPolicy;
  const requiredChannels = [
    'in_app_readiness_surface',
    'dashboard',
    'redis_notification_feed',
    'remote_push',
    'email',
  ];
  for (const channel of requiredChannels) {
    if (!policy.channels?.[channel]) {
      throw new Error(`Delivery policy missing channel: ${channel}`);
    }
  }
  if (!policy.frequencyCap?.dedupeKey) {
    throw new Error('Delivery policy missing frequencyCap.dedupeKey');
  }
  return policy;
}

function enabledSurfaceChannels(policy: DeliveryPolicy): string[] {
  return ['in_app_readiness_surface', 'dashboard'].filter(
    (channel) => policy.channels[channel]?.enabled,
  );
}

function disabledChannels(policy: DeliveryPolicy): string[] {
  return ['redis_notification_feed', 'remote_push', 'email'].filter(
    (channel) => !policy.channels[channel]?.enabled,
  );
}

function automationFor(action: string): Automation {
  if (action === 'generate-timeline') return 'system_generation';
  if (
    [
      'match-activity-template',
      'match-award-competition',
      'review-deadline-source',
      'review-legacy-target-source',
    ].includes(action)
  ) {
    return 'operator_review';
  }
  if (['run-prediction', 'refresh-prediction'].includes(action)) {
    return 'system_generation';
  }
  return 'user_prompt';
}

function routeFor(gap: string, fallbackRoute?: string): string {
  const routes: Record<string, string> = {
    'profile.gpa_anchor': '/profile?tab=gpa',
    'profile.major': '/profile?tab=basic',
    'profile.test_strategy': '/profile?tab=scores',
    'profile.activities': '/profile?tab=activities',
    'profile.awards': '/profile?tab=awards',
    'profile.basic_context': '/profile?tab=basic',
    'profile.demographics': '/profile?tab=basic',
    'profile.education': '/profile?tab=education',
    'school_list.add_first': '/schools',
    'school_list.min_count': '/schools',
    'school_list.balance': '/schools',
    'timeline.missing_school_round': '/timeline',
    'essays.none': '/essays',
    'recommendation_letters.min_submitted': '/profile?tab=recommendations',
    'resume.none': '/profile?tab=resume',
  };
  return routes[gap] ?? fallbackRoute ?? '/profile';
}

function suppressWhenFor(gap: string, action: string): string[] {
  const suppressors: Record<string, string[]> = {
    'profile.gpa_anchor': ['Profile has GPA value and GPA scale'],
    'profile.major': ['Profile intendedMajor or targetMajor is set'],
    'profile.test_strategy': ['Profile has test scores or explicit test plan'],
    'profile.activities': ['User has at least one activity row'],
    'profile.awards': ['User has at least one award row'],
    'profile.basic_context': ['Profile school/grade/curriculum context exists'],
    'profile.demographics': ['Profile applicant context exists'],
    'profile.education': ['User has education history rows'],
    'school_list.add_first': ['SchoolListItem count > 0'],
    'school_list.min_count': ['SchoolListItem count >= readiness threshold'],
    'school_list.balance': ['Reach/target/safety mix is balanced'],
    'timeline.missing_school_round': [
      'ApplicationTimeline has generated tasks for each selected school round',
    ],
    'essays.none': ['User has at least one essay draft or prompt selection'],
    'recommendation_letters.min_submitted': [
      'Recommendation letter count meets readiness threshold',
    ],
    'resume.none': ['User has at least one resume artifact'],
  };
  if (action === 'run-prediction') {
    return ['Fresh authoritative prediction exists for selected schools'];
  }
  return suppressors[gap] ?? [gap];
}

function recipientKey(userId: string, args: Args, salt: string): string {
  if (args.includeUserIds) return userId;
  return crypto
    .createHash('sha256')
    .update(`${salt}:${userId}`)
    .digest('hex')
    .slice(0, 24);
}

function scoreBatch(batch: DispatchBatch): number {
  const severityScore =
    batch.severity === 'critical' ? 5 : batch.severity === 'warning' ? 3 : 1;
  const automationScore = batch.automation === 'user_prompt' ? 3 : 1;
  return batch.audienceCount * severityScore + batch.rowCount + automationScore;
}

function maxSeverity(rows: WorklistRow[]): Severity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function camelKey(value: string): string {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`,
    )
    .join('');
}

main();
