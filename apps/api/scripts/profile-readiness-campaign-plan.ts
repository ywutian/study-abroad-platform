#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

type Severity = 'critical' | 'warning' | 'info';
type CampaignChannel =
  | 'in_app'
  | 'dashboard'
  | 'email_candidate'
  | 'admin_queue';

interface Args {
  worklist: string;
  out: string;
  includeUserIds: boolean;
  sampleLimit: number;
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
  details?: Record<string, unknown>;
}

interface CampaignDefinition {
  campaignId: string;
  title: string;
  messageKey: string;
  primaryRoute: string;
  targetTab?: string;
  channels: CampaignChannel[];
  automation: 'user_prompt' | 'operator_review' | 'system_generation';
  consumerClosure: string[];
  suppressWhen: string[];
}

interface CampaignOutput extends CampaignDefinition {
  domain: string;
  gap: string;
  action: string;
  severity: Severity;
  priorityScore: number;
  audienceCount: number;
  rowCount: number;
  audience: string[];
  sampleRows: Array<{
    audienceKey: string;
    route: string;
    schoolId?: string;
    schoolName?: string;
  }>;
}

const DEFAULT_SAMPLE_LIMIT = 25;

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
        path.join('/tmp', `profile-readiness-campaign-plan-${stamp}.json`),
      )!,
    ),
    includeUserIds: argv.includes('--include-user-ids'),
    sampleLimit: Number(get('--sample-limit', `${DEFAULT_SAMPLE_LIMIT}`)),
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

  const salt = args.salt ?? `profile-readiness:${report.generatedAt}`;
  const openRows = report.rows.filter((row) => row.action !== 'accept');
  const grouped = new Map<string, WorklistRow[]>();
  for (const row of openRows) {
    const key = `${row.domain}:${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const campaigns = Array.from(grouped.entries())
    .map(([key, rows]) => buildCampaign(key, rows, args, salt))
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        b.audienceCount - a.audienceCount ||
        a.campaignId.localeCompare(b.campaignId),
    );

  const output = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    sourceWorklist: args.worklist,
    readinessVersion: report.readinessVersion ?? 'unknown',
    privacy: {
      includesUserIds: args.includeUserIds,
      audienceKeyStrategy: args.includeUserIds
        ? 'raw-user-id'
        : 'sha256(report-salted-user-id)',
      sampleLimit: args.sampleLimit,
    },
    summary: {
      sourceGeneratedAt: report.generatedAt,
      sourceSummary: report.summary ?? {},
      campaigns: campaigns.length,
      totalAudienceMemberships: campaigns.reduce(
        (sum, campaign) => sum + campaign.audienceCount,
        0,
      ),
      byAutomation: countBy(campaigns, (campaign) => campaign.automation),
      bySeverity: countBy(campaigns, (campaign) => campaign.severity),
    },
    highestPriority: campaigns.slice(0, 8).map((campaign) => ({
      campaignId: campaign.campaignId,
      title: campaign.title,
      gap: campaign.gap,
      audienceCount: campaign.audienceCount,
      severity: campaign.severity,
      primaryRoute: campaign.primaryRoute,
      automation: campaign.automation,
    })),
    campaigns,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Profile readiness campaign plan: ${args.out}`);
  console.log(
    `Campaigns=${campaigns.length}; audienceMemberships=${output.summary.totalAudienceMemberships}`,
  );
  for (const campaign of output.highestPriority.slice(0, 6)) {
    console.log(
      `- ${campaign.campaignId}: audience=${campaign.audienceCount} severity=${campaign.severity} route=${campaign.primaryRoute}`,
    );
  }
}

