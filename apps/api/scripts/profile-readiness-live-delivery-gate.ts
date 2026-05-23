#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type LiveChannel = 'redis_notification_feed' | 'remote_push' | 'email';
type GateStatus = 'READY' | 'BLOCKED';

interface Args {
  packagePath: string | null;
  policy: string;
  out: string;
  schema: string;
}

interface DeliveryPackage {
  generatedAt: string;
  privacy: {
    includesUserIds: boolean;
    recipientKeyStrategy: string;
  };
  summary: {
    openRows: number;
    uniqueRecipients: number;
    byQueue?: Record<string, number>;
    byStatus?: Record<string, number>;
  };
  rows: Array<{
    queue: string;
    status: string;
    liveChannelsDisabled?: string[];
  }>;
}

interface DeliveryPolicy {
  policyVersion: string;
  status: string;
  channels: Record<
    string,
    {
      enabled: boolean;
      consentBasis: string;
      writesNotificationFeed?: boolean;
    }
  >;
  frequencyCap: Record<string, unknown>;
}

interface ChannelGate {
  channel: LiveChannel;
  status: GateStatus;
  candidateRows: number;
  candidateRecipients: number;
  blockers: string[];
  evidence: Record<string, unknown>;
}

const API_ROOT = detectApiRoot();
const REPO_ROOT = path.resolve(API_ROOT, '..', '..');
const REPORT_ROOT = path.join(API_ROOT, 'scripts', 'closure-reports');
const LIVE_CHANNELS: LiveChannel[] = [
  'redis_notification_feed',
  'remote_push',
  'email',
];

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
  return {
    packagePath: get('--package') ?? null,
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
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          REPORT_ROOT,
          `profile-readiness-live-delivery-gate-${stamp}.json`,
        ),
      )!,
    ),
    schema: path.resolve(
      API_ROOT,
      get('--schema', path.join(API_ROOT, 'prisma', 'schema.prisma'))!,
    ),
  };
}

function main() {
  const args = parseArgs();
  const packagePath = args.packagePath
    ? path.resolve(args.packagePath)
    : findLatestAdminDeliveryPackage();
  if (!packagePath) {
    throw new Error(
      'No profile readiness admin delivery package found. Run audit:profile-readiness-admin-delivery first, or pass --package.',
    );
  }

  const deliveryPackage = JSON.parse(
    fs.readFileSync(packagePath, 'utf8'),
  ) as DeliveryPackage;
  const policy = JSON.parse(
    fs.readFileSync(args.policy, 'utf8'),
  ) as DeliveryPolicy;
  const codeEvidence = inspectCodeAndSchema(args.schema);
  const gates = LIVE_CHANNELS.map((channel) =>
    buildChannelGate(channel, deliveryPackage, policy, codeEvidence),
  );

  const output = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-profile-readiness-live-delivery-gate',
    sourcePackage: packagePath,
    policyFile: args.policy,
    status: gates.every((gate) => gate.status === 'READY')
      ? 'READY_FOR_LIVE_DELIVERY'
      : 'BLOCKED_FOR_LIVE_DELIVERY',
    summary: {
      candidateRows: deliveryPackage.rows.length,
      candidateRecipients: deliveryPackage.summary.uniqueRecipients,
      includesUserIds: deliveryPackage.privacy.includesUserIds,
      readyChannels: gates
        .filter((gate) => gate.status === 'READY')
        .map((gate) => gate.channel),
      blockedChannels: gates
        .filter((gate) => gate.status === 'BLOCKED')
        .map((gate) => gate.channel),
      blockers: [...new Set(gates.flatMap((gate) => gate.blockers))],
    },
    codeEvidence,
    gates,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);

  console.log(`Profile readiness live delivery gate: ${args.out}`);
  console.log(
    `Status=${output.status}; candidateRows=${output.summary.candidateRows}; blockedChannels=${output.summary.blockedChannels.join(',') || 'none'}`,
  );
  for (const gate of gates) {
    if (gate.status === 'BLOCKED') {
      console.log(`- ${gate.channel}: ${gate.blockers.join('; ')}`);
    }
  }
}

