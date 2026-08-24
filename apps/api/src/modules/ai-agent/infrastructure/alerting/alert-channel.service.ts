/**
 * Durable AI Agent alert delivery.
 *
 * Alerts are persisted as a minimal, non-sensitive envelope before anything is
 * delivered. The original title, message, user id, trace id and metadata never
 * enter Redis or an external channel through this service. The HTTP cron below
 * is the only delivery worker, so Cloud Run replicas never depend on a local
 * timer or a local Map for aggregation.
 */

import { createHash } from 'crypto';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EmailService } from '../../../../common/email/email.service';
import { runWithCronLock } from '../../../../common/redis/cron-lock.util';
import { RedisService } from '../../../../common/redis/redis.service';
import { REDIS_TTL } from '../../../../common/redis/redis-ttl.constants';

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertChannel {
  SLACK = 'slack',
  EMAIL = 'email',
  WECHAT = 'wechat',
  DINGTALK = 'dingtalk',
  PAGERDUTY = 'pagerduty',
  REDIS_QUEUE = 'redis_queue',
}

export interface AlertPayload {
  /** Stable dedupe hint. It is hashed before the alert is persisted. */
  alertId?: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source?: string;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

interface AlertConfig {
  slackWebhook?: string;
  emailEnabled: boolean;
  emailReady: boolean;
  emailRecipients: string[];
  wechatWebhook?: string;
  dingtalkWebhook?: string;
  pagerdutyRoutingKey?: string;
  aggregationWindowMs: number;
  maxAlertsPerMinute: number;
  deliveryMaxAttempts: number;
  deliveryRetryBaseMs: number;
  deliveryBatchSize: number;
}

interface DurableAlert {
  alertId: string;
  severity: AlertSeverity;
  source: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
  attempts: number;
  deliveryStatus: 'pending' | 'retrying' | 'delivered' | 'dead_lettered';
}

const PREFIX = 'ai-agent:alert:v1';
const ACTIVE_KEY = `${PREFIX}:active`;
const DUE_KEY = `${PREFIX}:due`;
const RATE_KEY = `${PREFIX}:rate`;
const DELIVERY_LOCK_KEY = `${PREFIX}:delivery-lock`;
const ALERT_ID_PATTERN = /^alert-[a-f0-9]{24}$/;
const SAFE_SOURCE_PATTERN = /^[a-z0-9:_-]{1,64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Atomically accepts one event, aggregates it by opaque fingerprint, and
// schedules first delivery. No caller-controlled body is persisted.
const ENQUEUE_ALERT_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
  end
  local count = redis.call('HINCRBY', KEYS[2], 'count', 1)
  if count == 1 then
    redis.call('HSET', KEYS[2], 'alertId', ARGV[1], 'severity', ARGV[2], 'source', ARGV[3], 'firstSeenAt', ARGV[4], 'attempts', 0, 'deliveryStatus', 'pending')
  end
  redis.call('HSET', KEYS[2], 'lastSeenAt', ARGV[4])
  redis.call('EXPIRE', KEYS[2], ARGV[5])
  redis.call('ZADD', KEYS[3], ARGV[6], ARGV[1])
  redis.call('ZADD', KEYS[4], ARGV[7], ARGV[1])
  redis.call('EXPIRE', KEYS[3], ARGV[5])
  redis.call('EXPIRE', KEYS[4], ARGV[5])
  return {1, count}
`;

const RECORD_RATE_SCRIPT = `
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[4])
  return redis.call('ZCARD', KEYS[1])
`;

@Injectable()
export class AlertChannelService {
  private readonly logger = new Logger(AlertChannelService.name);
  private readonly config: AlertConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
  ) {
    const emailRecipients = this.configService
      .get<string>('ALERT_EMAIL_RECIPIENTS', '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const emailEnabled =
      this.configService.get<string>('ALERT_EMAIL_ENABLED') === 'true';
    this.config = {
      slackWebhook: this.configService.get<string>('ALERT_SLACK_WEBHOOK'),
      emailEnabled,
      // EmailService intentionally mocks when Resend is absent. Do not report
      // that as a production delivery channel: Redis remains the explicit
      // default until an actual provider credential is configured.
      emailReady:
        emailEnabled &&
        emailRecipients.length > 0 &&
        Boolean(this.configService.get<string>('RESEND_API_KEY')),
      emailRecipients,
      wechatWebhook: this.configService.get<string>('ALERT_WECHAT_WEBHOOK'),
      dingtalkWebhook: this.configService.get<string>('ALERT_DINGTALK_WEBHOOK'),
      pagerdutyRoutingKey: this.configService.get<string>(
        'ALERT_PAGERDUTY_ROUTING_KEY',
      ),
      aggregationWindowMs:
        this.positiveNumber('ALERT_AGGREGATION_WINDOW', 60) * 1000,
      maxAlertsPerMinute: this.positiveNumber('ALERT_MAX_PER_MINUTE', 30),
      deliveryMaxAttempts: this.positiveNumber(
        'ALERT_DELIVERY_MAX_ATTEMPTS',
        5,
      ),
      deliveryRetryBaseMs:
        this.positiveNumber('ALERT_DELIVERY_RETRY_SECONDS', 60) * 1000,
      deliveryBatchSize: Math.min(
        this.positiveNumber('ALERT_DELIVERY_BATCH_SIZE', 50),
        100,
      ),
    };
  }

  /** Persist first; webhooks are deliberately delivered by the cron worker. */
  async send(payload: AlertPayload): Promise<void> {
    const alertId = this.createAlertId(payload);
    const now = Date.now();
    if (!(await this.acceptWithinRateLimit(now))) {
      this.logger.warn(`Alert rate limit reached; suppressed alert ${alertId}`);
      return;
    }

    const severity = this.validSeverity(payload.severity);
    const source = this.safeSource(payload.source);
    const dueAt =
      severity === AlertSeverity.CRITICAL
        ? now
        : now + this.config.aggregationWindowMs;
    await this.redis.withClient('atomic', `${PREFIX}:enqueue`, (client) =>
      client.eval(
        ENQUEUE_ALERT_SCRIPT,
        4,
        this.ackKey(alertId),
        this.stateKey(alertId),
        ACTIVE_KEY,
        DUE_KEY,
        alertId,
        severity,
        source,
        new Date(now).toISOString(),
        REDIS_TTL.ALERT_DATA,
        now,
        dueAt,
      ),
    );
    await this.recordDelivery(
      alertId,
      AlertChannel.REDIS_QUEUE,
      'persisted',
      0,
    );
  }

  /** Legacy entry point; it now has the same durable, non-blocking semantics. */
  async sendImmediate(payload: AlertPayload): Promise<void> {
    await this.send(payload);
  }

  /**
   * Production is driven by Cloud Scheduler → /internal/cron, never an
   * in-process interval. The lock also protects manual invocation/retries.
   */
  @Cron('* * * * *', { name: 'alert-channel-service-deliver-pending-alerts' })
  async deliverPendingAlerts(): Promise<void> {
    await runWithCronLock(
      this.redis,
      DELIVERY_LOCK_KEY,
      REDIS_TTL.ALERT_DELIVERY_CRON_LOCK,
      async () => {
        const now = Date.now();
        const due = await this.redis.withClient('read', DUE_KEY, (client) =>
          client.zrangebyscore(
            DUE_KEY,
            '-inf',
            now,
            'LIMIT',
            0,
            this.config.deliveryBatchSize,
          ),
        );
        for (const alertId of due) {
          if (!ALERT_ID_PATTERN.test(alertId)) {
            await this.redis.zrem(DUE_KEY, alertId);
            continue;
          }
          await this.deliverOne(alertId, now);
        }
      },
      this.logger,
    );
  }

  async getStats(): Promise<{
    pendingAlerts: number;
    activeAlerts: number;
    configuredChannels: string[];
    unavailableChannels: string[];
  }> {
    const [pendingAlerts, activeAlerts] = await Promise.all([
      this.redis.zcard(DUE_KEY),
      this.redis.zcard(ACTIVE_KEY),
    ]);
    return {
      pendingAlerts,
      activeAlerts,
      configuredChannels: this.getConfiguredChannels(),
      unavailableChannels:
        this.config.emailEnabled && !this.config.emailReady ? ['email'] : [],
    };
  }

  async getDeliveryLog(alertId: string): Promise<Record<string, unknown>[]> {
    if (!ALERT_ID_PATTERN.test(alertId)) return [];
    const entries = await this.redis.lrange(this.deliveryKey(alertId), 0, -1);
    return entries.flatMap((entry) => {
      try {
        const parsed: unknown = JSON.parse(entry);
        return isRecord(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
  }

  /** Ack removes an alert from both active and delivery indexes. */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    _notes?: string,
  ): Promise<void> {
    if (!ALERT_ID_PATTERN.test(alertId)) {
      throw new InternalServerErrorException('Invalid alert identifier');
    }
    // The database audit log owns the actor and optional note. Redis retains a
    // one-way fingerprint only, so alert data does not become another PII store.
    const actorFingerprint = createHash('sha256')
      .update(acknowledgedBy)
      .digest('hex')
      .slice(0, 16);
    await this.redis.withClient('atomic', this.ackKey(alertId), (client) =>
      client
        .multi()
        .set(
          this.ackKey(alertId),
          JSON.stringify({
            acknowledgedAt: new Date().toISOString(),
            actorFingerprint,
          }),
          'EX',
          REDIS_TTL.ALERT_ARCHIVE,
        )
        .zrem(DUE_KEY, alertId)
        .zrem(ACTIVE_KEY, alertId)
        .hset(this.stateKey(alertId), 'deliveryStatus', 'acknowledged')
        .expire(this.stateKey(alertId), REDIS_TTL.ALERT_ARCHIVE)
        .exec(),
    );
    await this.recordDelivery(
      alertId,
      AlertChannel.REDIS_QUEUE,
      'acknowledged',
      0,
    );

    if (this.config.pagerdutyRoutingKey) {
      try {
        await this.postJson('https://events.pagerduty.com/v2/enqueue', {
          routing_key: this.config.pagerdutyRoutingKey,
          event_action: 'resolve',
          dedup_key: alertId,
        });
      } catch {
        await this.recordDelivery(alertId, AlertChannel.PAGERDUTY, 'failed', 0);
      }
    }
  }

  async getActiveAlerts(limit = 50): Promise<Record<string, unknown>[]> {
    const ids = await this.redis.zrange(ACTIVE_KEY, 0, Math.max(0, limit - 1));
    const alerts: Record<string, unknown>[] = [];
    for (const alertId of ids) {
      if (!ALERT_ID_PATTERN.test(alertId)) continue;
      const alert = this.toDurableAlert(
        await this.redis.hgetall(this.stateKey(alertId)),
      );
      if (!alert) {
        await this.redis.zrem(ACTIVE_KEY, alertId);
        continue;
      }
      alerts.push({
        alertId: alert.alertId,
        // Preserve the admin API shape without storing caller-controlled text.
        title: 'AI Agent alert',
        severity: alert.severity,
        source: alert.source,
        timestamp: alert.lastSeenAt,
        count: alert.count,
        deliveryStatus: alert.deliveryStatus,
      });
    }
    return alerts;
  }

  private async deliverOne(alertId: string, now: number): Promise<void> {
    if (await this.redis.get(this.ackKey(alertId))) {
      await Promise.all([
        this.redis.zrem(DUE_KEY, alertId),
        this.redis.zrem(ACTIVE_KEY, alertId),
      ]);
      return;
    }
    const state = this.toDurableAlert(
      await this.redis.hgetall(this.stateKey(alertId)),
    );
    if (!state) {
      await Promise.all([
        this.redis.zrem(DUE_KEY, alertId),
        this.redis.zrem(ACTIVE_KEY, alertId),
      ]);
      return;
    }

    const channels = this.getExternalChannels(state.severity);
    if (channels.length === 0) {
      await this.markDelivered(alertId);
      return;
    }

    const attempts = await this.redis.hincrby(
      this.stateKey(alertId),
      'attempts',
      1,
    );
    await this.redis.expire(this.stateKey(alertId), REDIS_TTL.ALERT_DATA);
    let failed = false;
    for (const channel of channels) {
      if (
        (await this.redis.hget(
          this.stateKey(alertId),
          `delivered:${channel}`,
        )) === '1'
      ) {
        continue;
      }
      const startedAt = Date.now();
      try {
        await this.deliverToChannel(channel, state);
        await this.redis.hset(
          this.stateKey(alertId),
          `delivered:${channel}`,
          '1',
        );
        await this.recordDelivery(
          alertId,
          channel,
          'success',
          Date.now() - startedAt,
          attempts,
        );
      } catch {
        failed = true;
        await this.recordDelivery(
          alertId,
          channel,
          'failed',
          Date.now() - startedAt,
          attempts,
        );
      }
    }

    if (!failed) {
      await this.markDelivered(alertId);
      return;
    }
    if (attempts >= this.config.deliveryMaxAttempts) {
      await this.redis.withClient('atomic', this.stateKey(alertId), (client) =>
        client
          .multi()
          .hset(this.stateKey(alertId), 'deliveryStatus', 'dead_lettered')
          .zrem(DUE_KEY, alertId)
          .expire(this.stateKey(alertId), REDIS_TTL.ALERT_ARCHIVE)
          .exec(),
      );
      await this.recordDelivery(
        alertId,
        AlertChannel.REDIS_QUEUE,
        'dead_lettered',
        0,
        attempts,
      );
      return;
    }

    const delayMs = Math.min(
      this.config.deliveryRetryBaseMs * 2 ** Math.max(0, attempts - 1),
      60 * 60 * 1000,
    );
    await this.redis.withClient('atomic', DUE_KEY, (client) =>
      client
        .multi()
        .hset(this.stateKey(alertId), 'deliveryStatus', 'retrying')
        .zadd(DUE_KEY, now + delayMs, alertId)
        .expire(DUE_KEY, REDIS_TTL.ALERT_DATA)
        .exec(),
    );
  }

  private async markDelivered(alertId: string): Promise<void> {
    await this.redis.withClient('atomic', this.stateKey(alertId), (client) =>
      client
        .multi()
        .hset(this.stateKey(alertId), 'deliveryStatus', 'delivered')
        .zrem(DUE_KEY, alertId)
        .expire(this.stateKey(alertId), REDIS_TTL.ALERT_DATA)
        .exec(),
    );
  }

  private async deliverToChannel(
    channel: AlertChannel,
    alert: DurableAlert,
  ): Promise<void> {
    const body = this.deliveryBody(alert);
    switch (channel) {
      case AlertChannel.SLACK:
        await this.postJson(this.config.slackWebhook!, {
          text: body,
          attachments: [
            {
              color: this.getSeverityColor(alert.severity),
              title: `AI Agent ${alert.severity} alert`,
              text: body,
            },
          ],
        });
        return;
      case AlertChannel.WECHAT:
        await this.postJson(this.config.wechatWebhook!, {
          msgtype: 'markdown',
          markdown: {
            content: `### ${this.getSeverityEmoji(alert.severity)} ${body}`,
          },
        });
        return;
      case AlertChannel.DINGTALK:
        await this.postJson(this.config.dingtalkWebhook!, {
          msgtype: 'markdown',
          markdown: { title: 'AI Agent alert', text: `### ${body}` },
        });
        return;
      case AlertChannel.PAGERDUTY:
        await this.postJson('https://events.pagerduty.com/v2/enqueue', {
          routing_key: this.config.pagerdutyRoutingKey,
          event_action: 'trigger',
          dedup_key: alert.alertId,
          payload: {
            summary: body,
            severity: alert.severity,
            source: alert.source,
            component: 'ai-agent',
            group: 'agent-harness',
            class: 'durable-alert',
            timestamp: alert.lastSeenAt,
          },
        });
        return;
      case AlertChannel.EMAIL: {
        const delivered = await this.emailService.sendEmail({
          to: this.config.emailRecipients,
          subject: `AI Agent ${alert.severity} alert`,
          html: `<p>${body}</p>`,
          text: body,
        });
        if (!delivered) {
          throw new InternalServerErrorException(
            'Alert email provider rejected delivery',
          );
        }
        return;
      }
      case AlertChannel.REDIS_QUEUE:
        return;
    }
  }

  private async postJson(
    url: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new InternalServerErrorException(
        `Alert webhook returned ${response.status}`,
      );
    }
  }

  private async acceptWithinRateLimit(now: number): Promise<boolean> {
    const count = Number(
      await this.redis.withClient('atomic', RATE_KEY, (client) =>
        client.eval(
          RECORD_RATE_SCRIPT,
          1,
          RATE_KEY,
          now - 60_000,
          now,
          `${now}-${Math.random().toString(36).slice(2, 10)}`,
          REDIS_TTL.ALERT_RATE_LIMIT * 1000,
        ),
      ),
    );
    return count <= this.config.maxAlertsPerMinute;
  }

  private async recordDelivery(
    alertId: string,
    channel: AlertChannel,
    status:
      'persisted' | 'success' | 'failed' | 'dead_lettered' | 'acknowledged',
    durationMs: number,
    attempt?: number,
  ): Promise<void> {
    try {
      await this.redis.lpush(
        this.deliveryKey(alertId),
        JSON.stringify({
          channel,
          status,
          durationMs: Math.max(0, Math.floor(durationMs)),
          ...(attempt === undefined ? {} : { attempt }),
          timestamp: new Date().toISOString(),
        }),
      );
      await this.redis.expire(this.deliveryKey(alertId), REDIS_TTL.ALERT_DATA);
    } catch {
      // Envelope and due index remain the source of truth. Never log a provider
      // error object: response text and URLs can carry sensitive data.
    }
  }

  private getExternalChannels(severity: AlertSeverity): AlertChannel[] {
    const channels: AlertChannel[] = [];
    if (severity === AlertSeverity.CRITICAL) {
      if (this.config.slackWebhook) channels.push(AlertChannel.SLACK);
      if (this.config.emailReady) channels.push(AlertChannel.EMAIL);
      if (this.config.wechatWebhook) channels.push(AlertChannel.WECHAT);
      if (this.config.dingtalkWebhook) channels.push(AlertChannel.DINGTALK);
      if (this.config.pagerdutyRoutingKey)
        channels.push(AlertChannel.PAGERDUTY);
    } else if (severity === AlertSeverity.WARNING && this.config.slackWebhook) {
      channels.push(AlertChannel.SLACK);
    }
    return channels;
  }

  private getConfiguredChannels(): string[] {
    return [
      AlertChannel.REDIS_QUEUE,
      ...this.getExternalChannels(AlertSeverity.CRITICAL),
    ];
  }

  private toDurableAlert(state: Record<string, string>): DurableAlert | null {
    const alertId = state.alertId;
    const severity = state.severity;
    if (
      !alertId ||
      !ALERT_ID_PATTERN.test(alertId) ||
      !this.isSeverity(severity)
    ) {
      return null;
    }
    return {
      alertId,
      severity,
      source: this.safeSource(state.source),
      firstSeenAt:
        state.firstSeenAt || state.lastSeenAt || new Date(0).toISOString(),
      lastSeenAt: state.lastSeenAt || new Date(0).toISOString(),
      count: Math.max(1, Number(state.count) || 1),
      attempts: Math.max(0, Number(state.attempts) || 0),
      deliveryStatus: this.deliveryStatus(state.deliveryStatus),
    };
  }

  private createAlertId(payload: AlertPayload): string {
    const identity = JSON.stringify({
      alertId: payload.alertId ?? '',
      title: payload.title,
      source: payload.source ?? '',
      severity: payload.severity,
    });
    return `alert-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
  }

  private stateKey(alertId: string): string {
    return `${PREFIX}:state:${alertId}`;
  }

  private ackKey(alertId: string): string {
    return `${PREFIX}:ack:${alertId}`;
  }

  private deliveryKey(alertId: string): string {
    return `${PREFIX}:delivery:${alertId}`;
  }

  private deliveryBody(alert: DurableAlert): string {
    return (
      `[${alert.severity.toUpperCase()}] AI Agent alert ${alert.alertId} ` +
      `(source=${alert.source}, occurrences=${alert.count}, lastSeen=${alert.lastSeenAt})`
    );
  }

  private validSeverity(value: AlertSeverity): AlertSeverity {
    return this.isSeverity(value) ? value : AlertSeverity.WARNING;
  }

  private isSeverity(value: unknown): value is AlertSeverity {
    return Object.values(AlertSeverity).includes(value as AlertSeverity);
  }

  private deliveryStatus(
    value: string | undefined,
  ): DurableAlert['deliveryStatus'] {
    return value === 'retrying' ||
      value === 'delivered' ||
      value === 'dead_lettered'
      ? value
      : 'pending';
  }

  private safeSource(value: unknown): string {
    if (typeof value !== 'string' || !SAFE_SOURCE_PATTERN.test(value)) {
      return 'ai-agent';
    }
    return value.toLowerCase();
  }

  private positiveNumber(key: string, fallback: number): number {
    const parsed = Number(
      this.configService.get<string | number>(key, fallback),
    );
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : fallback;
  }

  private getSeverityColor(severity: AlertSeverity): string {
    return severity === AlertSeverity.CRITICAL
      ? '#dc3545'
      : severity === AlertSeverity.WARNING
        ? '#ffc107'
        : '#17a2b8';
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    return severity === AlertSeverity.CRITICAL
      ? '🔴'
      : severity === AlertSeverity.WARNING
        ? '🟡'
        : '🔵';
  }
}
