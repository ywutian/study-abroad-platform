#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type Severity = 'critical' | 'warning' | 'info';
type Automation = 'user_prompt' | 'operator_review' | 'system_generation';

interface Args {
  worklist: string;
  policy: string;
  out: string;
  csv: string;
  includeUserIds: boolean;
  approvedOperatorWorkflow: string | null;
  operatorAck: string | null;
  salt: string | null;
}

interface WorklistReport {
  generatedAt: string;
  readinessVersion?: string;
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

interface DeliveryPolicy {
  policyVersion: string;
  status: string;
  approvedAt: string;
  channels: Record<string, { enabled: boolean; consentBasis: string }>;
  frequencyCap: {
    perUserPerCampaignDays: number;
    perUserTotalReadinessPromptsPer30Days: number;
    quietHoursLocal: { start: string; end: string };
    dedupeKey: string;
  };
  copy: Record<string, { title: string; content: string; cta: string }>;
}

interface DeliveryRow {
  queue: Automation;
  status:
    | 'ready_for_in_app_admin_delivery'
    | 'ready_for_operator_review'
    | 'ready_for_system_generation'
    | 'blocked_missing_copy';
  recipientKey: string;
  campaignId: string;
  domain: string;
  action: string;
  gap: string;
  severity: Severity;
  route: string;
  title?: string;
  content?: string;
  cta?: string;
  allowedChannels: string[];
  liveChannelsDisabled: string[];
  frequencyDedupeKey?: string;
  suppressWhen: string[];
  schoolId?: string;
  schoolName?: string;
}

const API_ROOT = detectApiRoot();
const RAW_ID_APPROVAL_PHRASE = 'APPROVED_PROFILE_READINESS_RAW_USER_ID_EXPORT';
const RAW_ID_PRIVATE_DIR = path.join(
  API_ROOT,
  'scripts',
  'closure-reports',
  'private',
);

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
  const worklist = get('--worklist');
  if (!worklist) {
    throw new Error(
      'Missing --worklist path from audit:profile-readiness-worklist',
    );
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(
    API_ROOT,
    get(
      '--out',
      path.join(
        API_ROOT,
        'scripts',
        'closure-reports',
        `profile-readiness-admin-delivery-${stamp}.json`,
      ),
    )!,
  );
  const args = {
    worklist: path.resolve(worklist),
    policy: path.resolve(
      API_ROOT,
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
    csv: path.resolve(get('--csv', out.replace(/\.json$/i, '.csv'))!),
    includeUserIds: argv.includes('--include-user-ids'),
    approvedOperatorWorkflow: get('--approved-operator-workflow') ?? null,
    operatorAck: get('--operator-ack') ?? null,
    salt: get('--salt') ?? null,
  };
  validateRawUserIdExport(args);
  return args;
}

function main() {
  const args = parseArgs();
  const worklist = JSON.parse(
    fs.readFileSync(args.worklist, 'utf8'),
  ) as WorklistReport;
  const policy = JSON.parse(
    fs.readFileSync(args.policy, 'utf8'),
  ) as DeliveryPolicy;
  if (!Array.isArray(worklist.rows)) {
    throw new Error(`Invalid worklist report: ${args.worklist}`);
  }

  const salt = args.salt ?? `profile-readiness:${worklist.generatedAt}`;
  const openRows = worklist.rows.filter((row) => row.action !== 'accept');
  const deliveryRows = openRows.map((row) =>
    buildDeliveryRow(row, policy, args, salt),
  );

  const output = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-admin-delivery-package',
    sourceWorklist: args.worklist,
    policyFile: args.policy,
    readinessVersion: worklist.readinessVersion ?? 'unknown',
    privacy: {
      includesUserIds: args.includeUserIds,
      recipientKeyStrategy: args.includeUserIds
        ? 'raw-user-id'
        : 'sha256(report-salted-user-id)',
      rawUserIdGuard: args.includeUserIds
        ? 'approved-private-operator-export'
        : 'not-included',
      approvedOperatorWorkflow: args.approvedOperatorWorkflow,
    },
    policy: {
      policyVersion: policy.policyVersion,
      status: policy.status,
      approvedAt: policy.approvedAt,
      frequencyCap: policy.frequencyCap,
      enabledUserSurfaces: enabledUserSurfaces(policy),
      disabledLiveChannels: disabledLiveChannels(policy),
    },
    summary: {
      openRows: deliveryRows.length,
      uniqueRecipients: new Set(deliveryRows.map((row) => row.recipientKey))
        .size,
      byQueue: countBy(deliveryRows, (row) => row.queue),
      byStatus: countBy(deliveryRows, (row) => row.status),
      bySeverity: countBy(deliveryRows, (row) => row.severity),
      campaignGroups: new Set(deliveryRows.map((row) => row.campaignId)).size,
    },
    rows: deliveryRows,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.mkdirSync(path.dirname(args.csv), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(args.csv, toCsv(deliveryRows));

  console.log(`Profile readiness admin delivery package: ${args.out}`);
  console.log(`Profile readiness admin delivery CSV: ${args.csv}`);
  console.log(
    `Rows=${deliveryRows.length}; recipients=${output.summary.uniqueRecipients}; blocked=${output.summary.byStatus.blocked_missing_copy ?? 0}`,
  );
  if (args.includeUserIds) {
    console.log(
      `Raw user ID export guard: approved workflow ${args.approvedOperatorWorkflow}; private output only`,
    );
  }
}

function validateRawUserIdExport(args: Args) {
  if (!args.includeUserIds) return;
  if (!args.approvedOperatorWorkflow) {
    throw new Error(
      'Raw user ID export requires --approved-operator-workflow <workflow-id>.',
    );
  }
  if (args.operatorAck !== RAW_ID_APPROVAL_PHRASE) {
    throw new Error(
      `Raw user ID export requires --operator-ack ${RAW_ID_APPROVAL_PHRASE}.`,
    );
  }
  if (!isInsideDirectory(args.out, RAW_ID_PRIVATE_DIR)) {
    throw new Error(
      `Raw user ID JSON export must be written under ${RAW_ID_PRIVATE_DIR}.`,
    );
  }
  if (!isInsideDirectory(args.csv, RAW_ID_PRIVATE_DIR)) {
    throw new Error(
      `Raw user ID CSV export must be written under ${RAW_ID_PRIVATE_DIR}.`,
    );
  }
}

function isInsideDirectory(filePath: string, dirPath: string) {
  const relative = path.relative(dirPath, filePath);
  return (
    Boolean(relative) &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}

function buildDeliveryRow(
  row: WorklistRow,
  policy: DeliveryPolicy,
  args: Args,
  salt: string,
): DeliveryRow {
  const queue = automationFor(row.action);
  const campaignId = slug(`${row.domain}-${row.action}-${row.gap}`);
  const copy = policy.copy[row.gap];
  const missingCopy = queue === 'user_prompt' && !copy;
  const recipientKey = recipientKeyFor(row.userId, args, salt);
  return {
    queue,
    status: missingCopy ? 'blocked_missing_copy' : statusFor(queue),
    recipientKey,
    campaignId,
    domain: row.domain,
    action: row.action,
    gap: row.gap,
    severity: row.severity,
    route: routeFor(row.gap, row.route),
    title: copy?.title,
    content: copy?.content,
    cta: copy?.cta,
    allowedChannels:
      queue === 'user_prompt' ? enabledUserSurfaces(policy) : ['admin_queue'],
    liveChannelsDisabled: disabledLiveChannels(policy),
    frequencyDedupeKey:
      queue === 'user_prompt'
        ? policy.frequencyCap.dedupeKey
            .replace('{campaignId}', campaignId)
            .replace('{userId}', recipientKey)
        : undefined,
    suppressWhen: suppressWhenFor(row.gap, row.action),
    schoolId: row.schoolId,
    schoolName: row.schoolName,
  };
}

function automationFor(action: string): Automation {
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
  return 'user_prompt';
}

function statusFor(queue: Automation): DeliveryRow['status'] {
  if (queue === 'operator_review') return 'ready_for_operator_review';
  if (queue === 'system_generation') return 'ready_for_system_generation';
  return 'ready_for_in_app_admin_delivery';
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
    'profile.missing': '/profile',
    'school_list.add_first': '/schools',
    'school_list.min_count': '/schools',
    'school_list.balance': '/schools',
    'timeline.missing_school_round': '/timeline',
    'timeline.overdue_tasks': '/timeline',
    'essays.none': '/essays',
    'essays.prompt_link_missing': '/essays',
    'recommendation_letters.min_submitted': '/profile?tab=recommendations',
    'resume.none': '/resume',
  };
  return routes[gap] ?? fallbackRoute ?? '/profile';
}

function suppressWhenFor(gap: string, action: string): string[] {
  const suppressors: Record<string, string[]> = {
    'profile.missing': ['Profile row exists for user'],
    'profile.gpa_anchor': ['Profile has GPA value and GPA scale'],
    'profile.major': ['Profile intendedMajor or targetMajor is set'],
    'profile.test_strategy': ['Profile has test scores or explicit test plan'],
    'profile.activities': ['User has at least one activity row'],
    'profile.awards': ['User has at least one award row'],
    'profile.basic_context': ['Profile school/grade/curriculum context exists'],
    'profile.demographics': ['Profile applicant context exists'],
    'profile.education': ['User has education history rows'],
    'profile.activities.template_unmatched': [
      'Activity rows are linked to reviewed activity templates',
    ],
    'profile.awards.competition_unmatched': [
      'Award rows are linked to reviewed competition records',
    ],
    'school_list.add_first': ['SchoolListItem count > 0'],
    'school_list.min_count': ['SchoolListItem count >= readiness threshold'],
    'school_list.balance': ['Reach/target/safety mix is balanced'],
    'timeline.missing_school_round': [
      'ApplicationTimeline has generated tasks for each selected school round',
    ],
    'timeline.overdue_tasks': ['No overdue application timeline tasks remain'],
    'essays.none': ['User has at least one essay draft or prompt selection'],
    'essays.prompt_link_missing': ['Essay drafts are linked to prompt records'],
    'recommendation_letters.min_submitted': [
      'Recommendation letter count meets readiness threshold',
    ],
    'resume.none': ['User has at least one resume artifact'],
    'prediction.missing': [
      'Fresh authoritative prediction exists for selected schools',
    ],
    'application_analysis.not_run': ['Application analysis run exists'],
    'application_analysis.predictions_required': [
      'Required predictions exist before application analysis',
    ],
    'deadline.round_missing': [
      'Deadline evidence confirms the selected school round',
    ],
  };
  if (action === 'run-prediction') {
    return ['Fresh authoritative prediction exists for selected schools'];
  }
  return suppressors[gap] ?? [gap];
}

function recipientKeyFor(userId: string, args: Args, salt: string): string {
  if (args.includeUserIds) return userId;
  return crypto
    .createHash('sha256')
    .update(`${salt}:${userId}`)
    .digest('hex')
    .slice(0, 24);
}

function enabledUserSurfaces(policy: DeliveryPolicy): string[] {
  return ['in_app_readiness_surface', 'dashboard'].filter(
    (channel) => policy.channels[channel]?.enabled,
  );
}

function disabledLiveChannels(policy: DeliveryPolicy): string[] {
  return ['redis_notification_feed', 'remote_push', 'email'].filter(
    (channel) => !policy.channels[channel]?.enabled,
  );
}

function countBy<T, K extends string>(
  values: T[],
  getKey: (value: T) => K,
): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const value of values) {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCsv(rows: DeliveryRow[]): string {
  const headers = [
    'queue',
    'status',
    'recipientKey',
    'campaignId',
    'domain',
    'action',
    'gap',
    'severity',
    'route',
    'title',
    'content',
    'cta',
    'allowedChannels',
    'liveChannelsDisabled',
    'frequencyDedupeKey',
    'suppressWhen',
    'schoolId',
    'schoolName',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((header) =>
          csvCell((row as unknown as Record<string, unknown>)[header]),
        )
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: unknown): string {
  if (Array.isArray(value)) return csvCell(value.join('|'));
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

main();