function buildCampaign(
  key: string,
  rows: WorklistRow[],
  args: Args,
  salt: string,
): CampaignOutput {
  const [domain, action, gap] = key.split(':');
  const definition = definitionFor(domain, action, gap, rows[0]?.route);
  const severity = maxSeverity(rows);
  const audience = unique(
    rows.map((row) => audienceKey(row.userId, args, salt)),
  );
  return {
    ...definition,
    domain,
    action,
    gap,
    severity,
    priorityScore: audience.length * severityWeight(severity) + rows.length,
    audienceCount: audience.length,
    rowCount: rows.length,
    audience: audience.slice(0, args.sampleLimit),
    sampleRows: rows.slice(0, args.sampleLimit).map((row) => ({
      audienceKey: audienceKey(row.userId, args, salt),
      route: row.route,
      schoolId: row.schoolId,
      schoolName: row.schoolName,
    })),
  };
}

function definitionFor(
  domain: string,
  action: string,
  gap: string,
  fallbackRoute?: string,
): CampaignDefinition {
  const base = {
    campaignId: slug(`${domain}-${action}-${gap}`),
    title: titleFor(gap),
    messageKey: `profile.readiness.campaign.${camelKey(gap)}`,
    primaryRoute: fallbackRoute ?? '/profile',
    channels: ['in_app', 'dashboard'] as CampaignChannel[],
    automation: 'user_prompt' as const,
    consumerClosure: [
      'GET /profiles/me/readiness',
      'profile command center',
      'prediction preflight',
      'dashboard readiness map',
    ],
    suppressWhen: [gap],
  };

  if (action === 'generate-timeline') {
    return {
      ...base,
      title: 'Generate missing school timeline rows',
      channels: ['admin_queue'] as CampaignChannel[],
      automation: 'system_generation',
      consumerClosure: [
        'timeline page',
        'dashboard deadlines',
        'notification reminders',
      ],
      suppressWhen: ['timeline.missing_school_round'],
    };
  }
  if (
    [
      'match-activity-template',
      'match-award-competition',
      'review-deadline-source',
      'review-legacy-target-source',
    ].includes(action)
  ) {
    return {
      ...base,
      channels: ['admin_queue'] as CampaignChannel[],
      automation: 'operator_review',
      consumerClosure: [
        'profile analysis',
        'prediction explanation',
        'chat context',
      ],
    };
  }
  if (['run-prediction', 'refresh-prediction'].includes(action)) {
    return {
      ...base,
      title:
        action === 'refresh-prediction'
          ? 'Refresh stale predictions'
          : 'Run missing predictions',
      primaryRoute: '/prediction',
      channels: ['in_app', 'dashboard', 'admin_queue'] as CampaignChannel[],
      automation: 'system_generation',
      consumerClosure: [
        'prediction page',
        'application analysis',
        'school list cards',
      ],
      suppressWhen: [
        'prediction.missingSchoolIds is empty and fresh authoritative prediction exists',
      ],
    };
  }
  if (gap === 'school_list.add_first') {
    return {
      ...base,
      title: 'Collect first target school',
      primaryRoute: '/schools',
      suppressWhen: ['SchoolListItem count > 0'],
    };
  }
  return base;
}

function titleFor(gap: string): string {
  const titles: Record<string, string> = {
    'profile.gpa_anchor': 'Collect GPA anchor',
    'profile.major': 'Collect intended major',
    'profile.test_strategy': 'Collect test strategy',
    'profile.activities': 'Collect activities',
    'profile.awards': 'Collect awards',
    'profile.basic_context': 'Collect school and grade context',
    'profile.demographics': 'Collect applicant context',
    'profile.education': 'Collect education history',
    'school_list.add_first': 'Collect first target school',
    'school_list.min_count': 'Expand target school list',
    'school_list.balance': 'Balance reach-target-safety mix',
    'timeline.missing_school_round': 'Sync missing application timeline',
    'essays.none': 'Start essay workflow',
    'recommendation_letters.min_submitted': 'Add recommendation letters',
    'resume.none': 'Create first resume',
  };
  return titles[gap] ?? gap.replace(/[._-]+/g, ' ');
}

function audienceKey(userId: string, args: Args, salt: string): string {
  if (args.includeUserIds) return userId;
  return crypto
    .createHash('sha256')
    .update(`${salt}:${userId}`)
    .digest('hex')
    .slice(0, 24);
}

function maxSeverity(rows: WorklistRow[]): Severity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

function severityWeight(severity: Severity): number {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
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