function findLatestAdminDeliveryPackage() {
  if (!fs.existsSync(REPORT_ROOT)) return null;
  return (
    fs
      .readdirSync(REPORT_ROOT)
      .filter(
        (name) =>
          name.startsWith('profile-readiness-admin-delivery-') &&
          name.endsWith('.json'),
      )
      .map((name) => {
        const filePath = path.join(REPORT_ROOT, name);
        return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath ?? null
  );
}

function inspectCodeAndSchema(schemaPath: string) {
  const schema = readText(schemaPath);
  const notificationController = readText(
    path.join(
      API_ROOT,
      'src',
      'modules',
      'notification',
      'notification.controller.ts',
    ),
  );
  const notificationService = readText(
    path.join(
      API_ROOT,
      'src',
      'modules',
      'notification',
      'notification.service.ts',
    ),
  );
  const sharedRoutes = readText(
    path.join(
      REPO_ROOT,
      'packages',
      'shared',
      'src',
      'constants',
      'api-routes.ts',
    ),
  );
  return {
    hasNotificationPreferenceModel:
      /\bmodel\s+(UserNotificationPreference|NotificationPreference)\b/.test(
        schema,
      ),
    hasNotificationPreferenceFields:
      /\b(notificationPreferences|emailNotifications|pushNotifications|readinessNotifications|readinessInAppSurface|readinessRedisNotificationFeed|readinessRemotePush|readinessEmail)\b/.test(
        schema,
      ),
    hasNotificationPreferenceApi:
      /notification/i.test(notificationController) &&
      /preference/i.test(notificationController),
    hasSharedPreferenceRoute: /notificationRoutes[\s\S]*preference/i.test(
      sharedRoutes,
    ),
    hasPushTokenEndpoint:
      /registerPushToken/i.test(notificationController) &&
      /registerPushToken/i.test(notificationService),
    hasEmailIdentity: /\bemail\s+String\b/.test(schema),
    hasEmailVerified: /\bemailVerified\s+Boolean\b/.test(schema),
    notificationServiceUsesRedisFeed:
      /NOTIFICATION_KEY_PREFIX|notifications:|unread_count:/i.test(
        notificationService,
      ),
    pushTokenStorageIsRedis:
      /PUSH_TOKEN_KEY_PREFIX|notification_push_tokens:/i.test(
        notificationService,
      ),
    hasReadinessLiveChannelConsentJoin:
      /getReadinessLiveChannelConsent/i.test(notificationService) &&
      /getValidExpoPushTokens/i.test(notificationService) &&
      /readinessRemotePush/i.test(notificationService),
  };
}

function buildChannelGate(
  channel: LiveChannel,
  deliveryPackage: DeliveryPackage,
  policy: DeliveryPolicy,
  codeEvidence: ReturnType<typeof inspectCodeAndSchema>,
): ChannelGate {
  const channelPolicy = policy.channels[channel];
  const blockers: string[] = [];
  if (!channelPolicy?.enabled) blockers.push('channel_disabled_by_policy');
  if (!codeEvidence.hasNotificationPreferenceModel) {
    blockers.push('missing_notification_preference_model');
  }
  if (!codeEvidence.hasNotificationPreferenceApi) {
    blockers.push('missing_notification_preference_api');
  }
  if (!codeEvidence.hasSharedPreferenceRoute) {
    blockers.push('missing_shared_notification_preference_route');
  }
  if (!deliveryPackage.privacy.includesUserIds) {
    blockers.push('recipient_user_ids_redacted');
  }

  if (channel === 'remote_push') {
    if (!codeEvidence.hasPushTokenEndpoint)
      blockers.push('missing_push_token_endpoint');
    if (
      codeEvidence.pushTokenStorageIsRedis &&
      !codeEvidence.hasReadinessLiveChannelConsentJoin
    ) {
      blockers.push('push_token_cache_has_no_preference_consent_join');
    }
  }
  if (channel === 'email') {
    if (!codeEvidence.hasEmailIdentity || !codeEvidence.hasEmailVerified) {
      blockers.push('missing_verified_email_identity');
    }
  }
  if (channel === 'redis_notification_feed') {
    if (!codeEvidence.notificationServiceUsesRedisFeed) {
      blockers.push('missing_redis_notification_feed_service');
    }
  }

  return {
    channel,
    status: blockers.length === 0 ? 'READY' : 'BLOCKED',
    candidateRows: deliveryPackage.rows.length,
    candidateRecipients: deliveryPackage.summary.uniqueRecipients,
    blockers,
    evidence: {
      policyEnabled: Boolean(channelPolicy?.enabled),
      consentBasis: channelPolicy?.consentBasis ?? null,
      writesNotificationFeed: channelPolicy?.writesNotificationFeed ?? null,
    },
  };
}

function readText(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

main();
